import { config as loadDotenv } from "dotenv";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolve .env next to this package regardless of the spawning process's cwd — Claude Code
// launches this server via `node mcp-facebook/src/index.js` from the repo root (see ../.mcp.json),
// and bare `dotenv/config` only looks in process.cwd(), which silently misses mcp-facebook/.env there.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.join(__dirname, "..", ".env") });

export const GRAPH_VERSION = "v25.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export class GraphConfigError extends Error {}

export class GraphApiError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "GraphApiError";
    this.details = details;
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new GraphConfigError(
      `${name} is not set. Copy mcp-facebook/.env.example to mcp-facebook/.env and fill it in ` +
        `(see mcp-facebook/README.md for how to get a Page Access Token).`,
    );
  }
  return value;
}

export function getPageId() {
  return requireEnv("META_PAGE_ID");
}

export function getIgUserId() {
  return requireEnv("META_IG_USER_ID");
}

function getAccessToken() {
  return requireEnv("META_ACCESS_TOKEN");
}

// Params travel as query-string args (the classic Graph API convention shown in Meta's own curl
// examples) even on POST/DELETE. `form` is for multipart file uploads; `json` is for endpoints
// (like the Messenger Send API) that are documented as taking a JSON request body.
async function request(path_, { method = "GET", params = {}, form, json } = {}) {
  const token = getAccessToken();
  const url = new URL(`${GRAPH_BASE}${path_}`);
  url.searchParams.set("access_token", token);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }

  const init = { method };
  if (form) {
    init.body = form;
  } else if (json !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(json);
  }

  let res;
  try {
    res = await fetch(url, init);
  } catch (networkErr) {
    throw new GraphApiError(`Network error calling Graph API: ${networkErr.message}`, { cause: networkErr });
  }

  const text = await res.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!res.ok || payload.error) {
    const err = payload.error || {};
    throw new GraphApiError(
      `Graph API error (HTTP ${res.status})${err.message ? `: ${err.message}` : ""}${err.type ? ` [${err.type}]` : ""}`,
      { status: res.status, code: err.code, subcode: err.error_subcode, fbtrace_id: err.fbtrace_id },
    );
  }
  return payload;
}

export const graph = {
  get: (p, params) => request(p, { method: "GET", params }),
  post: (p, params) => request(p, { method: "POST", params }),
  postJson: (p, json, params) => request(p, { method: "POST", json, params }),
  postForm: (p, form, params) => request(p, { method: "POST", form, params }),
  del: (p, params) => request(p, { method: "DELETE", params }),
};

const MIME_BY_EXT = {
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
};

/** Reads a local file into a Blob suitable for multipart upload (Graph API `source` param). */
export async function fileToBlob(filePath) {
  const buf = await readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  return new Blob([buf], { type: MIME_BY_EXT[ext] || "application/octet-stream" });
}

/** Formats a helpful error string for tool `content[].text`, including Graph API details when present. */
export function describeError(err) {
  if (err instanceof GraphConfigError) {
    return `Configuration error: ${err.message}`;
  }
  if (err instanceof GraphApiError) {
    const parts = [err.message];
    if (err.details?.fbtrace_id) parts.push(`fbtrace_id: ${err.details.fbtrace_id}`);
    return parts.join(" | ");
  }
  return err.message || String(err);
}
