#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const ACCOUNT_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function runCodexAuth(args) {
  const result = spawnSync("codex-auth", args, {
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  if (result.error?.code === "ENOENT") {
    return {
      status: 127,
      stdout: "",
      stderr: "codex-auth was not found. Install it with: npm i -g codex-auth\n",
    };
  }

  const combinedOutput = `${result.stderr ?? ""}${result.stdout ?? ""}`;
  if (
    result.status !== 0 &&
    /codex-auth.*(not recognized|not found)|cannot find.*codex-auth/i.test(combinedOutput)
  ) {
    return {
      status: 127,
      stdout: "",
      stderr: "codex-auth was not found. Install it with: npm i -g codex-auth\n",
    };
  }

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function parseCurrentName(output) {
  const trimmed = output.trim();
  if (!trimmed || trimmed === "No Codex account is active yet.") {
    return null;
  }

  return trimmed;
}

function parseAccountList(output) {
  const accounts = [];

  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^\*?\s*(?<name>[A-Za-z0-9][A-Za-z0-9._-]*)$/);
    if (match?.groups?.name) {
      accounts.push(match.groups.name);
    }
  }

  return [...new Set(accounts)].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

function assertSafeAccountName(name) {
  if (!ACCOUNT_NAME_PATTERN.test(name)) {
    throw new Error(
      `Invalid account name "${name}". Use letters, numbers, dots, underscores, or dashes.`,
    );
  }
}

function chooseTarget({ requestedAccount, currentAccount, savedAccounts }) {
  if (requestedAccount) {
    assertSafeAccountName(requestedAccount);
    if (!savedAccounts.includes(requestedAccount)) {
      throw new Error(
        `Account "${requestedAccount}" is not saved. Log into it once, then run: codex-auth save ${requestedAccount}`,
      );
    }

    return requestedAccount;
  }

  if (savedAccounts.length < 2) {
    throw new Error(
      "At least two saved accounts are required. Save each account once with: codex-auth save <name>",
    );
  }

  if (savedAccounts.length > 2) {
    throw new Error(
      `More than two accounts are saved (${savedAccounts.join(", ")}). Run this skill with an explicit account name.`,
    );
  }

  if (!currentAccount || !savedAccounts.includes(currentAccount)) {
    throw new Error(
      `Current account is not one of the saved accounts (${savedAccounts.join(", ")}). Run this skill with an explicit account name.`,
    );
  }

  return savedAccounts.find((name) => name !== currentAccount);
}

function fail(message, status = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(status);
}

function printSavedAccounts(savedAccounts) {
  if (!savedAccounts.length) {
    process.stdout.write("No saved Codex accounts found.\n");
    return;
  }

  process.stdout.write(`Saved Codex accounts: ${savedAccounts.join(", ")}\n`);
}

function readCurrentAndSavedAccounts() {
  const currentResult = runCodexAuth(["current"]);
  if (currentResult.status !== 0) {
    fail(currentResult.stderr || currentResult.stdout || "Unable to read current Codex account.");
  }

  const listResult = runCodexAuth(["list"]);
  if (listResult.status !== 0) {
    fail(listResult.stderr || listResult.stdout || "Unable to list saved Codex accounts.");
  }

  const currentAccount = parseCurrentName(currentResult.stdout);
  const savedAccounts = parseAccountList(listResult.stdout);
  return { currentAccount, savedAccounts };
}

function setupAccount(label) {
  if (!label) {
    fail("Usage: node switch-account.mjs setup <one-word-account-label>");
  }

  try {
    assertSafeAccountName(label);
  } catch (error) {
    fail(error.message);
  }

  const saveResult = runCodexAuth(["save", label]);
  process.stdout.write(saveResult.stdout);
  process.stderr.write(saveResult.stderr);
  if (saveResult.status !== 0) {
    process.exit(saveResult.status);
  }

  const listResult = runCodexAuth(["list"]);
  if (listResult.status === 0) {
    printSavedAccounts(parseAccountList(listResult.stdout));
  }

  process.stdout.write(
    "Next: log out of Codex, log into the next account, return to this chat, and run SwitchAccount setup with a different one-word label.\n",
  );
}

function switchAccount(requestedAccount) {
  if (requestedAccount) {
    try {
      assertSafeAccountName(requestedAccount);
    } catch (error) {
      fail(error.message);
    }
  }

  const { currentAccount, savedAccounts } = readCurrentAndSavedAccounts();

  let target;
  try {
    target = chooseTarget({ requestedAccount, currentAccount, savedAccounts });
  } catch (error) {
    fail(error.message);
  }

  const useResult = runCodexAuth(["use", target]);
  process.stdout.write(useResult.stdout);
  process.stderr.write(useResult.stderr);

  if (useResult.status === 0) {
    process.stdout.write(
      "Next: fully quit Codex Desktop, including the Windows tray icon, then reopen Codex so it reloads auth.json.\n",
    );
  }

  process.exit(useResult.status);
}

function listAccounts() {
  const { currentAccount, savedAccounts } = readCurrentAndSavedAccounts();
  printSavedAccounts(savedAccounts);
  if (currentAccount) {
    process.stdout.write(`Current account: ${currentAccount}\n`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const [commandOrAccount, maybeAccount] = args;

  if (args.length > 2) {
    fail("Usage: node switch-account.mjs [setup <label> | switch [account-name] | list | account-name]");
  }

  if (commandOrAccount === "setup") {
    setupAccount(maybeAccount);
    return;
  }

  if (commandOrAccount === "switch") {
    switchAccount(maybeAccount);
    return;
  }

  if (commandOrAccount === "list") {
    if (maybeAccount) {
      fail("Usage: node switch-account.mjs list");
    }
    listAccounts();
    return;
  }

  switchAccount(commandOrAccount);
}

main();
