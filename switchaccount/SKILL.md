---
name: switchaccount
description: Global Codex account switcher skill powered by codex-auth. Use when the user invokes SwitchAccount or $switchaccount, asks to switch Codex accounts, wants guided setup for multiple Codex accounts, or needs help with Codex Desktop reload behavior after switching accounts.
---

# SwitchAccount

Switch Codex between saved `codex-auth` account snapshots without printing, editing, or inspecting token contents.

## Preconditions

- `codex-auth` must be installed globally: `npm i -g codex-auth`.
- Account labels must be one word: letters, numbers, dots, underscores, or dashes.
- Switching is case-insensitive, but the helper preserves the saved label casing when it calls `codex-auth`.
- Account labels are chosen by the user. Do not assume any personal names.

## Interpret Invocation

- `SwitchAccount setup`: ask the user for a one-word label for the account currently logged into Codex.
- `SwitchAccount setup <label>`: save the currently logged-in account as `<label>`.
- `SwitchAccount` with no words: switch immediately if exactly two accounts are saved.
- `SwitchAccount <label>`: switch to the saved account named `<label>`.
- `SwitchAccount sync`: refresh the saved snapshot for the currently active account without switching.
- If more than two accounts are saved and no label was provided, list the saved labels and ask which one to switch to.

## Setup Workflow

Use setup only when the user confirms the account currently visible in Codex is the account they want to save.

1. If no label was provided, ask: "What one-word label should I use for the account you are currently logged into?"
2. Run `node <skill-dir>/scripts/switch-account.mjs setup <label>`.
3. Report the saved labels from the output.
4. Tell the user: log out of Codex, log into the second account, return to this same chat, then run `SwitchAccount setup <second-label>`.
5. After the second account is saved, tell the user future switches should use `SwitchAccount` and do not require manual login.

## Switch Workflow

1. Explain that the helper refreshes the current account snapshot before switching when `auth.json` has changed, then swaps `~/.codex/auth.json` to the selected saved snapshot.
2. If the user provided a target label, run `node <skill-dir>/scripts/switch-account.mjs switch <label>`.
3. If the user provided no target label, run `node <skill-dir>/scripts/switch-account.mjs switch`.
4. If the helper says more than two accounts are saved, show the labels and ask which label to switch to.
5. After a successful switch, tell the user to fully quit Codex Desktop, including the Windows tray icon, then reopen Codex. The account should load from the switched `~/.codex/auth.json`.

## Sync Workflow

Use this after the user manually logs into an account and wants to refresh the saved snapshot for that same account.

1. Confirm the visible Codex session is the account label they want refreshed.
2. Run `node <skill-dir>/scripts/switch-account.mjs sync`.
3. Report that the current account snapshot was refreshed.

## Usage-Limit Or Expired-Session Recovery

If Codex chat is blocked by a usage limit, the slash command cannot run because the user cannot send a message. Tell the user to run the installed terminal launcher outside Codex:

- Windows PowerShell or Command Prompt: `SwitchAccount <label>` or `SwitchAccount`
- macOS/Linux terminal: `switchaccount <label>` or `switchaccount`

The terminal launcher is global after install. The user does not need to `cd` into the repo. `SwitchAccount`, `switchAccount`, and `switchaccount` should be treated as equivalent command spellings.

If Codex reports that a refresh token was revoked or the Codex session expired after switching, treat the target saved snapshot as invalid. `codex-auth` swaps JSON files on disk and does not validate refresh tokens with the server. A revoked target snapshot cannot be fixed by copying JSON again.

Recovery steps:

1. Tell the user to log into the failing target account manually once.
2. After login succeeds, run `SwitchAccount setup <label>` or `SwitchAccount sync` to save the fresh current session under the correct label.
3. Prefer `SwitchAccount setup <label>` if the user manually copied JSON or if the active label might not match the visible Codex account.

## Safety Rules

- Do not print, paste, commit, or summarize `~/.codex/auth.json` or files under `~/.codex/accounts/`.
- Do not run `codex-auth save <label>` unless the user confirms the currently logged-in account matches that label.
- Do not claim the visible Codex Desktop session changed until the user confirms it after restart.
- Treat `codex-auth use <label>` as a disk-level auth-file swap, not an in-memory app-session switch.
- Do not claim an old saved snapshot is valid; server-side refresh-token revocation can only be fixed by logging into that account again.
- If auth state was manually edited or copied, prefer explicit `setup <label>` over `sync` so the saved label is not inferred incorrectly.
