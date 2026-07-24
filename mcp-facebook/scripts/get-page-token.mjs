#!/usr/bin/env node
// One-shot helper: exchanges a short-lived User Access Token (from Graph API Explorer) for a
// long-lived one, fetches the Pages that user administers, and writes META_PAGE_ID +
// META_ACCESS_TOKEN into ../.env. Re-run this any time the page token stops working (see README).
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
const GRAPH = "https://graph.facebook.com/v21.0";

const shortLivedToken = process.argv[2];
if (!shortLivedToken) {
  console.error("Usage: node scripts/get-page-token.mjs <short-lived-user-access-token>");
  console.error("Get that token from https://developers.facebook.com/tools/explorer/");
  console.error("(select your app -> Get Token -> Get User Access Token -> pick the page permissions).");
  process.exit(1);
}

const appId = process.env.META_APP_ID;
const appSecret = process.env.META_APP_SECRET;
if (!appId || !appSecret) {
  console.error("Set META_APP_ID and META_APP_SECRET in mcp-facebook/.env first (App Dashboard > Settings > Basic).");
  process.exit(1);
}

function setEnvVar(content, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(content)) return content.replace(re, line);
  return (content.length && !content.endsWith("\n") ? content + "\n" : content) + line + "\n";
}

async function graphGet(url) {
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json;
}

async function main() {
  const exchangeUrl =
    `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token` +
    `&client_id=${encodeURIComponent(appId)}` +
    `&client_secret=${encodeURIComponent(appSecret)}` +
    `&fb_exchange_token=${encodeURIComponent(shortLivedToken)}`;
  const exchanged = await graphGet(exchangeUrl);
  const longLivedToken = exchanged.access_token;
  const days = exchanged.expires_in ? Math.round(exchanged.expires_in / 86400) : "unknown";
  console.log(`Exchanged for a long-lived user token (expires in ~${days} days).`);

  const pagesUrl =
    `${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account` +
    `&access_token=${encodeURIComponent(longLivedToken)}`;
  const pagesJson = await graphGet(pagesUrl);
  const pages = pagesJson.data || [];
  if (pages.length === 0) {
    console.error("No pages found for this user. Make sure the logged-in account is an admin of the Facebook Page.");
    process.exit(1);
  }

  console.log(`\nFound ${pages.length} page(s):`);
  pages.forEach((p, i) => console.log(`  [${i}] ${p.name}  (id: ${p.id})`));

  const target =
    pages.length === 1 ? pages[0] : pages.find((p) => /gateverse|جيت\s*فيرس/i.test(p.name)) || pages[0];
  console.log(`\n-> Using "${target.name}" (id: ${target.id}).`);
  if (pages.length > 1 && target !== pages[0]) {
    console.log("   (Picked by name match. Edit .env by hand if you meant a different page.)");
  }

  let envContent = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  envContent = setEnvVar(envContent, "META_PAGE_ID", target.id);
  envContent = setEnvVar(envContent, "META_ACCESS_TOKEN", target.access_token);
  const written = ["META_PAGE_ID", "META_ACCESS_TOKEN"];

  if (target.instagram_business_account?.id) {
    envContent = setEnvVar(envContent, "META_IG_USER_ID", target.instagram_business_account.id);
    written.push("META_IG_USER_ID");
    console.log(`Linked Instagram account found: ${target.instagram_business_account.id}`);
  } else {
    console.log("No Instagram professional account linked to this Page — META_IG_USER_ID left blank.");
    console.log("Link one in Meta Business Suite if you want the Instagram tools to work.");
  }

  writeFileSync(envPath, envContent);
  console.log(`\nWrote ${written.join(", ")} to ${envPath}`);
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
