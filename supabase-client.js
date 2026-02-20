const STORAGE_KEYS = {
  session: "rega_session",
  mockBlockedSites: "rega_mock_blocked_sites",
  mockFocusSession: "rega_mock_focus_session"
};

const DEFAULT_MOCK_BLOCKLIST = [
  "reddit.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "instagram.com",
  "youtube.com"
];

const MOCK_AUTH_DELAY_MS = 150;
const MOCK_SYNC_DELAY_MS = 80;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeDomain(rawDomain) {
  return String(rawDomain || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

function buildMockSession(email) {
  const now = Date.now();
  return {
    accessToken: `mock-token-${now}`,
    expiresAt: now + 7 * 24 * 60 * 60 * 1000,
    user: {
      id: `mock-user-${email.toLowerCase()}`,
      email
    }
  };
}

// Sprint 2: replace this mock auth flow with Supabase Auth API calls.
export async function login(email, password) {
  const safeEmail = String(email || "").trim().toLowerCase();
  const safePassword = String(password || "");

  if (!safeEmail || !safePassword) {
    throw new Error("Email and password are required.");
  }

  await delay(MOCK_AUTH_DELAY_MS);
  const session = buildMockSession(safeEmail);

  const { [STORAGE_KEYS.mockBlockedSites]: existingBlocklist } =
    await chrome.storage.local.get(STORAGE_KEYS.mockBlockedSites);

  const mergedBlocklist = [...new Set([...(existingBlocklist || []), ...DEFAULT_MOCK_BLOCKLIST]
    .map(normalizeDomain)
    .filter(Boolean))];

  await chrome.storage.local.set({
    [STORAGE_KEYS.session]: session,
    [STORAGE_KEYS.mockBlockedSites]: mergedBlocklist,
    [STORAGE_KEYS.mockFocusSession]: false
  });

  return session;
}

// Sprint 2: replace with Supabase signOut.
export async function logout() {
  await chrome.storage.local.remove(STORAGE_KEYS.session);
}

export async function getSession() {
  const { [STORAGE_KEYS.session]: session } = await chrome.storage.local.get(
    STORAGE_KEYS.session
  );
  return session || null;
}

// Sprint 2: read users.blocked_sites from Supabase.
export async function fetchBlocklist() {
  await delay(MOCK_SYNC_DELAY_MS);
  const { [STORAGE_KEYS.mockBlockedSites]: sites } = await chrome.storage.local.get(
    STORAGE_KEYS.mockBlockedSites
  );

  const normalized = [...new Set([...(sites || []), ...DEFAULT_MOCK_BLOCKLIST]
    .map(normalizeDomain)
    .filter(Boolean))];

  return normalized;
}

// Sprint 2: read users.is_in_focus_session from Supabase.
export async function checkFocusStatus() {
  await delay(MOCK_SYNC_DELAY_MS);
  const { [STORAGE_KEYS.mockFocusSession]: isInFocusSession } =
    await chrome.storage.local.get(STORAGE_KEYS.mockFocusSession);
  return Boolean(isInFocusSession);
}

// Sprint 2: write accountability events to Supabase.
export async function logEvent(eventType, metadata = {}) {
  // eslint-disable-next-line no-console
  console.info("Sprint 1 mock event log:", { eventType, metadata, at: Date.now() });
}

export async function setMockFocusSession(enabled) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.mockFocusSession]: Boolean(enabled)
  });
}

export async function getMockFocusSession() {
  const { [STORAGE_KEYS.mockFocusSession]: value } = await chrome.storage.local.get(
    STORAGE_KEYS.mockFocusSession
  );
  return Boolean(value);
}

export async function setMockBlocklist(domains) {
  const clean = (domains || []).map(normalizeDomain).filter(Boolean);
  await chrome.storage.local.set({
    [STORAGE_KEYS.mockBlockedSites]: [...new Set(clean)]
  });
}
