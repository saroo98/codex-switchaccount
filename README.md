# Codex Account Switcher Skill

SwitchAccount is a global Codex skill for switching between multiple Codex
accounts from the Codex `/` skill picker. You will be able to switch between your accounts only with the /SwitchAccount command. The skill wraps
[`codex-auth`](https://github.com/Sls0n/codex-account-switcher), saves named
Codex account snapshots, and switches `~/.codex/auth.json` without exposing
tokens.

Keywords: Codex account switcher, SwitchAccount Codex skill, multiple Codex
accounts, OpenAI Codex Desktop account switch, codex-auth skill, Windows Codex
account switching.

## Fast Install

```sh
npm i -g codex-auth
git clone https://github.com/saroo98/codex-switchaccount.git
cd codex-switchaccount
npm run install-skill
```

Restart Codex after installing so `SwitchAccount` appears globally in the `/`
skill picker for every chat and project.

The installer also adds a terminal command named `SwitchAccount` on Windows and
`switchaccount` on macOS/Linux. Use it from PowerShell, Command Prompt, or a
normal terminal if Codex chat is blocked by a usage limit.

## First-Time Setup

1. Log into your first Codex account.
2. Invoke `SwitchAccount setup` from the Codex `/` picker.
3. When Codex asks, choose a one-word label such as `work` or `personal`.
4. Codex saves the current account with `codex-auth save <label>`.
5. Log out of Codex, log into your second account, return to the same chat, and
   run `SwitchAccount setup` again with a different label.

After two accounts are saved, manual login is no longer part of the normal
switching flow.

## Switching Accounts

With exactly two saved accounts, invoke:

```text
/SwitchAccount
```

The skill switches to the other saved account immediately. Then fully quit Codex
Desktop, including the Windows tray icon, and reopen Codex. The reopened app
should load the switched account.

To switch to a specific saved account:

```text
/SwitchAccount work
```

Or, if Codex chat cannot accept messages because your usage limit is reached:

```powershell
SwitchAccount work
```

With three or more saved accounts, invoking `SwitchAccount` without a target
lists the saved labels and asks which account to switch to.

Before every switch, the helper refreshes the currently active saved snapshot
with `codex-auth save <current-label>` when `auth.json` has changed. This
reduces stale snapshots caused by token rotation while you were using that
account.

If the helper detects that `auth.json` exactly matches a different saved account
than the active label reported by `codex-auth current`, it refuses to refresh the
current label. This avoids overwriting a good saved account after manual JSON
copying.

## Command Helper

The skill uses this helper internally:

```sh
node switchaccount/scripts/switch-account.mjs setup <label>
node switchaccount/scripts/switch-account.mjs switch [label]
node switchaccount/scripts/switch-account.mjs list
node switchaccount/scripts/switch-account.mjs sync
```

Labels must be one word and may contain letters, numbers, dots, underscores, or
dashes.

Use `sync` after a successful manual login if you want to refresh the saved
snapshot for the currently active account without switching.

## Privacy And Security

This repository does not include account snapshots, tokens, local paths, emails,
screenshots, or personal account names.

The skill must never print or commit:

- `~/.codex/auth.json`
- `~/.codex/accounts/*.json`
- OpenAI API keys
- GitHub tokens
- browser cookies or local credentials

## Troubleshooting

If Codex still shows the old account after switching, fully quit Codex Desktop
from the Windows tray and reopen it. `codex-auth` swaps the auth file on disk;
Codex Desktop may keep the previous session in memory until restart.

If Codex says the refresh token was revoked or the session expired after a
switch, the saved snapshot for that target account is no longer valid on the
server. JSON copying cannot repair a revoked refresh token. Log into that target
account manually once, then refresh its saved snapshot:

```powershell
SwitchAccount setup work
```

If the current account is valid and you only want to refresh its saved snapshot:

```powershell
SwitchAccount sync
```

Use `SwitchAccount setup <label>` instead of `sync` if you manually copied JSON
or if the active label might not match the account currently logged into Codex.

If Codex chat is blocked by a five-hour, weekly, or similar usage limit, run the
terminal command instead of the slash command:

```powershell
SwitchAccount
SwitchAccount work
```

Then fully quit Codex Desktop, including the Windows tray icon, and reopen it.

If `codex-auth` is missing:

```sh
npm i -g codex-auth
```

If more than two accounts are saved, specify a label:

```text
/SwitchAccount personal
```

## Development

```sh
npm test
npm run validate:skill
```
