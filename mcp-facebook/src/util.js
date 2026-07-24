import { describeError } from "./graphClient.js";

export function errorResult(err, hint) {
  const text = hint ? `${describeError(err)} ${hint}` : describeError(err);
  return { isError: true, content: [{ type: "text", text }] };
}

export function jsonResult(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: data };
}

export function textResult(text) {
  return { content: [{ type: "text", text }] };
}

/** Wraps a tool handler so thrown Graph/config errors become MCP tool errors instead of crashing the transport. */
export function safeHandler(fn, hint) {
  return async (args) => {
    try {
      return await fn(args);
    } catch (err) {
      return errorResult(err, hint);
    }
  };
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
