# Rega Chrome Extension (Sprint 1 MVP)

This repository contains a working Manifest V3 Chrome extension for Sprint 1 with mocked backend behavior.

## Included Files

- `manifest.json`: Extension config and permissions.
- `background.js`: Service worker for polling, sync, and dynamic blocking rules.
- `popup.html`, `popup.js`, `popup.css`: Login, toggles, blocklist, and logout UI.
- `blocked.html`: Redirect target page for blocked sites.
- `supabase-client.js`: Sprint 1 mock wrapper with clear Sprint 2 replacement points.

## Sprint 1 Behavior (Mocked)

- Login is required but mocked (no real Supabase call).
- Blocklist is hardcoded to common domains and stored in `chrome.storage.local`.
- Focus session state is mocked via the popup toggle (`Mock iOS Focus Session`).
- Polling runs every 30 seconds via `chrome.alarms`.
- Blocking applies with `chrome.declarativeNetRequest.updateDynamicRules()`.

## Sprint 2 TODOs

Replace mock implementations in `supabase-client.js`:

- `login()` -> Supabase Auth sign-in
- `logout()` -> Supabase Auth sign-out
- `fetchBlocklist()` -> `users.blocked_sites`
- `checkFocusStatus()` -> `users.is_in_focus_session`
- `logEvent()` -> accountability event writes

Also replace uninstall URL placeholder in `background.js` with a real Rega endpoint.

## Run Locally

1. Open Chrome: `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder: `/Users/aravlohe/Documents/New project`

