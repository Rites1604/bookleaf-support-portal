#!/usr/bin/env node
/**
 * Saves the Neon connection string on your clipboard into .env.
 *
 * Copy either Neon string (pooled or direct) and run:  npm run db:save-neon
 * Neon's pooled host is the direct host with "-pooler" after the endpoint id, so the
 * script derives the other one and writes both DATABASE_URL (pooled) and DIRECT_URL (direct).
 * The previous .env is kept as .env.backup. Secrets are never printed.
 */
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const ENV_FILE = ".env";

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

// Neon's dialog sometimes copies "psql 'postgresql://…'" or an env line; pull out just the URL.
const findUrl = (s) => s.match(/postgres(?:ql)?:\/\/[^\s'"]+/);

/** Reads a line from the terminal without echoing it, so the password doesn't end up on screen. */
async function promptHidden(question) {
  const { createInterface } = await import("node:readline");
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  rl._writeToOutput = (s) => {
    if (s.startsWith(question)) process.stdout.write(s);
  };
  const answer = await new Promise((resolve) => rl.question(question, resolve));
  rl.close();
  process.stdout.write("\n");
  return answer;
}

let raw = process.argv[2] ?? "";
if (!raw) {
  try {
    raw = execSync("pbpaste", { encoding: "utf8" });
  } catch {
    raw = "";
  }
}
if (!findUrl(raw)) {
  if (!process.stdin.isTTY) fail("No postgres:// connection string on the clipboard. Copy it from Neon → Connect and try again.");
  console.log("No connection string found on the clipboard.");
  raw = await promptHidden("Paste the Neon connection string (input hidden) and press Enter: ");
}
const match = findUrl(raw);
if (!match) fail("That isn't a postgres:// connection string. Copy it from Neon → Connect and try again.");

let url;
try {
  url = new URL(match[0]);
} catch {
  fail("The copied connection string isn't a valid URL.");
}
if (!url.hostname.endsWith(".neon.tech")) fail(`Host "${url.hostname}" doesn't look like a Neon database.`);
if (!url.password) fail("The connection string has no password. In Neon's Connect dialog, reveal the password before copying.");
if (!url.searchParams.has("sslmode")) url.searchParams.set("sslmode", "require");

const [endpoint, ...rest] = url.hostname.split(".");
const directEndpoint = endpoint.replace(/-pooler$/, "");
const withHost = (ep) => {
  const u = new URL(url);
  u.hostname = [ep, ...rest].join(".");
  return u.toString();
};
const pooled = withHost(`${directEndpoint}-pooler`);
const direct = withHost(directEndpoint);

let env = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
if (env) copyFileSync(ENV_FILE, ".env.backup");

function setVar(name, value) {
  const line = `${name}="${value}"`;
  const re = new RegExp(`^${name}=.*$`, "m");
  env = re.test(env) ? env.replace(re, line) : `${env.trimEnd()}\n${line}\n`;
}
setVar("DATABASE_URL", pooled);
setVar("DIRECT_URL", direct);
writeFileSync(ENV_FILE, env, { mode: 0o600 });

const mask = (s) => s.replace(/\/\/([^:]+):[^@]+@/, "//$1:••••@");
console.log("✓ Saved to .env (previous version in .env.backup)");
console.log(`  DATABASE_URL  ${mask(pooled)}`);
console.log(`  DIRECT_URL    ${mask(direct)}`);
console.log("\nNext: npx prisma migrate deploy && npm run db:seed");
