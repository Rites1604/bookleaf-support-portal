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

let raw;
try {
  raw = execSync("pbpaste", { encoding: "utf8" });
} catch {
  fail("Could not read the clipboard (this script uses macOS pbpaste).");
}

// Neon's dialog sometimes copies "psql 'postgresql://…'" or an env line; pull out just the URL.
const match = raw.match(/postgres(?:ql)?:\/\/[^\s'"]+/);
if (!match) fail("The clipboard doesn't contain a postgres:// connection string. Copy it from Neon → Connect and try again.");

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
