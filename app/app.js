/**
 * @file Tiny vanilla-JS todo app under test.
 *
 * No framework, no build step. All state lives in the {@link state} object;
 * every mutation is followed by a single {@link render} call that rebuilds
 * the visible portion of the DOM. The simplicity is deliberate — the demo's
 * point is the Playwright MCP validator, not the app being validated.
 *
 * For the benefit of external validators, the read-only mirror
 * `window.__APP__.getState()` exposes a JSON-cloned snapshot of state so
 * tests can assert without scraping the DOM.
 */

/**
 * Shape of a single todo item.
 *
 * @typedef {object} Todo
 * @property {string}  id    UUID assigned by `crypto.randomUUID()`.
 * @property {string}  text  Visible label, with leading/trailing whitespace
 *                           trimmed at insertion time.
 * @property {boolean} done  Completion flag.
 */

/**
 * Filter modes recognised by the UI.
 *
 * @typedef {"all" | "active" | "done"} Filter
 */

/**
 * Top-level reactive state. Always read or write through this object —
 * never through DOM-stored values.
 *
 * @type {{ user: string | null, todos: Todo[], filter: Filter }}
 */
const state = {
  user: null,
  todos: [],
  filter: "all",
};

/**
 * `document.querySelector` shorthand.
 *
 * @param {string} sel
 * @returns {Element | null}
 */
const $ = (sel) => document.querySelector(sel);

const loginView = $("#login-view");
const todoView = $("#todo-view");

/**
 * Synchronise the DOM with the current {@link state}.
 *
 * This is intentionally a full re-render of the visible regions — there's
 * not enough state for incremental updates to matter, and the simpler
 * approach makes the app easier to reason about from the outside.
 *
 * @returns {void}
 */
function render() {
  loginView.hidden = !!state.user;
  todoView.hidden = !state.user;
  if (!state.user) return;

  $("#who").textContent = state.user;

  const list = $("#todo-list");
  list.innerHTML = "";
  const visible = state.todos.filter((t) =>
    state.filter === "all" ? true : state.filter === "done" ? t.done : !t.done
  );
  for (const todo of visible) {
    const li = document.createElement("li");
    li.dataset.id = todo.id;
    if (todo.done) li.classList.add("done");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = todo.done;
    cb.setAttribute("aria-label", `Mark "${todo.text}" complete`);
    cb.addEventListener("change", () => toggle(todo.id));

    const text = document.createElement("span");
    text.textContent = todo.text;

    const rm = document.createElement("button");
    rm.className = "remove";
    rm.textContent = "Remove";
    rm.setAttribute("aria-label", `Remove "${todo.text}"`);
    rm.addEventListener("click", () => remove(todo.id));

    li.append(cb, text, rm);
    list.append(li);
  }

  const remaining = state.todos.filter((t) => !t.done).length;
  $("#count").textContent = `${remaining} item${remaining === 1 ? "" : "s"} left`;

  for (const b of document.querySelectorAll("#filters button")) {
    b.classList.toggle("active", b.dataset.filter === state.filter);
  }
}

/**
 * Append a new todo. Empty or whitespace-only input is ignored.
 *
 * @param {string} text
 * @returns {void}
 */
function add(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  state.todos.push({ id: crypto.randomUUID(), text: trimmed, done: false });
  render();
}

/**
 * Flip the `done` flag of a single todo. No-op if the id isn't found.
 *
 * @param {string} id
 * @returns {void}
 */
function toggle(id) {
  const t = state.todos.find((x) => x.id === id);
  if (t) t.done = !t.done;
  render();
}

/**
 * Drop a todo from the list. No-op if the id isn't found.
 *
 * @param {string} id
 * @returns {void}
 */
function remove(id) {
  state.todos = state.todos.filter((x) => x.id !== id);
  render();
}

/**
 * Remove every completed todo in one shot.
 *
 * @returns {void}
 */
function clearDone() {
  state.todos = state.todos.filter((t) => !t.done);
  render();
}

/**
 * Hard-coded credentials check. DEMO ONLY — never do this in real software.
 *
 * @param {string} user
 * @param {string} pass
 * @returns {boolean}
 */
function authenticate(user, pass) {
  return user === "demo" && pass === "demo";
}

$("#login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const u = $("#username").value.trim();
  const p = $("#password").value;
  const err = $("#login-error");
  if (authenticate(u, p)) {
    state.user = u;
    err.hidden = true;
    err.textContent = "";
    render();
  } else {
    err.textContent = "Invalid username or password";
    err.hidden = false;
  }
});

$("#logout").addEventListener("click", () => {
  state.user = null;
  state.todos = [];
  state.filter = "all";
  $("#username").value = "";
  $("#password").value = "";
  render();
});

$("#add-form").addEventListener("submit", (e) => {
  e.preventDefault();
  add($("#new-todo").value);
  $("#new-todo").value = "";
});

for (const b of document.querySelectorAll("#filters button")) {
  b.addEventListener("click", () => {
    state.filter = b.dataset.filter;
    render();
  });
}

$("#clear-done").addEventListener("click", clearDone);

/**
 * Read-only mirror exposed for external validators (Playwright, e2e tests,
 * manual debugging in DevTools). The returned object is a deep JSON clone so
 * mutations by callers cannot corrupt the real {@link state}.
 *
 * @type {{ getState: () => { user: string | null, todos: Todo[], filter: Filter } }}
 */
window.__APP__ = {
  getState: () => JSON.parse(JSON.stringify(state)),
};

render();
