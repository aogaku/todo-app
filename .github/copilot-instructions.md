# Copilot Instructions

## Project Overview

A vanilla JavaScript todo list SPA. No build system, no package manager, no test framework — dependencies are loaded via CDN. Open `index.html` directly in a browser to run it.

Live demo: https://vaishnav-sh.github.io/todo-app/

## Stack

- **HTML/CSS/JS** — no transpilation, no bundling
- **Bootstrap 4.6** (layout/responsiveness via CDN)
- **jQuery 3.5.1** (DOM helpers, `slideToggle` for completed list via CDN)
- **Font Awesome 4.7** (icons via CDN)

## Architecture

All logic lives in `src/index.js` (~320 lines). There is no module system.

- **State**: Two globals — `todos` (array of objects) and counters `task_count` / `task_completed_count`
- **Persistence**: `todos` array is serialized to `localStorage` as JSON on every mutation
- **Startup**: `getLocalTodos()` runs on `DOMContentLoaded` to hydrate state and render saved items
- **Event handling**: Delegated listeners on `#todo-list` and `#completed-todo-list` — handlers check `event.target` to route to `deleteCheck()`, `markAsImp()`, edit, or complete actions
- **DOM IDs**: Every todo item gets four associated element IDs using its index as a suffix: `todo-{n}`, `done-{n}`, `trash-{n}`, `imp-{n}`

## Key Conventions

- **JS naming**: camelCase for functions and variables (`addItem`, `markAsImp`, `task_count`)
- **HTML/CSS naming**: kebab-case for IDs and classes (`enter-task`, `add-btn`, `completed-todo-list`)
- **Todo object shape**: `{ id: Number, task: String, completed: Boolean, important: Boolean }`
- **UI sections**: Active todos render in `#todo-list`; completed todos move to `#completed-todo-list` (collapsible via jQuery `slideToggle`)
- **Dark mode**: Toggled by adding/removing the `dark` class on `<body>`; state is also saved in `localStorage`
- **No jQuery for logic** — jQuery is only used for the `slideToggle` animation; all other DOM work uses vanilla JS
