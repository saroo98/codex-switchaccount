#!/usr/bin/env node
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const codexHome = process.env.CODEX_HOME || join(homedir(), ".codex");
const validator = join(
  codexHome,
  "skills",
  ".system",
  "skill-creator",
  "scripts",
  "quick_validate.py",
);

if (!existsSync(validator)) {
  console.error(`Codex skill validator not found at ${validator}`);
  console.error("Run validation from a Codex environment with the skill-creator system skill installed.");
  process.exit(1);
}

const result = spawnSync("python", [validator, "switchaccount"], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
