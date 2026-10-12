#!/usr/bin/env node
/*
 * Give one of your customers a Themis workspace from the terminal.
 *
 *   node scripts/provision.mjs --email owner@example.com --business "Tenmile Lodge" \
 *       [--name "Jane Doe"] [--type general] [--site https://tenmilelodge.com] [--site staging.tenmilelodge.com]
 *   node scripts/provision.mjs --lookup owner@example.com
 *
 * Needs THEMIS_PARTNER_SECRET and THEMIS_PARTNER_NAME in the environment
 * (or in .env next to this file). Idempotent: running it again for the same
 * owner prints the same key and emails nothing. Prints the publishable key,
 * which goes into the customer's site as THEMIS_API_KEY.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Minimal .env loader so the script has no dependencies.
try {
  for (const line of readFileSync(resolve(import.meta.dirname, "..", ".env"), "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
} catch {
  /* no .env file; rely on the environment */
}

const THEMIS_URL = (process.env.THEMIS_URL || "https://themis.altitudemountainscaling.com").replace(/\/$/, "");
const SECRET = process.env.THEMIS_PARTNER_SECRET;
const PARTNER = (process.env.THEMIS_PARTNER_NAME || "").trim();

const TYPES = ["real_estate", "mortgage", "insurance", "home_services", "fitness", "beauty", "legal", "medical", "auto", "agency", "coaching", "general"];

function parse(argv) {
  const out = { sites: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const k = a.slice(2);
    const v = argv[i + 1];
    if (k === "site") out.sites.push(v), i++;
    else if (v && !v.startsWith("--")) out[k] = v, i++;
    else out[k] = true;
  }
  return out;
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

async function partner(path, init = {}) {
  const res = await fetch(`${THEMIS_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) fail(`Themis responded ${res.status}${body.error ? `: ${body.error}` : ""}`);
  return body;
}

const args = parse(process.argv.slice(2));
if (!SECRET) fail("THEMIS_PARTNER_SECRET is not set. Ask Altitude Mountain Scaling for a partner secret.");

if (args.lookup) {
  const email = typeof args.lookup === "string" ? args.lookup : args.email;
  if (!email) fail("Usage: --lookup owner@example.com");
  const data = await partner(`/api/partner/account?email=${encodeURIComponent(email)}`);
  if (!data.exists) console.log(`No workspace for ${email}.`);
  else console.log(`Workspace exists for ${data.email}.\nTHEMIS_API_KEY=${data.apiKey ?? "(no key yet; run provision to issue one)"}`);
  process.exit(0);
}

if (!args.email || !args.business) {
  fail('Usage: node scripts/provision.mjs --email owner@example.com --business "Business Name" [--name "Owner Name"] [--type general] [--site https://example.com]');
}
if (!PARTNER) fail("THEMIS_PARTNER_NAME is not set; it names your agency in the owner's welcome email.");
if (args.type && !TYPES.includes(args.type)) fail(`--type must be one of: ${TYPES.join(", ")}`);

const data = await partner("/api/partner/provision", {
  method: "POST",
  body: JSON.stringify({
    email: args.email,
    name: args.name || args.business,
    business: args.business,
    partner: PARTNER,
    origins: args.sites,
    ...(args.type ? { businessType: args.type } : {}),
  }),
});

console.log(data.created ? `Created a workspace for ${data.email}.` : `${data.email} already had a workspace.`);
if (data.emailed) console.log("The owner was emailed a one-time sign-in link.");
if (data.allowedOrigins?.length) console.log(`Browser allowlist: ${data.allowedOrigins.join(", ")}`);
console.log(`\nTHEMIS_API_KEY=${data.apiKey}`);
