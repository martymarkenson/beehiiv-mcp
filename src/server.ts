#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "beehiiv-mcp",
  version: "1.0.0"
});

// Get Beehiiv Subscribers Tool
server.registerTool(
  "get-subscribers",
  {
    title: "Get Beehiiv Subscribers",
    description: "Retrieve subscribers from a Beehiiv publication with filtering and pagination options",
    inputSchema: {
      limit: z.number().min(1).max(100).optional().describe("Number of results to return (1-100, default 10)"),
      cursor: z.string().optional().describe("Cursor for pagination"),
      status: z.string().optional().describe("Filter by subscription status"),
      tier: z.string().optional().describe("Filter by subscription tier"),
      email: z.string().optional().describe("Exact email match filter"),
      expand: z.array(z.string()).optional().describe("Expand additional data (premium tiers, referrals, stats, custom fields)"),
      order_by: z.string().optional().describe("Sort field (defaults to 'created')"),
      direction: z.enum(["asc", "desc"]).optional().describe("Sort direction")
    }
  },
  async ({ limit = 10, cursor, status, tier, email, expand, order_by, direction }) => {
    try {
      const apiKey = process.env.BEEHIIV_API_KEY;
      const publicationId = process.env.BEEHIIV_PUBLICATION_ID;

      if (!apiKey) {
        return {
          content: [{
            type: "text",
            text: "Error: BEEHIIV_API_KEY environment variable is required"
          }],
          isError: true
        };
      }

      if (!publicationId) {
        return {
          content: [{
            type: "text",
            text: "Error: BEEHIIV_PUBLICATION_ID environment variable is required"
          }],
          isError: true
        };
      }

      const url = new URL(`https://api.beehiiv.com/v2/publications/${publicationId}/subscriptions`);

      // Add query parameters
      url.searchParams.set("limit", limit.toString());
      if (cursor) url.searchParams.set("cursor", cursor);
      if (status) url.searchParams.set("status", status);
      if (tier) url.searchParams.set("tier", tier);
      if (email) url.searchParams.set("email", email);
      if (expand && expand.length > 0) {
        expand.forEach(item => url.searchParams.append("expand[]", item));
      }
      if (order_by) url.searchParams.set("order_by", order_by);
      if (direction) url.searchParams.set("direction", direction);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: [{
            type: "text",
            text: `Error: HTTP ${response.status} - ${errorText}`
          }],
          isError: true
        };
      }

      const data = await response.json();

      return {
        content: [{
          type: "text",
          text: JSON.stringify(data, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);


async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);

    // Validate environment variables on startup
    if (!process.env.BEEHIIV_API_KEY) {
      process.stderr.write("Warning: BEEHIIV_API_KEY environment variable is not set\n");
    }
    if (!process.env.BEEHIIV_PUBLICATION_ID) {
      process.stderr.write("Warning: BEEHIIV_PUBLICATION_ID environment variable is not set\n");
    }

  } catch (error) {
    process.stderr.write(`Failed to start MCP server: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

main().catch(error => {
  process.stderr.write(`Unexpected error in main: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});