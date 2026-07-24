import { z } from "zod";
import { graph, getPageId } from "../graphClient.js";
import { safeHandler, jsonResult } from "../util.js";

const CONVERSATION_FIELDS = "id,updated_time,unread_count,participants,snippet";
const MESSAGE_FIELDS = "id,message,from,to,created_time,attachments";

const WINDOW_CAVEAT =
  "Meta only allows the Page to message a person outside a standard message tag within 24 hours of " +
  "their last message (the 'messaging window'). Sends outside that window without a valid tag are " +
  "rejected by Meta as policy enforcement — that's expected, not a bug to work around.";

export function registerMessageTools(server) {
  server.registerTool(
    "list_conversations",
    {
      title: "List Messenger Conversations",
      description:
        "List the Page's Messenger conversations (inbox), most recently updated first. Returns each " +
        "conversation's id, participants, unread count, and last-message snippet.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).default(20).describe("Max conversations to return. Hard cap 100."),
        after: z.string().optional().describe("Pagination cursor from a previous call's paging.cursors.after."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    safeHandler(async ({ limit, after }) => {
      const pageId = getPageId();
      const result = await graph.get(`/${pageId}/conversations`, {
        platform: "messenger",
        fields: CONVERSATION_FIELDS,
        limit,
        after,
      });
      return jsonResult(result);
    }, "Requires the page token to have the pages_messaging permission."),
  );

  server.registerTool(
    "get_conversation_messages",
    {
      title: "Get Messenger Conversation Messages",
      description: "Read the messages within one Messenger conversation, newest first.",
      inputSchema: {
        conversationId: z.string().min(1).describe("The conversation id from list_conversations."),
        limit: z.number().int().min(1).max(100).default(25).describe("Max messages to return. Hard cap 100."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    safeHandler(async ({ conversationId, limit }) => {
      const result = await graph.get(`/${conversationId}/messages`, { fields: MESSAGE_FIELDS, limit });
      return jsonResult(result);
    }, "Use list_conversations to find a valid conversation id."),
  );

  server.registerTool(
    "send_message",
    {
      title: "Send a Messenger Message",
      description:
        `Send a text message from the Page to a person via Messenger (Send API). ${WINDOW_CAVEAT} ` +
        "Get the recipientId (PSID) from list_conversations/get_conversation_messages participants/from fields.",
      inputSchema: {
        recipientId: z.string().min(1).describe("The recipient's page-scoped user id (PSID)."),
        text: z.string().min(1).describe("The message text to send."),
        messagingType: z
          .enum(["RESPONSE", "UPDATE"])
          .default("RESPONSE")
          .describe("RESPONSE = replying to the user's message; UPDATE = proactive message within the 24h window."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    safeHandler(async ({ recipientId, text, messagingType }) => {
      const result = await graph.postJson("/me/messages", {
        recipient: { id: recipientId },
        message: { text },
        messaging_type: messagingType,
      });
      return jsonResult(result);
    }, WINDOW_CAVEAT),
  );
}
