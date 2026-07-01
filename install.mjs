#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
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

console.log(`Installed SwitchAccount skill to ${resolve(destination)}`);
console.log("Restart Codex or open a new Codex window so the skill list refreshes.");
