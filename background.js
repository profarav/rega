import {
  checkFocusStatus,
  fetchBlocklist,
  getSession,
  getMockFocusSession,
  logEvent,
  login,
  logout,
  setMockFocusSession
} from "./supabase-client.js";

const ACTIONS = {
  login: "REGA_LOGIN",
  logout: "REGA_LOGOUT",
  getState: "REGA_GET_STATE",
  setManualEnabled: "REGA_SET_MANUAL_ENABLED",
  setMockFocus: "REGA_SET_MOCK_FOCUS",
  refreshSync: "REGA_REFRESH_SYNC"
};

const STORAGE_KEYS = {
  blocklist: "rega_blocklist",
  manualEnabled: "rega_manual_enabled",
  focusSessionActive: "rega_focus_session_active",
  blockingActive: "rega_blocking_active",
  lastSyncAt: "rega_last_sync_at",
  sessionStartTime: "rega_session_start_time"
};

const POLL_ALARM = "rega-poll-sync";
const POLL_INTERVAL_MINUTES = 0.5; // 30 seconds

function normalizeDomain(rawDomain) {
  return String(rawDomain || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

function getHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch (_error) {
    return "";
  }
}

function isHttpUrl(url) {
  return /^https?:\/\//i.test(String(url || ""));
}

function isBlockedUrl(url, domains) {
  const hostname = getHostname(url);
  if (!hostname) return false;

  return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function toRule(domain, id) {
  return {
    id,
    priority: 1,
    action: {
      type: "redirect",
      redirect: { extensionPath: "/blocked.html" }
    },
    condition: {
      urlFilter: `||${domain}^`,
      resourceTypes: ["main_frame"]
    }
  };
}

async function ensureDefaults() {
  const current = await chrome.storage.local.get([
    STORAGE_KEYS.manualEnabled,
    STORAGE_KEYS.focusSessionActive,
    STORAGE_KEYS.blockingActive
  ]);

  await chrome.storage.local.set({
    [STORAGE_KEYS.manualEnabled]:
      typeof current[STORAGE_KEYS.manualEnabled] === "boolean"
        ? current[STORAGE_KEYS.manualEnabled]
        : false,
    [STORAGE_KEYS.focusSessionActive]:
      typeof current[STORAGE_KEYS.focusSessionActive] === "boolean"
        ? current[STORAGE_KEYS.focusSessionActive]
        : false,
    [STORAGE_KEYS.blockingActive]:
      typeof current[STORAGE_KEYS.blockingActive] === "boolean"
        ? current[STORAGE_KEYS.blockingActive]
        : false
  });
}

async function setBadge(isActive) {
  await chrome.action.setBadgeText({ text: "" });
  await chrome.action.setTitle({
    title: isActive ? "Rega blocking active" : "Rega blocking inactive"
  });
}

async function replaceDynamicRules(domains, isActive) {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map((rule) => rule.id);

  if (!isActive || domains.length === 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules: []
    });
    return;
  }

  const addRules = domains.slice(0, 2000).map((domain, index) => toRule(domain, index + 1));
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules
  });
}

async function enforceTabIfBlocked(tabId, url) {
  if (typeof tabId !== "number" || !isHttpUrl(url)) {
    return;
  }

  const state = await chrome.storage.local.get([
    STORAGE_KEYS.blocklist,
    STORAGE_KEYS.blockingActive
  ]);

  const blockingActive = Boolean(state[STORAGE_KEYS.blockingActive]);
  if (!blockingActive) {
    return;
  }

  const blocklist = (state[STORAGE_KEYS.blocklist] || [])
    .map(normalizeDomain)
    .filter(Boolean);

  if (!isBlockedUrl(url, blocklist)) {
    return;
  }

  try {
    await chrome.tabs.update(tabId, { url: chrome.runtime.getURL("blocked.html") });
  } catch (_error) {
    // Ignore tabs that cannot be redirected.
  }
}

async function enforceActiveTabIfBlocked() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const activeTab = tabs[0];

  if (!activeTab) {
    return;
  }

  await enforceTabIfBlocked(activeTab.id, activeTab.url || "");
}

async function applyBlockingState() {
  const state = await chrome.storage.local.get([
    STORAGE_KEYS.blocklist,
    STORAGE_KEYS.manualEnabled,
    STORAGE_KEYS.focusSessionActive,
    STORAGE_KEYS.blockingActive
  ]);

  const blocklist = (state[STORAGE_KEYS.blocklist] || [])
    .map(normalizeDomain)
    .filter(Boolean);
  const manualEnabled = Boolean(state[STORAGE_KEYS.manualEnabled]);
  const focusSessionActive = Boolean(state[STORAGE_KEYS.focusSessionActive]);
  const previousActive = Boolean(state[STORAGE_KEYS.blockingActive]);
  // Blocking is active either by manual toggle OR active focus session.
  const isActive = (manualEnabled || focusSessionActive) && blocklist.length > 0;

  await replaceDynamicRules(blocklist, isActive);
  await chrome.storage.local.set({ [STORAGE_KEYS.blockingActive]: isActive });
  await setBadge(isActive);

  if (isActive && (previousActive !== isActive || blocklist.length > 0)) {
    await enforceActiveTabIfBlocked();
  }
}

async function syncFromRemote() {
  const session = await getSession();
  if (!session) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.blocklist]: [],
      [STORAGE_KEYS.focusSessionActive]: false,
      [STORAGE_KEYS.lastSyncAt]: Date.now()
    });
    await applyBlockingState();
    return;
  }

  const [blocklist, focusSessionActive] = await Promise.all([
    fetchBlocklist(session),
    checkFocusStatus(session)
  ]);

  await chrome.storage.local.set({
    [STORAGE_KEYS.blocklist]: blocklist,
    [STORAGE_KEYS.focusSessionActive]: Boolean(focusSessionActive),
    [STORAGE_KEYS.lastSyncAt]: Date.now()
  });

  await applyBlockingState();
}

async function getUiState() {
  const [session, stored] = await Promise.all([
    getSession(),
    chrome.storage.local.get([
      STORAGE_KEYS.blocklist,
      STORAGE_KEYS.manualEnabled,
      STORAGE_KEYS.focusSessionActive,
      STORAGE_KEYS.blockingActive,
      STORAGE_KEYS.lastSyncAt,
      STORAGE_KEYS.sessionStartTime
    ])
  ]);

  const mockFocus = await getMockFocusSession();
  return {
    isLoggedIn: Boolean(session),
    userEmail: session?.user?.email || "",
    blocklist: stored[STORAGE_KEYS.blocklist] || [],
    manualEnabled: Boolean(stored[STORAGE_KEYS.manualEnabled]),
    focusSessionActive: Boolean(stored[STORAGE_KEYS.focusSessionActive]),
    blockingActive: Boolean(stored[STORAGE_KEYS.blockingActive]),
    mockFocusSession: Boolean(mockFocus),
    lastSyncAt: stored[STORAGE_KEYS.lastSyncAt] || null,
    sessionStartTime: stored[STORAGE_KEYS.sessionStartTime] || null
  };
}

async function init() {
  await ensureDefaults();
  chrome.alarms.create(POLL_ALARM, { periodInMinutes: POLL_INTERVAL_MINUTES });
  await syncFromRemote();
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.runtime.setUninstallURL("https://example.com/rega-extension-uninstall");
});

chrome.runtime.onStartup.addListener(() => {
  void init();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== POLL_ALARM) return;
  void syncFromRemote().catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error("Polling sync failed:", error);
    await logEvent("polling_failed", { message: String(error?.message || error) });
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const nextUrl = changeInfo.url || tab?.url;
  if (!nextUrl) {
    return;
  }

  void enforceTabIfBlocked(tabId, nextUrl);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const action = message?.action;

  (async () => {
    if (action === ACTIONS.getState) {
      sendResponse({ ok: true, state: await getUiState() });
      return;
    }

    if (action === ACTIONS.login) {
      await login(message.email, message.password);
      await syncFromRemote();
      await logEvent("login_success");
      sendResponse({ ok: true, state: await getUiState() });
      return;
    }

    if (action === ACTIONS.logout) {
      await logout();
      await syncFromRemote();
      await logEvent("logout");
      sendResponse({ ok: true, state: await getUiState() });
      return;
    }

    if (action === ACTIONS.setManualEnabled) {
      const enabling = Boolean(message.enabled);
      const update = { [STORAGE_KEYS.manualEnabled]: enabling };
      if (enabling) {
        const existing = await chrome.storage.local.get([STORAGE_KEYS.sessionStartTime]);
        if (!existing[STORAGE_KEYS.sessionStartTime]) {
          update[STORAGE_KEYS.sessionStartTime] = Date.now();
        }
      } else {
        update[STORAGE_KEYS.sessionStartTime] = null;
      }
      await chrome.storage.local.set(update);
      await applyBlockingState();

      if (typeof message.tabId === "number") {
        try {
          const tab = await chrome.tabs.get(message.tabId);
          await enforceTabIfBlocked(message.tabId, tab?.url || "");
        } catch (_error) {
          // Ignore if the tab is unavailable.
        }
      }

      await logEvent("manual_toggle", { enabled: Boolean(message.enabled) });
      sendResponse({ ok: true, state: await getUiState() });
      return;
    }

    if (action === ACTIONS.setMockFocus) {
      await setMockFocusSession(Boolean(message.enabled));
      await syncFromRemote();
      await logEvent("mock_focus_toggle", { enabled: Boolean(message.enabled) });
      sendResponse({ ok: true, state: await getUiState() });
      return;
    }

    if (action === ACTIONS.refreshSync) {
      await syncFromRemote();
      sendResponse({ ok: true, state: await getUiState() });
      return;
    }

    sendResponse({ ok: false, error: "Unknown action" });
  })().catch((error) => {
    sendResponse({ ok: false, error: String(error?.message || error) });
  });

  return true;
});

void init();
