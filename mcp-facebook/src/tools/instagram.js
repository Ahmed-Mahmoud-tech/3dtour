import { z } from "zod";
import { graph, getIgUserId, GraphApiError } from "../graphClient.js";
import { safeHandler, jsonResult, textResult, sleep } from "../util.js";

const ACCOUNT_FIELDS = "id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website";
const MEDIA_FIELDS = "id,caption,media_type,media_product_type,media_url,permalink,timestamp,like_count,comments_count";
const COMMENT_FIELDS = "id,text,username,timestamp,like_count,hidden";

const METRIC_CAVEAT =
  "Meta has repeatedly renamed/deprecated Instagram Insights metrics (e.g. impressions -> views in 2025) " +
  "— see https://developers.facebook.com/docs/instagram-platform/insights/. If a metric is rejected, drop " +
  "it and retry with the rest; the error names the bad one.";

const NO_LOCAL_UPLOAD =
  "Instagram's API only accepts publicly reachable URLs for media (Meta's servers fetch from them) — " +
  "unlike the Facebook Page tools, there is no local-file-upload option here.";

async function pollContainerStatus(containerId, { maxAttempts = 20, intervalMs = 3000 } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await graph.get(`/${containerId}`, { fields: "status_code" });
    if (status.status_code === "FINISHED") return status;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      throw new GraphApiError(`Instagram media container ${containerId} failed to process (${status.status_code}).`);
    }
    await sleep(intervalMs);
  }
  throw new GraphApiError(
    `Instagram media container ${containerId} is still processing after ${maxAttempts} checks. ` +
      "Video/Reels processing can take a while — wait and check again, it may still succeed.",
  );
}

function containerParams({ imageUrl, videoUrl, isCarouselItem, caption }) {
  const params = {};
  if (videoUrl) {
    params.video_url = videoUrl;
    params.media_type = isCarouselItem ? "VIDEO" : "REELS";
  } else {
    params.image_url = imageUrl;
  }
  if (isCarouselItem) params.is_carousel_item = true;
  if (caption && !isCarouselItem) params.caption = caption;
  return params;
}

export function registerInstagramTools(server) {
  server.registerTool(
    "get_instagram_account_info",
    {
      title: "Get Instagram Account Info",
      description:
        "Read the linked Instagram professional account's profile: username, name, bio, follower/" +
        "following/media counts, and profile picture.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    safeHandler(async () => {
      const igUserId = getIgUserId();
      const result = await graph.get(`/${igUserId}`, { fields: ACCOUNT_FIELDS });
      return jsonResult(result);
    }),
  );

  server.registerTool(
    "create_instagram_post",
    {
      title: "Create Instagram Post",
      description:
        `Publish a photo, video/Reel, or carousel to the linked Instagram account. ${NO_LOCAL_UPLOAD} ` +
        "Provide exactly one of imageUrl (single photo), videoUrl (single video, posted as a Reel), or " +
        "items (2-10 entries for a carousel, each with exactly one of imageUrl/videoUrl). This can take " +
        "a while for video — the tool polls Meta's processing status before publishing.",
      inputSchema: {
        caption: z.string().optional().describe("Caption text (applies to the whole post, not per carousel item)."),
        imageUrl: z.string().url().optional().describe("Publicly reachable image URL for a single-photo post."),
        videoUrl: z.string().url().optional().describe("Publicly reachable video URL for a single video/Reel post."),
        items: z
          .array(
            z.object({
              imageUrl: z.string().url().optional(),
              videoUrl: z.string().url().optional(),
            }),
          )
          .min(2)
          .max(10)
          .optional()
          .describe(
            "2-10 items to publish as a carousel, each with exactly one of imageUrl/videoUrl. " +
              "Mutually exclusive with the top-level imageUrl/videoUrl.",
          ),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    safeHandler(async ({ caption, imageUrl, videoUrl, items }) => {
      const provided = [imageUrl, videoUrl, items].filter((v) => v !== undefined).length;
      if (provided !== 1) {
        return {
          isError: true,
          content: [{ type: "text", text: "Provide exactly one of imageUrl, videoUrl, or items." }],
        };
      }
      const igUserId = getIgUserId();

      let creationId;
      if (items) {
        const childIds = [];
        for (const item of items) {
          if (!item.imageUrl === !item.videoUrl) {
            return {
              isError: true,
              content: [{ type: "text", text: "Each carousel item needs exactly one of imageUrl or videoUrl." }],
            };
          }
          const child = await graph.post(`/${igUserId}/media`, containerParams({ ...item, isCarouselItem: true }));
          await pollContainerStatus(child.id);
          childIds.push(child.id);
        }
        const parent = await graph.post(`/${igUserId}/media`, {
          media_type: "CAROUSEL",
          children: childIds,
          caption,
        });
        creationId = parent.id;
      } else {
        const container = await graph.post(
          `/${igUserId}/media`,
          containerParams({ imageUrl, videoUrl, caption, isCarouselItem: false }),
        );
        creationId = container.id;
      }

      await pollContainerStatus(creationId, { maxAttempts: videoUrl || items ? 40 : 10, intervalMs: 3000 });
      const published = await graph.post(`/${igUserId}/media_publish`, { creation_id: creationId });
      return jsonResult(published);
    }, `${NO_LOCAL_UPLOAD} Requires the instagram_content_publish permission.`),
  );

  server.registerTool(
    "list_instagram_media",
    {
      title: "List Instagram Posts",
      description: "List recent posts on the linked Instagram account, newest first.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).default(10).describe("Max posts to return. Hard cap 100."),
        after: z.string().optional().describe("Pagination cursor from a previous call's paging.cursors.after."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    safeHandler(async ({ limit, after }) => {
      const igUserId = getIgUserId();
      const result = await graph.get(`/${igUserId}/media`, { fields: MEDIA_FIELDS, limit, after });
      return jsonResult(result);
    }),
  );

  server.registerTool(
    "get_instagram_media",
    {
      title: "Get Instagram Post Details",
      description: "Fetch full details of a single Instagram post by id.",
      inputSchema: { mediaId: z.string().min(1).describe("The Instagram media id.") },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    safeHandler(async ({ mediaId }) => {
      const result = await graph.get(`/${mediaId}`, { fields: MEDIA_FIELDS });
      return jsonResult(result);
    }, "Use list_instagram_media to find a valid media id."),
  );

  server.registerTool(
    "delete_instagram_media",
    {
      title: "Delete Instagram Post",
      description:
        "Permanently delete a post, Reel, or Story from the Instagram account. To delete media inside a " +
        "carousel, delete the whole carousel by its parent id — individual carousel items can't be " +
        "deleted separately. This cannot be undone.",
      inputSchema: { mediaId: z.string().min(1).describe("The Instagram media id to delete.") },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    safeHandler(async ({ mediaId }) => {
      await graph.del(`/${mediaId}`);
      return textResult(`Deleted Instagram media ${mediaId}.`);
    }, "Requires the instagram_manage_contents permission. Use list_instagram_media to find a valid media id."),
  );

  server.registerTool(
    "list_instagram_comments",
    {
      title: "List Comments on an Instagram Post",
      description: "List comments on an Instagram post, returning id, text, author, timestamp, and hidden state.",
      inputSchema: {
        mediaId: z.string().min(1).describe("The Instagram media id to list comments under."),
        limit: z.number().int().min(1).max(100).default(25).describe("Max comments to return. Hard cap 100."),
        after: z.string().optional().describe("Pagination cursor from a previous call's paging.cursors.after."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    safeHandler(async ({ mediaId, limit, after }) => {
      const result = await graph.get(`/${mediaId}/comments`, { fields: COMMENT_FIELDS, limit, after });
      return jsonResult(result);
    }, "Use list_instagram_media to find a valid media id."),
  );

  server.registerTool(
    "reply_to_instagram_comment",
    {
      title: "Reply to an Instagram Comment",
      description: "Post a reply (as the account) to an existing comment on an Instagram post.",
      inputSchema: {
        commentId: z.string().min(1).describe("The comment id to reply to."),
        message: z.string().min(1).describe("The reply text."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    safeHandler(async ({ commentId, message }) => {
      const result = await graph.post(`/${commentId}/replies`, { message });
      return jsonResult(result);
    }, "Use list_instagram_comments to find a valid comment id."),
  );

  server.registerTool(
    "set_instagram_comment_visibility",
    {
      title: "Hide or Unhide an Instagram Comment",
      description: "Hide or unhide a comment from public view without deleting it (reversible moderation).",
      inputSchema: {
        commentId: z.string().min(1).describe("The comment id to hide/unhide."),
        hidden: z.boolean().describe("true to hide the comment, false to make it visible again."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    safeHandler(async ({ commentId, hidden }) => {
      await graph.post(`/${commentId}`, { hide: hidden });
      return textResult(`Comment ${commentId} is now ${hidden ? "hidden" : "visible"}.`);
    }, "Use list_instagram_comments to find a valid comment id."),
  );

  server.registerTool(
    "delete_instagram_comment",
    {
      title: "Delete an Instagram Comment",
      description: "Permanently delete a comment from an Instagram post. This cannot be undone.",
      inputSchema: { commentId: z.string().min(1).describe("The comment id to delete.") },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    safeHandler(async ({ commentId }) => {
      await graph.del(`/${commentId}`);
      return textResult(`Deleted comment ${commentId}.`);
    }, "Use list_instagram_comments to find a valid comment id."),
  );

  server.registerTool(
    "get_instagram_insights",
    {
      title: "Get Instagram Account Insights",
      description: `Read account-level analytics for the linked Instagram account over a time period. ${METRIC_CAVEAT}`,
      inputSchema: {
        metrics: z
          .array(z.string())
          .min(1)
          .default(["reach"])
          .describe("Metric names to fetch. Defaults to just 'reach' since other names churn often."),
        period: z.enum(["day", "week", "days_28"]).default("day").describe("Aggregation bucket size."),
        since: z.string().optional().describe("ISO 8601 date to start from."),
        until: z.string().optional().describe("ISO 8601 date to end at."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    safeHandler(async ({ metrics, period, since, until }) => {
      const igUserId = getIgUserId();
      const result = await graph.get(`/${igUserId}/insights`, { metric: metrics, period, since, until });
      return jsonResult(result);
    }, METRIC_CAVEAT),
  );

  server.registerTool(
    "get_instagram_media_insights",
    {
      title: "Get Instagram Post Insights",
      description: `Read per-post analytics (reach, likes, comments, etc.) for one Instagram post. ${METRIC_CAVEAT}`,
      inputSchema: {
        mediaId: z.string().min(1).describe("The Instagram media id to fetch insights for."),
        metrics: z
          .array(z.string())
          .min(1)
          .default(["reach"])
          .describe("Metric names to fetch. Defaults to just 'reach' since other names churn often."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    safeHandler(async ({ mediaId, metrics }) => {
      const result = await graph.get(`/${mediaId}/insights`, { metric: metrics });
      return jsonResult(result);
    }, `${METRIC_CAVEAT} Use list_instagram_media to find a valid media id.`),
  );
}
