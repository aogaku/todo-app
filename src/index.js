const STORAGE_KEYS = {
	todos: 'morningChecklistItems',
	theme: 'morningChecklistTheme',
	completedOpen: 'morningChecklistCompletedOpen',
}

const LEGACY_TODO_KEY = 'todos'
const DEFAULT_MESSAGE = '下の候補をタップすると、すぐに追加できます。'

let todos = []
let editingTodoId = null
let completedOpen = false
let messageTimerId = null
let storageMessage = ''

const myDate = document.getElementById('date')
const myDay = document.getElementById('day')
const todoForm = document.getElementById('todo-form')
const itemInput = document.getElementById('enter-task')
const todoList = document.getElementById('todo-list')
const completedList = document.getElementById('completed-todo-list-items')
const clearAllBtn = document.getElementById('clear-all-btn')
const taskCounter = document.getElementById('task_counter')
const appreciation = document.getElementById('appriciation')
const totalCount = document.getElementById('total-count')
const remainingCount = document.getElementById('remaining-count')
const progressPercentage = document.getElementById('progress-percentage')
const progressFill = document.getElementById('progress-fill')
const progressText = document.getElementById('progress-text')
const remainingSummary = document.getElementById('remaining-summary')
const activeEmpty = document.getElementById('active-empty')
const completedEmpty = document.getElementById('completed-empty')
const completedToggle = document.getElementById('completed-toggle')
const formMessage = document.getElementById('form-message')
const templateList = document.getElementById('template-list')
const themeToggle = document.getElementById('theme-toggle')
const themeToggleLabel = document.getElementById('theme-toggle-label')
const themeToggleIcon = document.getElementById('theme-toggle-icon')

init()

function init() {
	renderDate()
	todos = loadTodos()
	completedOpen = localStorage.getItem(STORAGE_KEYS.completedOpen) === 'true'
	applyTheme(localStorage.getItem(STORAGE_KEYS.theme) === 'dark')
	bindEvents()
	renderAll()

	if (storageMessage) {
		showMessage(storageMessage, 'error')
	} else {
		resetMessage()
	}
}

function bindEvents() {
	todoForm.addEventListener('submit', handleAddSubmit)
	templateList.addEventListener('click', handleTemplateClick)
	todoList.addEventListener('click', handleTodoAction)
	completedList.addEventListener('click', handleTodoAction)
	todoList.addEventListener('keydown', handleEditInputKeydown)
	clearAllBtn.addEventListener('click', clearAll)
	completedToggle.addEventListener('click', toggleCompletedVisibility)
	themeToggle.addEventListener('click', toggleTheme)
}

function renderDate() {
	const dayNames = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日']
	const today = new Date()

	myDate.textContent = `${today.getMonth() + 1}月${today.getDate()}日`
	myDay.textContent = dayNames[today.getDay()]
}

function loadTodos() {
	const storageCandidates = [STORAGE_KEYS.todos, LEGACY_TODO_KEY]

	for (const key of storageCandidates) {
		const storedValue = localStorage.getItem(key)

		if (!storedValue) {
			continue
		}

		try {
			const parsedTodos = JSON.parse(storedValue)

			if (!Array.isArray(parsedTodos)) {
				throw new Error(`${key} is not an array`)
			}

			const normalizedTodos = parsedTodos
				.map(normalizeTodo)
				.filter((todo) => todo.text)

			if (key === LEGACY_TODO_KEY) {
				persistTodos(normalizedTodos)
				localStorage.removeItem(LEGACY_TODO_KEY)
			}

			return normalizedTodos
		} catch (error) {
			console.error(`保存データ ${key} の読み込みに失敗しました。`, error)
			storageMessage = '保存データを読み込めなかったため、新しいリストで開始しました。'
			localStorage.removeItem(key)
		}
	}

	return []
}

function normalizeTodo(todo) {
	const text = normalizeText(
		typeof todo.text === 'string'
			? todo.text
			: typeof todo.task === 'string'
				? todo.task
				: ''
	)

	const isCompleted = Boolean(todo.isCompleted ?? todo.completed)
	const createdAt = Number.isFinite(Number(todo.createdAt)) ? Number(todo.createdAt) : Date.now()
	const completedAt = Number.isFinite(Number(todo.completedAt)) ? Number(todo.completedAt) : null

	return {
		id: typeof todo.id === 'string' || typeof todo.id === 'number' ? String(todo.id) : createId(),
		text,
		isCompleted,
		isImportant: Boolean(todo.isImportant ?? todo.important),
		createdAt,
		completedAt: isCompleted ? completedAt ?? createdAt : null,
	}
}

function handleAddSubmit(event) {
	event.preventDefault()
	addTodo(itemInput.value)
}

function handleTemplateClick(event) {
	const button = event.target.closest('.template-btn')

	if (!button) {
		return
	}

	addTodo(button.dataset.template || '')
}

function handleTodoAction(event) {
	const actionButton = event.target.closest('button[data-action]')

	if (!actionButton) {
		return
	}

	const { action, id } = actionButton.dataset
	const todo = findTodoById(id)

	if (!todo) {
		return
	}

	if (action === 'toggle-important') {
		updateTodo(id, (currentTodo) => ({
			...currentTodo,
			isImportant: !currentTodo.isImportant,
		}))
		return
	}

	if (action === 'edit') {
		editingTodoId = id
		renderAll()
		focusEditInput()
		return
	}

	if (action === 'save') {
		saveEditedTodo(id)
		return
	}

	if (action === 'cancel') {
		editingTodoId = null
		renderAll()
		resetMessage()
		return
	}

	if (action === 'complete') {
		updateTodo(id, (currentTodo) => ({
			...currentTodo,
			isCompleted: true,
			completedAt: Date.now(),
		}))
		showMessage(`「${todo.text}」を確認済みにしました。`, 'success')
		return
	}

	if (action === 'restore') {
		updateTodo(id, (currentTodo) => ({
			...currentTodo,
			isCompleted: false,
			completedAt: null,
		}))
		showMessage(`「${todo.text}」を未確認に戻しました。`, 'info')
		return
	}

	if (action === 'delete') {
		deleteTodo(id)
	}
}

function handleEditInputKeydown(event) {
	if (!event.target.classList.contains('todo-edit-input')) {
		return
	}

	if (event.key === 'Enter') {
		event.preventDefault()
		saveEditedTodo(event.target.dataset.editInputId)
	}

	if (event.key === 'Escape') {
		editingTodoId = null
		renderAll()
		resetMessage()
	}
}

function addTodo(rawText) {
	const text = normalizeText(rawText)

	if (!text) {
		showMessage('チェック項目を入力してください。', 'error')
		itemInput.focus()
		return
	}

	if (hasDuplicateText(text)) {
		showMessage('同じ項目がすでにあります。', 'error')
		itemInput.focus()
		return
	}

	todos = [
		...todos,
		{
			id: createId(),
			text,
			isCompleted: false,
			isImportant: false,
			createdAt: Date.now(),
			completedAt: null,
		},
	]

	itemInput.value = ''
	editingTodoId = null
	persistTodos(todos)
	renderAll()
	showMessage(`「${text}」を追加しました。`, 'success')
	itemInput.focus()
}

function saveEditedTodo(id) {
	const input = document.querySelector(`input[data-edit-input-id="${id}"]`)

	if (!input) {
		return
	}

	const updatedText = normalizeText(input.value)

	if (!updatedText) {
		showMessage('項目名を空にはできません。', 'error')
		input.focus()
		return
	}

	if (hasDuplicateText(updatedText, id)) {
		showMessage('同じ項目名がすでにあります。', 'error')
		input.focus()
		return
	}

	editingTodoId = null
	updateTodo(id, (todo) => ({
		...todo,
		text: updatedText,
	}))
	showMessage(`「${updatedText}」に更新しました。`, 'success')
}

function updateTodo(id, updateFn) {
	todos = todos.map((todo) => {
		if (todo.id !== id) {
			return todo
		}

		return updateFn(todo)
	})

	persistTodos(todos)
	renderAll()
}

function deleteTodo(id) {
	const todo = findTodoById(id)

	if (!todo) {
		return
	}

	todos = todos.filter((currentTodo) => currentTodo.id !== id)

	if (editingTodoId === id) {
		editingTodoId = null
	}

	persistTodos(todos)
	renderAll()
	showMessage(`「${todo.text}」を削除しました。`, 'info')
}

function clearAll() {
	if (!todos.length) {
		return
	}

	const confirmed = window.confirm('すべてのチェック項目を削除しますか？')

	if (!confirmed) {
		return
	}

	todos = []
	editingTodoId = null
	persistTodos(todos)
	renderAll()
	showMessage('チェック項目をリセットしました。', 'success')
}

function toggleCompletedVisibility() {
	completedOpen = !completedOpen
	localStorage.setItem(STORAGE_KEYS.completedOpen, String(completedOpen))
	renderCompletedSection(getCompletedTodos())
}

function toggleTheme() {
	const nextDarkMode = !document.body.classList.contains('dark-mode')
	applyTheme(nextDarkMode)
	localStorage.setItem(STORAGE_KEYS.theme, nextDarkMode ? 'dark' : 'light')
}

function applyTheme(isDarkMode) {
	document.body.classList.toggle('dark-mode', isDarkMode)
	themeToggle.setAttribute('aria-pressed', String(isDarkMode))
	themeToggleLabel.textContent = isDarkMode ? '明るい表示' : '夜向け表示'
	themeToggleIcon.textContent = isDarkMode ? '☀️' : '🌙'
}

function renderAll() {
	const activeTodos = getActiveTodos()
	const completedTodos = getCompletedTodos()

	renderTodoList(todoList, activeTodos)
	renderTodoList(completedList, completedTodos)
	renderSummary(activeTodos, completedTodos)
	renderCompletedSection(completedTodos)

	activeEmpty.classList.toggle('hide', activeTodos.length > 0)
	clearAllBtn.disabled = todos.length === 0
	appreciation.classList.toggle('hide', !(todos.length > 0 && activeTodos.length === 0))
}

function renderTodoList(listElement, todoItems) {
	listElement.innerHTML = ''

	todoItems.forEach((todo) => {
		listElement.appendChild(createTodoCard(todo))
	})
}

function renderSummary(activeTodos, completedTodos) {
	const totalTodos = todos.length
	const remainingTodos = activeTodos.length
	const completedCount = completedTodos.length
	const progress = totalTodos === 0 ? 0 : Math.round((completedCount / totalTodos) * 100)

	totalCount.textContent = `${totalTodos}件`
	remainingCount.textContent = `${remainingTodos}件`
	progressPercentage.textContent = `${progress}%`
	progressFill.style.width = `${progress}%`
	taskCounter.textContent = `${completedCount} / ${totalTodos}`

	if (totalTodos === 0) {
		progressText.textContent = 'まずは忘れやすい持ち物を追加しましょう。'
		remainingSummary.textContent = '項目を追加して、出発前チェックを始めましょう。'
		return
	}

	if (remainingTodos === 0) {
		progressText.textContent = 'すべて確認済みです。忘れ物なしで出発できます。'
		remainingSummary.textContent = 'すべて確認できました。気持ちよく出発できます。'
		return
	}

	progressText.textContent = `あと${remainingTodos}件確認すると準備完了です。`
	remainingSummary.textContent = `優先度の高いものから、あと${remainingTodos}件確認しましょう。`
}

function renderCompletedSection(completedTodos) {
	completedToggle.setAttribute('aria-expanded', String(completedOpen))
	completedList.hidden = !completedOpen
	completedEmpty.classList.toggle('hide', !completedOpen || completedTodos.length > 0)
}

function createTodoCard(todo) {
	const todoCard = document.createElement('article')
	todoCard.className = 'todo'

	if (todo.isCompleted) {
		todoCard.classList.add('todo--completed')
	}

	if (todo.isImportant && !todo.isCompleted) {
		todoCard.classList.add('todo--important')
	}

	const content = document.createElement('div')
	content.className = 'todo-content'

	if (editingTodoId === todo.id && !todo.isCompleted) {
		const editInput = document.createElement('input')
		editInput.type = 'text'
		editInput.value = todo.text
		editInput.maxLength = 40
		editInput.className = 'todo-edit-input'
		editInput.dataset.editInputId = todo.id

		const helpText = document.createElement('p')
		helpText.className = 'todo-note'
		helpText.textContent = 'Enter で保存 / Esc でキャンセル'

		content.appendChild(editInput)
		content.appendChild(helpText)
	} else {
		const titleRow = document.createElement('div')
		titleRow.className = 'todo-title-row'

		const title = document.createElement('p')
		title.className = 'todo-text'
		title.textContent = todo.text
		titleRow.appendChild(title)

		if (todo.isImportant && !todo.isCompleted) {
			const badge = document.createElement('span')
			badge.className = 'todo-badge'
			badge.textContent = '優先'
			titleRow.appendChild(badge)
		}

		const note = document.createElement('p')
		note.className = 'todo-note'
		note.textContent = todo.isCompleted
			? '確認済みの項目です'
			: todo.isImportant
				? '優先して確認したい項目です'
				: 'まだ確認していない項目です'

		content.appendChild(titleRow)
		content.appendChild(note)
	}

	const actions = document.createElement('div')
	actions.className = 'btn-container'

	getActionButtons(todo).forEach((button) => {
		actions.appendChild(button)
	})

	todoCard.appendChild(content)
	todoCard.appendChild(actions)

	return todoCard
}

function getActionButtons(todo) {
	if (editingTodoId === todo.id && !todo.isCompleted) {
		return [
			createActionButton(todo.id, 'save', '保存', 'action-btn--save'),
			createActionButton(todo.id, 'cancel', 'キャンセル', 'action-btn--neutral'),
		]
	}

	if (todo.isCompleted) {
		return [
			createActionButton(todo.id, 'restore', '未確認に戻す', 'action-btn--restore'),
			createActionButton(todo.id, 'delete', '削除', 'action-btn--delete'),
		]
	}

	return [
		createActionButton(todo.id, 'toggle-important', todo.isImportant ? '★ 重要' : '☆ 重要', 'action-btn--important'),
		createActionButton(todo.id, 'edit', '編集', 'action-btn--edit'),
		createActionButton(todo.id, 'complete', '確認済み', 'action-btn--complete'),
		createActionButton(todo.id, 'delete', '削除', 'action-btn--delete'),
	]
}

function createActionButton(id, action, label, className) {
	const button = document.createElement('button')
	button.type = 'button'
	button.className = `action-btn ${className}`
	button.dataset.id = id
	button.dataset.action = action
	button.textContent = label
	return button
}

function getActiveTodos() {
	return todos
		.filter((todo) => !todo.isCompleted)
		.sort((firstTodo, secondTodo) => {
			if (firstTodo.isImportant !== secondTodo.isImportant) {
				return Number(secondTodo.isImportant) - Number(firstTodo.isImportant)
			}

			return firstTodo.createdAt - secondTodo.createdAt
		})
}

function getCompletedTodos() {
	return todos
		.filter((todo) => todo.isCompleted)
		.sort((firstTodo, secondTodo) => (secondTodo.completedAt || 0) - (firstTodo.completedAt || 0))
}

function persistTodos(nextTodos) {
	localStorage.setItem(STORAGE_KEYS.todos, JSON.stringify(nextTodos))
}

function findTodoById(id) {
	return todos.find((todo) => todo.id === id)
}

function hasDuplicateText(text, ignoredId = '') {
	const normalizedTarget = normalizeForComparison(text)

	return todos.some((todo) => todo.id !== ignoredId && normalizeForComparison(todo.text) === normalizedTarget)
}

function normalizeText(text) {
	return text.replace(/\s+/g, ' ').trim()
}

function normalizeForComparison(text) {
	return normalizeText(text).toLocaleLowerCase('ja-JP')
}

function createId() {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function focusEditInput() {
	window.requestAnimationFrame(() => {
		const input = document.querySelector(`input[data-edit-input-id="${editingTodoId}"]`)

		if (!input) {
			return
		}

		input.focus()
		input.select()
	})
}

function showMessage(message, state = 'info') {
	formMessage.textContent = message
	formMessage.dataset.state = state

	if (messageTimerId) {
		window.clearTimeout(messageTimerId)
	}

	if (message !== DEFAULT_MESSAGE) {
		messageTimerId = window.setTimeout(() => {
			resetMessage()
		}, 2600)
	}
}

function resetMessage() {
	if (messageTimerId) {
		window.clearTimeout(messageTimerId)
	}

	messageTimerId = null
	formMessage.textContent = DEFAULT_MESSAGE
	formMessage.dataset.state = 'info'
}
