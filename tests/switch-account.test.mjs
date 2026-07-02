import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(import.meta.dirname, "..");
const scriptPath = join(repoRoot, "switchaccount", "scripts", "switch-account.mjs");

function writeFakeAuthFiles(rootDir, authFiles) {
  const authDir = join(rootDir, "codex-auth-home");
  const accountsDir = join(authDir, "accounts");
  mkdirSync(accountsDir, { recursive: true });

  writeFileSync(join(authDir, "auth.json"), authFiles.active, "utf8");
  for (const [account, contents] of Object.entries(authFiles.accounts ?? {})) {
    writeFileSync(join(accountsDir, `${account}.json`), contents, "utf8");
  }

  return authDir;
}

function makeFakeCodexAuth({
  current = "Alpha",
  list = "* Alpha\n  Beta\n",
  includeCodexAuth = true,
  authFiles,
} = {}) {
  const dir = mkdtempSync(join(tmpdir(), "switchaccount-test-"));
  const binDir = join(dir, "bin");
  mkdirSync(binDir);
  const callsPath = join(dir, "calls.txt");
  const authDir = authFiles ? writeFakeAuthFiles(dir, authFiles) : join(dir, "missing-auth-home");

  if (!includeCodexAuth) {
    return { authDir, binDir, callsPath };
  }

  if (process.platform === "win32") {
    writeFileSync(
      join(binDir, "codex-auth.cmd"),
      [
        "@echo off",
        `echo %*>>"${callsPath}"`,
        "if \"%1\"==\"current\" (",
        `  echo ${current}`,
        "  exit /b 0",
        ")",
        "if \"%1\"==\"list\" (",
        ...list.split("\n").map((line) => `  echo ${line}`),
        "  exit /b 0",
        ")",
        "if \"%1\"==\"use\" (",
        "  echo Switched Codex auth to \"%2\".",
        "  exit /b 0",
        ")",
        "if \"%1\"==\"save\" (",
        "  echo Saved current Codex auth tokens as \"%2\".",
        "  exit /b 0",
        ")",
        "exit /b 1",
        ""
      ].join("\r\n"),
      "utf8",
    );
  } else {
    writeFileSync(
      join(binDir, "codex-auth"),
      [
        "#!/usr/bin/env sh",
        `printf '%s\\n' "$*" >> '${callsPath}'`,
        "case \"$1\" in",
        `  current) printf '%s\\n' '${current}'; exit 0 ;;`,
        "  list)",
        ...list.split("\n").map((line) => `    printf '%s\\n' '${line}'`),
        "    exit 0 ;;",
        "  use) printf 'Switched Codex auth to \"%s\".\\n' \"$2\"; exit 0 ;;",
        "  save) printf 'Saved current Codex auth tokens as \"%s\".\\n' \"$2\"; exit 0 ;;",
        "esac",
        "exit 1",
        ""
      ].join("\n"),
      { mode: 0o755 },
    );
  }

  return { authDir, binDir, callsPath };
}

function runSwitchAccount(args = [], fakeOptions = {}) {
  const fake = makeFakeCodexAuth(fakeOptions);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH:
        fakeOptions.includeCodexAuth === false
          ? fake.binDir
          : `${fake.binDir}${delimiter}${process.env.PATH ?? ""}`,
      CODEX_AUTH_DIR: fake.authDir,
    },
  });

  let calls = "";
  try {
    calls = readFileSync(fake.callsPath, "utf8");
  } catch {
    calls = "";
  }

  return { ...result, calls };
}

test("without a target, switches from the current account to the other saved account", () => {
  const result = runSwitchAccount([], {
    current: "Alpha",
    list: "* Alpha\n  Beta\n",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Switched Codex auth to "Beta"\./);
  assert.match(result.stdout, /Windows tray/i);
  assert.match(result.calls, /^current\r?\nlist\r?\nsave Alpha\r?\nuse Beta/m);
});

test("before switching, refreshes the current saved account snapshot", () => {
  const result = runSwitchAccount(["switch", "Beta"], {
    current: "Alpha",
    list: "* Alpha\n  Beta\n",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.calls, /save Alpha\r?\nuse Beta/);
});

test("does not rewrite the current snapshot when auth.json already matches it", () => {
  const result = runSwitchAccount(["switch", "Beta"], {
    current: "Alpha",
    list: "* Alpha\n  Beta\n",
    authFiles: {
      active: "{\"account\":\"alpha\"}",
      accounts: {
        Alpha: "{\"account\":\"alpha\"}",
        Beta: "{\"account\":\"beta\"}",
      },
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Switched Codex auth to "Beta"\./);
  assert.doesNotMatch(result.calls, /save Alpha/);
  assert.match(result.calls, /use Beta/);
});

test("refuses to refresh a current label when auth.json matches a different saved account", () => {
  const result = runSwitchAccount(["switch", "Beta"], {
    current: "Alpha",
    list: "* Alpha\n  Beta\n",
    authFiles: {
      active: "{\"account\":\"beta\"}",
      accounts: {
        Alpha: "{\"account\":\"alpha\"}",
        Beta: "{\"account\":\"beta\"}",
      },
    },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing to refresh "Alpha"/);
  assert.match(result.stderr, /matches saved account "Beta"/);
  assert.doesNotMatch(result.calls, /save Alpha/);
  assert.doesNotMatch(result.calls, /use Beta/);
});

test("setup saves the requested current-account label and explains the next login step", () => {
  const result = runSwitchAccount(["setup", "work"], {
    current: "No Codex account is active yet.",
    list: "  work\n",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Saved current Codex auth tokens as "work"\./);
  assert.match(result.stdout, /log out of Codex, log into the next account/i);
  assert.match(result.calls, /save work/);
  assert.match(result.calls, /list/);
});

test("with a target, switches to the requested saved account", () => {
  const result = runSwitchAccount(["Gamma"], {
    current: "Alpha",
    list: "* Alpha\n  Beta\n  Gamma\n",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Switched Codex auth to "Gamma"\./);
  assert.match(result.calls, /use Gamma/);
});

test("with a target, matches saved account labels case-insensitively", () => {
  const result = runSwitchAccount(["gamma"], {
    current: "Alpha",
    list: "* Alpha\n  Beta\n  Gamma\n",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Switched Codex auth to "Gamma"\./);
  assert.match(result.calls, /use Gamma/);
});

test("without a target, matches the current account label case-insensitively", () => {
  const result = runSwitchAccount([], {
    current: "alpha",
    list: "* Alpha\n  Beta\n",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Switched Codex auth to "Beta"\./);
  assert.match(result.calls, /^current\r?\nlist\r?\nsave Alpha\r?\nuse Beta/m);
});

test("sync command mode saves the canonical saved account label when current label casing differs", () => {
  const result = runSwitchAccount(["sync"], {
    current: "alpha",
    list: "* Alpha\n  Beta\n",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Saved current Codex auth tokens as "Alpha"\./);
  assert.match(result.calls, /^current\r?\nlist\r?\nsave Alpha/m);
});

test("refuses ambiguous case-insensitive account labels", () => {
  const result = runSwitchAccount(["GAMMA"], {
    current: "Alpha",
    list: "* Alpha\n  Gamma\n  gamma\n",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /matches multiple saved accounts/);
  assert.doesNotMatch(result.calls, /use /);
});

test("switch command mode switches to the requested saved account", () => {
  const result = runSwitchAccount(["switch", "Beta"], {
    current: "Alpha",
    list: "* Alpha\n  Beta\n",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Switched Codex auth to "Beta"\./);
  assert.match(result.calls, /use Beta/);
});

test("list command mode prints saved accounts and the current account", () => {
  const result = runSwitchAccount(["list"], {
    current: "Alpha",
    list: "* Alpha\n  Beta\n",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Saved Codex accounts: Alpha, Beta/);
  assert.match(result.stdout, /Current account: Alpha/);
  assert.doesNotMatch(result.calls, /use /);
});

test("sync command mode refreshes the current saved account snapshot", () => {
  const result = runSwitchAccount(["sync"], {
    current: "Alpha",
    list: "* Alpha\n  Beta\n",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Saved current Codex auth tokens as "Alpha"\./);
  assert.match(result.calls, /^current\r?\nlist\r?\nsave Alpha/m);
  assert.doesNotMatch(result.calls, /use /);
});

test("sync command mode reports when the current saved account is already up to date", () => {
  const result = runSwitchAccount(["sync"], {
    current: "Alpha",
    list: "* Alpha\n  Beta\n",
    authFiles: {
      active: "{\"account\":\"alpha\"}",
      accounts: {
        Alpha: "{\"account\":\"alpha\"}",
        Beta: "{\"account\":\"beta\"}",
      },
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /already up to date/);
  assert.doesNotMatch(result.calls, /save Alpha/);
  assert.doesNotMatch(result.calls, /use /);
});

test("refuses to switch to an account that is not saved", () => {
  const result = runSwitchAccount(["Missing"], {
    current: "Alpha",
    list: "* Alpha\n  Beta\n",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Account "Missing" is not saved/);
  assert.doesNotMatch(result.calls, /use Missing/);
});

test("requires an explicit target when more than two accounts are saved", () => {
  const result = runSwitchAccount([], {
    current: "Alpha",
    list: "* Alpha\n  Beta\n  Gamma\n",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /More than two accounts are saved/);
  assert.match(result.stderr, /Alpha, Beta, Gamma/);
  assert.doesNotMatch(result.calls, /use /);
});

test("rejects invalid account labels before calling codex-auth", () => {
  const result = runSwitchAccount(["bad label"], {
    current: "Alpha",
    list: "* Alpha\n  Beta\n",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid account name "bad label"/);
  assert.equal(result.calls, "");
});

test("prints install guidance when codex-auth is missing", () => {
  const result = runSwitchAccount([], {
    includeCodexAuth: false,
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /codex-auth was not found/);
  assert.match(result.stderr, /npm i -g codex-auth/);
});
