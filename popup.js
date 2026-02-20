const ACTIONS = {
  login: "REGA_LOGIN",
  logout: "REGA_LOGOUT",
  getState: "REGA_GET_STATE",
  setManualEnabled: "REGA_SET_MANUAL_ENABLED"
};

const els = {
  loginView: document.querySelector("#login-view"),
  dashboardView: document.querySelector("#dashboard-view"),
  loginForm: document.querySelector("#login-form"),
  email: document.querySelector("#email"),
  password: document.querySelector("#password"),
  focusOrb: document.querySelector("#focus-orb"),
  detailsToggle: document.querySelector("#details-toggle"),
  menuPanel: document.querySelector("#menu-panel"),
  logoutBtn: document.querySelector("#logout-btn"),
  error: document.querySelector("#error")
};

let currentState = null;
let menuOpen = false;

function setError(message = "") {
  els.error.textContent = message;
  els.error.classList.toggle("hidden", !message);
}

function setMenuOpen(isOpen) {
  menuOpen = Boolean(isOpen);
  els.detailsToggle.setAttribute("aria-expanded", String(menuOpen));
  els.menuPanel.setAttribute("aria-hidden", String(!menuOpen));
  els.menuPanel.classList.toggle("hidden", !menuOpen);
  els.menuPanel.classList.toggle("open", menuOpen);
}

async function sendAction(action, payload = {}) {
  const response = await chrome.runtime.sendMessage({ action, ...payload });
  if (!response?.ok) {
    throw new Error(response?.error || "Unknown extension error");
  }
  return response.state;
}


async function getTargetTabId() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tabs[0]?.id ?? null;
}

function renderState(state) {
  currentState = state;
  const isLoggedIn = Boolean(state?.isLoggedIn);

  els.loginView.classList.toggle("hidden", isLoggedIn);
  els.dashboardView.classList.toggle("hidden", !isLoggedIn);

  if (!isLoggedIn) {
    setMenuOpen(false);
    return;
  }

  const isActive = Boolean(state.blockingActive || state.manualEnabled);
  els.dashboardView.dataset.active = isActive ? "true" : "false";
  els.focusOrb.setAttribute("aria-pressed", String(Boolean(state.manualEnabled)));
}

async function refreshState() {
  const state = await sendAction(ACTIONS.getState);
  renderState(state);
}

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setError("");

  try {
    const state = await sendAction(ACTIONS.login, {
      email: els.email.value,
      password: els.password.value
    });
    els.password.value = "";
    renderState(state);
  } catch (error) {
    setError(error.message);
  }
});

els.focusOrb.addEventListener("click", async () => {
  if (!currentState?.isLoggedIn) return;

  setError("");
  const tabId = await getTargetTabId();

  try {
    const state = await sendAction(ACTIONS.setManualEnabled, {
      enabled: !Boolean(currentState.manualEnabled),
      tabId
    });
    renderState(state);
  } catch (error) {
    setError(error.message);
  }
});

els.detailsToggle.addEventListener("click", () => {
  setMenuOpen(!menuOpen);
});

els.logoutBtn.addEventListener("click", async () => {
  setError("");
  try {
    const state = await sendAction(ACTIONS.logout);
    renderState(state);
  } catch (error) {
    setError(error.message);
  }
});

document.addEventListener("click", (event) => {
  if (!menuOpen) return;

  const target = event.target;
  if (els.menuPanel.contains(target) || els.detailsToggle.contains(target)) {
    return;
  }

  setMenuOpen(false);
});

void refreshState().catch((error) => {
  setError(error.message);
});
