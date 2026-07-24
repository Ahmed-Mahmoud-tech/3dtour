import { z } from "zod";
import { graph, getPageId } from "../graphClient.js";
import { safeHandler, jsonResult } from "../util.js";

const DEFAULT_PAGE_METRICS = ["page_impressions_unique", "page_post_engagements", "page_fans"];
const DEFAULT_POST_METRICS = ["post_impressions_unique", "post_engaged_users", "post_clicks", "post_reactions_by_type_total"];

const METRIC_CAVEAT =
  "Meta changes the set of valid Page/post insight metrics over time and by page category " +
  "(see https://developers.facebook.com/docs/graph-api/reference/page/insights/). If a metric name is " +
  "rejected, the Graph API error will name it — drop it and retry with the rest.";

export function registerInsightTools(server) {
  server.registerTool(
    "get_page_insights",
    {
      title: "Get Facebook Page Insights",
      description:
        `Read Page-level analytics (reach, engagement, fan count, etc.) over a time period. ${METRIC_CAVEAT}`,
      inputSchema: {
        metrics: z
          .array(z.string())
          .min(1)
          .default(DEFAULT_PAGE_METRICS)
          .describe(`Metric names to fetch. Defaults to ${DEFAULT_PAGE_METRICS.join(", ")}.`),
        period: z
          .enum(["day", "week", "days_28"])
          .default("day")
          .describe("Aggregation bucket size for the returned data points."),
        since: z.string().optional().describe("ISO 8601 date to start from (defaults to Meta's own lookback)."),
        until: z.string().optional().describe("ISO 8601 date to end at (defaults to now)."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    safeHandler(async ({ metrics, period, since, until }) => {
      const pageId = getPageId();
      const result = await graph.get(`/${pageId}/insights`, { metric: metrics, period, since, until });
      return jsonResult(result);
    }, METRIC_CAVEAT),
  );

  server.registerTool(
    "get_post_insights",
    {
      title: "Get Facebook Post Insights",
      description: `Read per-post analytics (impressions, engagement, clicks, reactions) for one post. ${METRIC_CAVEAT}`,
      inputSchema: {
        postId: z.string().min(1).describe("The post id to fetch insights for."),
        metrics: z
          .array(z.string())
          .min(1)
          .default(DEFAULT_POST_METRICS)
          .describe(`Metric names to fetch. Defaults to ${DEFAULT_POST_METRICS.join(", ")}.`),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    safeHandler(async ({ postId, metrics }) => {
      const result = await graph.get(`/${postId}/insights`, { metric: metrics });
      return jsonResult(result);
    }, `${METRIC_CAVEAT} Use list_posts to find a valid post id.`),
  );
}
