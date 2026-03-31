/**
 * Assert MCP Server
 * Transport: stdio
 * Tools: assert_list, assert_generate, assert_run, assert_status
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { AssertClient, structuredError } from "./client.js";
import {
  TOOL_DEFINITIONS,
  handleAssertList,
  handleAssertGenerate,
  handleAssertRun,
  handleAssertStatus,
} from "./tools.js";

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const apiKey = process.env.ASSERT_API_KEY;
if (!apiKey) {
  process.stderr.write(
    "[assert-mcp] ERROR: ASSERT_API_KEY environment variable is not set.\n"
  );
  process.exit(1);
}

const baseUrl = process.env.ASSERT_HOST_URL ?? "https://api.assert.click";
const client = new AssertClient(apiKey, baseUrl);

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = new Server(
  {
    name: "assert",
    version: "1.0.0",
    description:
      "Run AI-powered E2E tests from plain Markdown. Generate scenarios, execute Playwright tests, and inspect results — all from your AI coding agent.",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOL_DEFINITIONS };
});

// Dispatch tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  let result: unknown;

  switch (name) {
    case "assert_list":
      result = await handleAssertList(client, args ?? {});
      break;
    case "assert_generate":
      result = await handleAssertGenerate(client, args ?? {});
      break;
    case "assert_run":
      result = await handleAssertRun(client, args ?? {});
      break;
    case "assert_status":
      result = await handleAssertStatus(client, args ?? {});
      break;
    default:
      result = structuredError(
        "VALIDATION_ERROR",
        `Unknown tool: ${name}`,
        null
      );
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[assert-mcp] Server started on stdio.\n");
}

main().catch((err) => {
  process.stderr.write(`[assert-mcp] Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
