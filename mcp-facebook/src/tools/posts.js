import { z } from "zod";
import path from "node:path";
import { graph, getPageId, fileToBlob } from "../graphClient.js";
import { safeHandler, jsonResult, textResult } from "../util.js";

const POST_FIELDS =
  "id,message,created_time,permalink_url,full_picture,attachments{media_type,url,media},likes.summary(true),comments.summary(true),shares";

function schedulingParams(publishAt) {
  if (!publishAt) return {};
  const ts = Math.floor(new Date(publishAt).getTime() / 1000);
  return { published: false, scheduled_publish_time: ts };
}

export function registerPostTools(server) {
  server.registerTool(
    "create_post",
    {
      title: "Create Facebook Page Post",
      description:
        "Publish a text/link post to the Page's feed. Optionally attach a link (renders a link-preview " +
        "card) and/or schedule it for later. Does NOT attach an image — use create_photo_post for that.",
      inputSchema: {
        message: z.string().min(1).describe("The post's text body."),
        link: z.string().url().optional().describe("Optional URL to attach as a link-preview card."),
        publishAt: z
          .string()
          .datetime()
          .optional()
          .describe(
            "ISO 8601 datetime to schedule the post for instead of publishing immediately. " +
              "Meta requires this to be 10 minutes to 6 months in the future.",
          ),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    safeHandler(async ({ message, link, publishAt }) => {
      const pageId = getPageId();
      const result = await graph.post(`/${pageId}/feed`, {
        message,
        link,
        ...schedulingParams(publishAt),
      });
      return jsonResult(result);
    }, "Check META_PAGE_ID/META_ACCESS_TOKEN in mcp-facebook/.env and that the page token still has pages_manage_posts."),
  );

  server.registerTool(
    "create_photo_post",
    {
      title: "Create Facebook Photo Post",
      description:
        "Publish a photo post to the Page's feed with an optional caption. Provide exactly one of " +
        "imageUrl (a publicly reachable image URL) or imagePath (a local file path on this machine, " +
        "uploaded directly). Use create_post for text/link posts without an image.",
      inputSchema: {
        caption: z.string().optional().describe("Caption text shown with the photo."),
        imageUrl: z.string().url().optional().describe("Publicly reachable URL of the image to post."),
        imagePath: z.string().optional().describe("Local filesystem path of the image to upload."),
        publishAt: z
          .string()
          .datetime()
          .optional()
          .describe("ISO 8601 datetime to schedule the post for instead of publishing immediately."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    safeHandler(async ({ caption, imageUrl, imagePath, publishAt }) => {
      if (!imageUrl === !imagePath) {
        return {
          isError: true,
          content: [{ type: "text", text: "Provide exactly one of imageUrl or imagePath, not both/neither." }],
        };
      }
      const pageId = getPageId();
      const scheduling = schedulingParams(publishAt);

      let result;
      if (imagePath) {
        const blob = await fileToBlob(imagePath);
        const form = new FormData();
        form.append("source", blob, path.basename(imagePath));
        if (caption) form.append("caption", caption);
        if (scheduling.published === false) {
          form.append("published", "false");
          form.append("scheduled_publish_time", String(scheduling.scheduled_publish_time));
        }
        result = await graph.postForm(`/${pageId}/photos`, form);
      } else {
        result = await graph.post(`/${pageId}/photos`, { url: imageUrl, caption, ...scheduling });
      }
      return jsonResult(result);
    }, "Check META_PAGE_ID/META_ACCESS_TOKEN in mcp-facebook/.env, that imagePath exists and is readable, or that imageUrl is publicly reachable."),
  );

  server.registerTool(
    "list_posts",
    {
      title: "List Facebook Page Posts",
      description:
        "List recent posts on the Page's feed, newest first. Returns each post's id, message, " +
        "created_time, permalink, and like/comment counts. Use get_post for the full detail of one post.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).default(10).describe("Max posts to return. Hard cap 100."),
        after: z.string().optional().describe("Pagination cursor from a previous call's paging.cursors.after."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    safeHandler(async ({ limit, after }) => {
      const pageId = getPageId();
      const result = await graph.get(`/${pageId}/posts`, { fields: POST_FIELDS, limit, after });
      return jsonResult(result);
    }),
  );

  server.registerTool(
    "get_post",
    {
      title: "Get Facebook Post Details",
      description: "Fetch full details of a single post by id (message, permalink, attachments, like/comment/share counts).",
      inputSchema: {
        postId: z.string().min(1).describe("The post id, e.g. '123456789_987654321'."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    safeHandler(async ({ postId }) => {
      const result = await graph.get(`/${postId}`, { fields: POST_FIELDS });
      return jsonResult(result);
    }, "Use list_posts to find a valid post id."),
  );

  server.registerTool(
    "update_post",
    {
      title: "Edit Facebook Post Text",
      description: "Edit the text body of an existing post. Cannot change its attached photo/link.",
      inputSchema: {
        postId: z.string().min(1).describe("The post id to edit."),
        message: z.string().min(1).describe("The new post text."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    safeHandler(async ({ postId, message }) => {
      await graph.post(`/${postId}`, { message });
      return textResult(`Updated post ${postId}.`);
    }, "Use list_posts to find a valid post id."),
  );

  server.registerTool(
    "delete_post",
    {
      title: "Delete Facebook Post",
      description: "Permanently delete a post from the Page. This cannot be undone.",
      inputSchema: {
        postId: z.string().min(1).describe("The post id to delete."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    safeHandler(async ({ postId }) => {
      await graph.del(`/${postId}`);
      return textResult(`Deleted post ${postId}.`);
    }, "Use list_posts to find a valid post id."),
  );
}
