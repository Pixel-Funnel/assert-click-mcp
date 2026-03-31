/**
 * AssertClient — single HTTP helper for all Assert API calls.
 * Injects API key, handles timeouts, and returns structured errors.
 */

export class AssertApiError extends Error {
  code: string;
  field: string | null;
  status: number;

  constructor(code: string, message: string, status: number, field: string | null = null) {
    super(message);
    this.name = "AssertApiError";
    this.code = code;
    this.field = field;
    this.status = status;
  }
}

export interface ScenarioSummary {
  id: string;
  name: string;
  project_id: string;
  last_run_status: "passed" | "failed" | "pending" | "never_run";
  last_run_at: string | null;
  url: string;
}

export interface ListScenariosResult {
  scenarios: ScenarioSummary[];
  next_cursor: string | null;
}

export interface GenerateScenarioResult {
  scenario_id: string | null;
  markdown: string;
  saved: boolean;
}

export interface RunResult {
  run_id: string;
  status: "queued" | "running";
  estimated_duration_seconds: number | null;
}

export interface StepResult {
  description: string;
  status: "passed" | "failed" | "skipped";
  error: string | null;
  screenshot_url: string | null;
}

export interface StatusResult {
  run_id: string;
  status: "queued" | "running" | "passed" | "failed" | "errored";
  duration_ms: number | null;
  steps: StepResult[];
  failure_summary: string | null;
  full_log_url: string | null;
}

const DEFAULT_BASE_URL = "https://api.assert.click";
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024; // 10 MB

function timeoutSignal(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

function validateBaseUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AssertApiError("INVALID_CONFIG", "ASSERT_BASE_URL is not a valid URL.", 0);
  }
  const isHttps = parsed.protocol === "https:";
  const isLocalhost =
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
  if (!isHttps && !isLocalhost) {
    throw new AssertApiError(
      "INVALID_CONFIG",
      "ASSERT_BASE_URL must use https:// (or http://localhost for local development).",
      0
    );
  }
}

export class AssertClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string, baseUrl = DEFAULT_BASE_URL) {
    validateBaseUrl(baseUrl);
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "assert-mcp/1.0",
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    timeoutMs = 10_000
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let res: Response;

    try {
      res = await fetch(url, {
        method,
        headers: this.headers(),
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: timeoutSignal(timeoutMs),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("TimeoutError") || msg.includes("timed out") || msg.includes("abort")) {
        throw new AssertApiError("UPSTREAM_ERROR", `Request to Assert API timed out after ${timeoutMs}ms`, 0);
      }
      throw new AssertApiError("UPSTREAM_ERROR", `Network error: ${msg}`, 0);
    }

    if (res.status === 401 || res.status === 403) {
      throw new AssertApiError("INVALID_API_KEY", "The ASSERT_API_KEY is invalid or missing.", res.status);
    }

    if (!res.ok) {
      let errorBody: { message?: string; error?: string; code?: string } = {};
      try {
        errorBody = await res.json();
      } catch {
        // ignore parse failure
      }
      const message = errorBody.message ?? errorBody.error ?? `Assert API error: ${res.status}`;
      const code = errorBody.code ?? "UPSTREAM_ERROR";
      throw new AssertApiError(code, message, res.status);
    }

    const contentLength = res.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
      throw new AssertApiError("UPSTREAM_ERROR", "Assert API response exceeds maximum allowed size.", res.status);
    }

    let text: string;
    try {
      text = await res.text();
    } catch {
      throw new AssertApiError("UPSTREAM_ERROR", "Assert API returned non-JSON response", res.status);
    }

    if (text.length > MAX_RESPONSE_BYTES) {
      throw new AssertApiError("UPSTREAM_ERROR", "Assert API response exceeds maximum allowed size.", res.status);
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new AssertApiError("UPSTREAM_ERROR", "Assert API returned non-JSON response", res.status);
    }
  }

  /** List saved scenarios with optional project filter and pagination. */
  async listScenarios(params: {
    project_id?: string;
    cursor?: string;
    limit?: number;
  }): Promise<ListScenariosResult> {
    const qs = new URLSearchParams();
    if (params.project_id) qs.set("project_id", params.project_id);
    if (params.cursor) qs.set("cursor", params.cursor);
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    const query = qs.toString() ? `?${qs}` : "";
    return this.request<ListScenariosResult>("GET", `/v1/scenarios${query}`, undefined, 10_000);
  }

  /** Generate a scenario Markdown from a plain-English description. */
  async generateScenario(params: {
    description: string;
    url: string;
    project_id?: string;
    save?: boolean;
  }): Promise<GenerateScenarioResult> {
    return this.request<GenerateScenarioResult>("POST", "/v1/scenarios/generate", params, 10_000);
  }

  /** Submit an ad-hoc markdown run (create → upload → start). */
  async runMarkdown(params: {
    markdown: string;
    project_id?: string;
    request_id?: string;
  }): Promise<RunResult> {
    return this.request<RunResult>(
      "POST",
      "/v1/runs",
      {
        markdown: params.markdown,
        project_id: params.project_id,
        request_id: params.request_id,
        source: "mcp",
      },
      30_000
    );
  }

  /** Start a run for an already-saved scenario. */
  async runScenario(params: {
    scenario_id: string;
    request_id?: string;
  }): Promise<RunResult> {
    return this.request<RunResult>(
      "POST",
      `/v1/scenarios/${params.scenario_id}/runs`,
      {
        request_id: params.request_id,
        source: "mcp",
      },
      30_000
    );
  }

  /** Poll a run for its current status and step details. */
  async getRunStatus(runId: string): Promise<StatusResult> {
    return this.request<StatusResult>("GET", `/v1/runs/${runId}`, undefined, 10_000);
  }
}

/** Build a structured MCP error payload the agent can interpret. */
export function structuredError(
  code: string,
  message: string,
  field: string | null = null
): { error: { code: string; message: string; field: string | null } } {
  return { error: { code, message, field } };
}

/** Wrap any thrown error into the structured error format. */
export function wrapError(err: unknown): { error: { code: string; message: string; field: string | null } } {
  if (err instanceof AssertApiError) {
    return structuredError(err.code, err.message, err.field);
  }
  const message = err instanceof Error ? err.message : String(err);
  return structuredError("UPSTREAM_ERROR", message);
}
