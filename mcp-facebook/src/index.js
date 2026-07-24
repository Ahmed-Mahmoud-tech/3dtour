import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerPostTools } from "./tools/posts.js";
import { registerCommentTools } from "./tools/comments.js";
import { registerInsightTools } from "./tools/insights.js";
import { registerMessageTools } from "./tools/messages.js";
import { registerPageTools } from "./tools/page.js";
import { registerInstagramTools } from "./tools/instagram.js";

const server = new McpServer({
  name: "gateverse-facebook-mcp",
  version: "1.0.0",
});

registerPostTools(server);
registerCommentTools(server);
registerInsightTools(server);
registerMessageTools(server);
registerPageTools(server);
registerInstagramTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
