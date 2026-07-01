---
name: switchaccount
description: Global Codex account switcher skill powered by codex-auth. Use when the user invokes SwitchAccount or $switchaccount, asks to switch Codex accounts, wants guided setup for multiple Codex accounts, or needs help with Codex Desktop reload behavior after switching accounts.
---

# SwitchAccount

Switch Codex between saved `codex-auth` account snapshots without printing, editing, or inspecting token contents.

## Preconditions

- `codex-auth` must be installed globally: `npm i -g codex-auth`.
- Account labels must be one word: letters, numbers, dots, underscores, or dashes.
- Account labels are chosen by the user. Do not assume any personal names.

## Interpret Invocation

- `SwitchAccount setup`: ask the user for a one-word label for the account currently logged into Codex.
- `SwitchAccount setup <label>`: save the currently logged-in account as `<label>`.
- `SwitchAccount` with no words: switch immediately if exactly two accounts are saved.
- `SwitchAccount <label>`: switch to the saved account named `<label>`.
- If more than two accounts are saved and no label was provided, list the saved labels and ask which one to switch to.

## Setup Workflow

Use setup only when the user confirms the account currently visible in Codex is the account they want to save.

1. If no label was provided, ask: "What one-word label should I use for the account you are currently logged into?"
2. Run `node <skill-dir>/scripts/switch-account.mjs setup <label>`.
3. Report the saved labels from the output.
4. Tell the user: log out of Codex, log into the second account, return to this same chat, then run `SwitchAccount setup <second-label>`.
5. After the second account is saved, tell the user future switches should use `SwitchAccount` and do not require manual login.

## Switch Workflow

1. If the user provided a target label, run `node <skill-dir>/scripts/switch-account.mjs switch <label>`.
2. If the user provided no target label, run `node <skill-dir>/scripts/switch-account.mjs switch`.
3. If the helper says more than two accounts are saved, show the labels and ask which label to switch to.
4. After a successful switch, tell the user to fully quit Codex Desktop, including the Windows tray icon, then reopen Codex. The account should load from the switched `~/.codex/auth.json`.

## Safety Rules

- Do not print, paste, commit, or summarize `~/.codex/auth.json` or files under `~/.codex/accounts/`.
- Do not run `codex-auth save <label>` unless the user confirms the currently logged-in account matches that label.
- Do not claim the visible Codex Desktop session changed until the user confirms it after restart.
- Treat `codex-auth use <label>` as a disk-level auth-file swap, not an in-memory app-session switch.
