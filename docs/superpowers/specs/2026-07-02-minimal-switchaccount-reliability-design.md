# Minimal SwitchAccount Reliability Design

## Summary

SwitchAccount should stay intentionally small. The reliability model is:

- provide a terminal fallback for times when Codex chat is blocked
- always sync the currently active account before switching away

No background sync, scheduled task, doctor command, stale-age warning, or automatic account rotation will be added in this scope.

## Goals

- Reduce stale saved snapshots by syncing the active account immediately before every switch.
- Let users switch from PowerShell, Command Prompt, or a normal terminal when Codex chat cannot send messages.
- Keep the workflow simple: users run `SwitchAccount <label>` or `/SwitchAccount <label>`.
- Avoid behavior that silently swaps accounts or runs maintenance in the background.

## Non-Goals

- Do not create or refresh server-issued tokens without an interactive Codex login.
- Do not guarantee that refresh tokens cannot be revoked server-side.
- Do not add a Windows Scheduled Task.
- Do not add a background process, daemon, watcher, or timer.
- Do not add `doctor`, stale-age checks, snapshot expiry warnings, or automatic account rotation.
- Do not inspect, print, or commit auth token contents.

## User Workflow

When Codex chat works:

```text
/SwitchAccount work
```

When Codex chat is blocked:

```powershell
SwitchAccount work
```

In both cases, the helper first syncs the currently active account snapshot if `auth.json` changed, then switches to the requested saved account.

After a successful switch, the user still fully quits Codex Desktop, including the Windows tray icon, and reopens it so Codex reloads `auth.json`.

## Behavior

### Terminal Fallback

The installer writes terminal launchers:

- Windows: `SwitchAccount.ps1`, `SwitchAccount.cmd`, `switchaccount.ps1`, `switchaccount.cmd`
- macOS/Linux: `switchaccount`

These launchers call the installed skill helper script directly. They are intended only as an out-of-chat fallback and should not add separate behavior.

### Sync Before Switch

Before any switch, the helper:

1. reads the current label from `codex-auth current`
2. reads saved labels from `codex-auth list`
3. verifies the current label is saved
4. compares `auth.json` against saved snapshots by hash only
5. if `auth.json` already matches the current saved snapshot, skips saving
6. if `auth.json` matches a different saved snapshot, refuses to switch to avoid overwriting the wrong label
7. otherwise runs `codex-auth save <current-label>`
8. runs `codex-auth use <target-label>`

This keeps local snapshots fresher without trying to control server-side session policy.

## Error Handling

If `codex-auth` is missing, print the install command:

```powershell
npm i -g codex-auth
```

If the requested target is not saved, fail before switching.

If local auth state appears mismatched, fail before saving or switching and tell the user to run explicit setup after logging into the intended account.

If Codex later reports a revoked refresh token or expired session, explain that manual login is required because the server rejected the saved refresh token.

## Documentation Changes

Docs should emphasize only the supported minimal workflow:

- `/SwitchAccount <label>` when chat works
- `SwitchAccount <label>` when chat is blocked
- sync happens automatically before switching
- users normally do not need to run `sync` manually

Docs should avoid recommending scheduled reminders, background automation, doctor checks, or automatic rotation.

## Testing

Tests should cover:

- switch calls `save <current>` before `use <target>` when `auth.json` changed
- switch skips save when `auth.json` already matches the current saved snapshot
- switch refuses when `auth.json` matches a different saved snapshot
- terminal launcher install writes PowerShell and CMD launchers on Windows
- missing `codex-auth` prints install guidance
- invalid labels fail before `codex-auth` is called

## Privacy

The implementation must never print token values or commit auth snapshots. Tests may use fake placeholder JSON only.
