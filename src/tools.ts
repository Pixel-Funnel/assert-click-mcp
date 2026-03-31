/**
 * MCP tool definitions and handlers for the Assert MCP server.
 * All 4 tools: assert_list, assert_generate, assert_run, assert_status.
 */

import { z } from "zod";
import { AssertClient, AssertApiError, structuredError, wrapError } from "./client.js";

// ---------------------------------------------------------------------------
// Input schemas (Zod)
// ---------------------------------------------------------------------------

export const AssertListInput = z.object({
  project_id: z.string().optional().describe("Optional. Filter by project ID."),
  cursor: z.string().optional().describe("Optional. Pagination cursor from previous response."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Optional. Max results to return. Default 20, max 100."),
});

export const AssertGenerateInput = z.object({
  description: z.string().min(1).max(5_000).describe("Plain English description of what to test."),
  url: z.string().url().describe("The base URL of the app under test."),
  project_id: z.string().optional().describe("Optional. Associate with a project."),
  save: z
    .boolean()
    .optional()
    .describe("Optional. If true, save the scenario to Assert. Defaults to false."),
});

export const AssertRunInput = z.object({
  scenario_id: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/, "scenario_id must contain only alphanumeric characters, hyphens, or underscores.")
    .optional()
    .describe("ID of a saved scenario to run."),
  markdown: z
    .string()
    .max(100_000)
    .optional()
    .describe("Optional. Run an ad-hoc scenario without saving it first."),
  project_id: z.string().optional().describe("Optional. Associate an ad-hoc markdown run with a project."),
  request_id: z
    .string()
    .optional()
    .describe(
      "Optional. Client-generated idempotency key. Retrying with the same ID returns the existing run."
    ),
});

export const AssertStatusInput = z.object({
  run_id: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9_-]+$/, "run_id must contain only alphanumeric characters, hyphens, or underscores.")
    .describe("Run ID returned by assert_run."),
});

// ---------------------------------------------------------------------------
// JSON Schema representations (for MCP tool registration)
// ---------------------------------------------------------------------------

export const TOOL_DEFINITIONS = [
  {
    name: "assert_list",
    description:
      "List existing E2E test scenarios saved in Assert. Use this to audit coverage before generating new tests. Supports filtering by project and pagination.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description: "Optional. Filter by project ID.",
        },
        cursor: {
          type: "string",
          description: "Optional. Pagination cursor from previous response.",
        },
        limit: {
          type: "number",
          description: "Optional. Max results to return. Default 20, max 100.",
        },
      },
      required: [],
    },
  },
  {
    name: "assert_generate",
    description:
      "Generate a ready-to-run E2E test scenario in Assert Markdown format from a plain-English description. Optionally save it to Assert for later execution.",
    inputSchema: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "Plain English description of what to test.",
        },
        url: {
          type: "string",
          description: "The base URL of the app under test.",
        },
        project_id: {
          type: "string",
          description: "Optional. Associate with a project.",
        },
        save: {
          type: "boolean",
          description:
            "Optional. If true, save the scenario to Assert. Defaults to false — returns markdown preview only.",
        },
      },
      required: ["description", "url"],
    },
  },
  {
    name: "assert_run",
    description:
      "Execute a test scenario and return a run ID. Accepts either a saved scenario_id or ad-hoc markdown. Runs are async — use assert_status to poll for completion.",
    inputSchema: {
      type: "object",
      properties: {
        scenario_id: {
          type: "string",
          description: "ID of a saved scenario to run.",
        },
        markdown: {
          type: "string",
          description:
            "Optional. Run an ad-hoc scenario without saving it first.",
        },
        project_id: {
          type: "string",
          description: "Optional. Associate an ad-hoc markdown run with a project.",
        },
        request_id: {
          type: "string",
          description:
            "Optional. Client-generated idempotency key. Retrying with the same ID returns the existing run.",
        },
      },
      required: [],
    },
  },
  {
    name: "assert_status",
    description:
      "Poll a test run for its current status and step-level results. Returns pass/fail with actionable failure details and screenshot URLs for failed steps.",
    inputSchema: {
      type: "object",
      properties: {
        run_id: {
          type: "string",
          description: "Run ID returned by assert_run.",
        },
      },
      required: ["run_id"],
    },
  },
] as const;

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function handleAssertList(
  client: AssertClient,
  rawInput: unknown
): Promise<unknown> {
  const parsed = AssertListInput.safeParse(rawInput);
  if (!parsed.success) {
    const field = parsed.error.errors[0]?.path.join(".") ?? null;
    const message = parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    return structuredError("VALIDATION_ERROR", message, field);
  }

  const { project_id, cursor, limit } = parsed.data;
  try {
    const result = await client.listScenarios({ project_id, cursor, limit: limit ?? 20 });
    return result;
  } catch (err) {
    return wrapError(err);
  }
}

export async function handleAssertGenerate(
  client: AssertClient,
  rawInput: unknown
): Promise<unknown> {
  const parsed = AssertGenerateInput.safeParse(rawInput);
  if (!parsed.success) {
    const field = parsed.error.errors[0]?.path.join(".") ?? null;
    const message = parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    return structuredError("VALIDATION_ERROR", message, field);
  }

  const { description, url, project_id, save } = parsed.data;
  try {
    const result = await client.generateScenario({
      description,
      url,
      project_id,
      save: save ?? false,
    });
    return result;
  } catch (err) {
    return wrapError(err);
  }
}

export async function handleAssertRun(
  client: AssertClient,
  rawInput: unknown
): Promise<unknown> {
  const parsed = AssertRunInput.safeParse(rawInput);
  if (!parsed.success) {
    const field = parsed.error.errors[0]?.path.join(".") ?? null;
    const message = parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    return structuredError("VALIDATION_ERROR", message, field);
  }

  const { scenario_id, markdown, project_id, request_id } = parsed.data;

  if (!scenario_id && !markdown) {
    return structuredError(
      "VALIDATION_ERROR",
      "Provide either scenario_id (to run a saved scenario) or markdown (to run an ad-hoc scenario). Neither was provided.",
      null
    );
  }

  if (scenario_id && markdown) {
    return structuredError(
      "VALIDATION_ERROR",
      "Provide either scenario_id or markdown, not both.",
      null
    );
  }

  try {
    if (scenario_id) {
      return await client.runScenario({ scenario_id, request_id });
    } else {
      return await client.runMarkdown({ markdown: markdown!, project_id, request_id });
    }
  } catch (err) {
    if (err instanceof AssertApiError && err.status === 404) {
      return structuredError(
        "SCENARIO_NOT_FOUND",
        `Scenario not found: ${scenario_id}`,
        "scenario_id"
      );
    }
    return wrapError(err);
  }
}

export async function handleAssertStatus(
  client: AssertClient,
  rawInput: unknown
): Promise<unknown> {
  const parsed = AssertStatusInput.safeParse(rawInput);
  if (!parsed.success) {
    const field = parsed.error.errors[0]?.path.join(".") ?? null;
    const message = parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    return structuredError("VALIDATION_ERROR", message, field);
  }

  const { run_id } = parsed.data;
  try {
    const result = await client.getRunStatus(run_id);
    return result;
  } catch (err) {
    if (err instanceof AssertApiError && err.status === 404) {
      return structuredError("RUN_NOT_FOUND", `Run not found: ${run_id}`, "run_id");
    }
    return wrapError(err);
  }
}
