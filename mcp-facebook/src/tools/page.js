import { z } from "zod";
import path from "node:path";
import { graph, getPageId, fileToBlob } from "../graphClient.js";
import { safeHandler, jsonResult, textResult } from "../util.js";

const PAGE_FIELDS =
  "id,name,about,description,category,phone,website,link,fan_count,followers_count,cover,picture{url}";

export function registerPageTools(server) {
  server.registerTool(
    "get_page_info",
    {
      title: "Get Facebook Page Profile Info",
      description: "Read the Page's current profile info: name, about/description, category, contact, fan/follower counts, cover and profile picture.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    safeHandler(async () => {
      const pageId = getPageId();
      const result = await graph.get(`/${pageId}`, { fields: PAGE_FIELDS });
      return jsonResult(result);
    }),
  );

  server.registerTool(
    "update_page_info",
    {
      title: "Update Facebook Page Profile Info",
      description:
        "Update the Page's about/description/phone/website text fields. Only the fields you pass are " +
        "changed. Note: Meta has progressively locked some Page fields to Business Manager-only editing " +
        "for certain categories — if a field is rejected, edit it in Meta Business Suite instead. " +
        "Use update_page_photo for the cover or profile picture.",
      inputSchema: {
        about: z.string().optional().describe("Short 'about' blurb."),
        description: z.string().optional().describe("Longer description text."),
        phone: z.string().optional().describe("Public contact phone number."),
        website: z.string().url().optional().describe("Website URL."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    safeHandler(async ({ about, description, phone, website }) => {
      if (!about && !description && !phone && !website) {
        return { isError: true, content: [{ type: "text", text: "Provide at least one field to update." }] };
      }
      const pageId = getPageId();
      await graph.post(`/${pageId}`, { about, description, phone, website });
      return textResult("Page info updated.");
    }, "If Meta rejects a field with 'This endpoint requires...' or similar, edit it in Meta Business Suite instead."),
  );

  server.registerTool(
    "update_page_photo",
    {
      title: "Update Facebook Page Cover or Profile Photo",
      description:
        "Replace the Page's cover photo or profile picture. Provide exactly one of imageUrl (a " +
        "publicly reachable image URL) or imagePath (a local file path on this machine, uploaded directly).",
      inputSchema: {
        type: z.enum(["cover", "profile"]).describe("Which photo slot to replace."),
        imageUrl: z.string().url().optional().describe("Publicly reachable URL of the new image."),
        imagePath: z.string().optional().describe("Local filesystem path of the new image."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    safeHandler(async ({ type, imageUrl, imagePath }) => {
      if (!imageUrl === !imagePath) {
        return {
          isError: true,
          content: [{ type: "text", text: "Provide exactly one of imageUrl or imagePath, not both/neither." }],
        };
      }
      const pageId = getPageId();

      if (type === "profile") {
        if (imagePath) {
          const blob = await fileToBlob(imagePath);
          const form = new FormData();
          form.append("source", blob, path.basename(imagePath));
          const result = await graph.postForm(`/${pageId}/picture`, form);
          return jsonResult(result);
        }
        const result = await graph.post(`/${pageId}/picture`, { picture: imageUrl });
        return jsonResult(result);
      }

      // Cover photo: upload as an unpublished photo, then point the page's `cover` field at it.
      let uploaded;
      if (imagePath) {
        const blob = await fileToBlob(imagePath);
        const form = new FormData();
        form.append("source", blob, path.basename(imagePath));
        form.append("published", "false");
        uploaded = await graph.postForm(`/${pageId}/photos`, form);
      } else {
        uploaded = await graph.post(`/${pageId}/photos`, { url: imageUrl, published: false });
      }
      const result = await graph.post(`/${pageId}`, { cover: JSON.stringify({ photo_id: uploaded.id }) });
      return jsonResult({ photoId: uploaded.id, ...result });
    }, "Uploads must be a supported image type (jpg/png/webp/gif) reachable at imageUrl or readable at imagePath."),
  );
}
