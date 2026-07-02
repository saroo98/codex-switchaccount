#!/usr/bin/env node
import { chmodSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(fileURLToPath(import.meta.url));
const source = join(repoRoot, "switchaccount");
const codexHome = process.env.CODEX_HOME || join(homedir(), ".codex");
const destination = join(codexHome, "skills", "switchaccount");

if (!existsSync(source)) {
  console.error(`Skill source not found: ${source}`);
  process.exit(1);
}

mkdirSync(dirname(destination), { recursive: true });
rmSync(destination, { recursive: true, force: true });
cpSync(source, destination, { recursive: true });

function getNpmGlobalBin() {
  const npmCommand = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npm";
  const npmArgs =
    process.platform === "win32"
      ? ["/d", "/s", "/c", "npm", "config", "get", "prefix"]
      : ["config", "get", "prefix"];
  const result = spawnSync(npmCommand, npmArgs, {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    return null;
  }

  const prefix = result.stdout.trim();
  if (!prefix) {
    return null;
  }

  return process.platform === "win32" ? prefix : join(prefix, "bin");
}

function installLauncher() {
  const globalBin = getNpmGlobalBin();
  if (!globalBin) {
    console.log("Could not locate npm global bin; skipping terminal launcher install.");
    return;
  }

  mkdirSync(globalBin, { recursive: true });
  const scriptPath = join(destination, "scripts", "switch-account.mjs");

  if (process.platform === "win32") {
    const cmdLauncher = [
      "@echo off",
      `node "${scriptPath}" %*`,
      "exit /b %ERRORLEVEL%",
      "",
    ].join("\r\n");
    const psScriptPath = scriptPath.replaceAll("'", "''");
    const powershellLauncher = [
      "#!/usr/bin/env pwsh",
      `$script = '${psScriptPath}'`,
      "& node $script @args",
      "exit $LASTEXITCODE",
      "",
    ].join("\n");

    writeFileSync(join(globalBin, "SwitchAccount.cmd"), cmdLauncher, "utf8");
    writeFileSync(join(globalBin, "switchaccount.cmd"), cmdLauncher, "utf8");
    writeFileSync(join(globalBin, "SwitchAccount.ps1"), powershellLauncher, "utf8");
    writeFileSync(join(globalBin, "switchaccount.ps1"), powershellLauncher, "utf8");
    console.log(`Installed terminal launchers to ${globalBin}`);
    return;
  }

  const launcherPath = join(globalBin, "switchaccount");
  const escapedScriptPath = scriptPath.replaceAll("'", "'\\''");
  writeFileSync(
    launcherPath,
    ["#!/usr/bin/env sh", `exec node '${escapedScriptPath}' "$@"`, ""].join("\n"),
    "utf8",
  );
  chmodSync(launcherPath, 0o755);
  console.log(`Installed terminal launcher to ${launcherPath}`);
}

installLauncher();

console.log(`Installed SwitchAccount skill to ${resolve(destination)}`);
console.log("Restart Codex or open a new Codex window so the skill list refreshes.");
console.log("If Codex chat is blocked by usage limits, run SwitchAccount from PowerShell or your terminal.");
