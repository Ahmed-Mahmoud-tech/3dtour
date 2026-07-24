import { z } from "zod";
import { graph } from "../graphClient.js";
import { safeHandler, jsonResult, textResult } from "../util.js";

const COMMENT_FIELDS = "id,message,from,created_time,like_count,comment_count,is_hidden,permalink_url";

export function registerCommentTools(server) {
  server.registerTool(
    "list_comments",
    {
      title: "List Comments on a Post",
      description:
        "List comments on a post or on another comment (to read replies), newest first by default. " +
        "Returns id, message, author, timestamp, like/reply counts, and whether each comment is hidden.",
      inputSchema: {
        objectId: z.string().min(1).describe("The post id or comment id to list comments under."),
        limit: z.number().int().min(1).max(100).default(25).describe("Max comments to return. Hard cap 100."),
        after: z.string().optional().describe("Pagination cursor from a previous call's paging.cursors.after."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    safeHandler(async ({ objectId, limit, after }) => {
      const result = await graph.get(`/${objectId}/comments`, {
        fields: COMMENT_FIELDS,
        filter: "stream",
        limit,
        after,
      });
      return jsonResult(result);
    }, "Use list_posts to find a valid post id."),
  );

  server.registerTool(
    "reply_to_comment",
    {
      title: "Reply to a Facebook Comment",
      description: "Post a reply (as the Page) to an existing comment on a post.",
      inputSchema: {
        commentId: z.string().min(1).describe("The comment id to reply to."),
        message: z.string().min(1).describe("The reply text."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    safeHandler(async ({ commentId, message }) => {
      const result = await graph.post(`/${commentId}/comments`, { message });
      return jsonResult(result);
    }, "Use list_comments to find a valid comment id."),
  );

  server.registerTool(
    "set_comment_visibility",
    {
      title: "Hide or Unhide a Comment",
      description:
        "Hide or unhide a comment from public view without deleting it (reversible moderation). " +
        "Use delete_comment to remove one permanently instead.",
      inputSchema: {
        commentId: z.string().min(1).describe("The comment id to hide/unhide."),
        hidden: z.boolean().describe("true to hide the comment, false to make it visible again."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    safeHandler(async ({ commentId, hidden }) => {
      await graph.post(`/${commentId}`, { is_hidden: hidden });
      return textResult(`Comment ${commentId} is now ${hidden ? "hidden" : "visible"}.`);
    }, "Use list_comments to find a valid comment id."),
  );

  server.registerTool(
    "delete_comment",
    {
      title: "Delete a Facebook Comment",
      description: "Permanently delete a comment (and its replies) from a post. This cannot be undone.",
      inputSchema: {
        commentId: z.string().min(1).describe("The comment id to delete."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    safeHandler(async ({ commentId }) => {
      await graph.del(`/${commentId}`);
      return textResult(`Deleted comment ${commentId}.`);
    }, "Use list_comments to find a valid comment id."),
  );
}
