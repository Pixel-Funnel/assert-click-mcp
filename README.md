# @assert-click/mcp

MCP server for [Assert](https://assert.click) — lets your AI coding agent generate, run, and inspect E2E tests without leaving the chat.

Describe a user flow in plain English. Assert generates a Playwright test, executes it in a real browser, and returns step-level results and failure screenshots — all from a single tool call in Cursor, Claude, Windsurf, or any MCP-compatible agent.

**[Sign up free at assert.click](https://assert.click)** to get your API key and project ID before using this package.

## What your agent can do

- **Generate** — describe a flow, get back a Markdown scenario ready to save and run
- **Run** — execute a saved scenario or ad-hoc Markdown against a real Chromium browser
- **Inspect** — fetch step-level pass/fail, error messages, and failure screenshot URLs
- **List** — browse saved scenarios visible to the API key

## Requirements

- Node.js `>=18.17`
- A project-scoped Assert key — get one at [assert.click](https://assert.click)

## Setup

**1. Create `assert.config.json` in your repo:**

```json
{
  "projectApiKey": "assert_project_key_here",
  "projectId": "project_123"
}
```

**2. Add the MCP server to your agent config:**

```json
{
  "mcpServers": {
    "assert": {
      "command": "npx",
      "args": ["-y", "@assert-click/mcp"],
      "env": {
        "ASSERT_CONFIG": "/absolute/path/to/assert.config.json"
      }
    }
  }
}
```

That's it. Your agent now has access to all four Assert tools.

## Private URLs

Targets such as `localhost`, `127.0.0.1`, and LAN or VPN IP addresses are blocked by default.

Use a public URL unless the machine executing the Assert run is intentionally configured to allow private targets with:

```bash
ALLOW_PRIVATE_TARGETS=true
```

Set that on the machine or process running Assert. Do not put it in `assert.config.json`.

## Environment variables

- `ASSERT_API_KEY`: API key (alternative to storing it in `assert.config.json`)
- `ASSERT_PROJECT_ID`: optional default project ID
- `ASSERT_CONFIG`: optional path to a config file or directory

## Config files

The MCP server will look for these files from the current directory upward:

- `assert.config.json`
- `assert.config.local.json`

`assert.config.local.json` is merged on top of `assert.config.json`.

If you prefer env-based secrets instead of committing the key:

```json
{
  "projectApiKeyEnv": "ASSERT_API_KEY",
  "projectId": "project_123"
}
```

## Tools

### `assert_generate`

Generate a Markdown scenario from a plain-English description.

Input:

- `description: string` — what the user should be able to do
- `url: string` — the starting URL
- `project_id?: string`
- `save?: boolean` — save to the project (default: false)

Returns:

```json
{
  "scenario_id": "scenario_123",
  "markdown": "URL: https://example.com/login\nSCENARIO: Login\nPROCESS:\n  - Fill \"email\" with \"user@example.com\"\nEXPECT: Dashboard",
  "saved": true
}
```

### `assert_run`

Execute a saved scenario or ad-hoc Markdown in a real browser.

Input:

- `scenario_id?: string`
- `markdown?: string`
- `project_id?: string`
- `request_id?: string`

Exactly one of `scenario_id` or `markdown` must be provided.

Returns:

```json
{
  "run_id": "run_123",
  "status": "queued",
  "estimated_duration_seconds": null
}
```

### `assert_status`

Fetch step-level results for a run.

Input:

- `run_id: string`

Returns:

```json
{
  "run_id": "run_123",
  "status": "passed",
  "duration_ms": 4200,
  "steps": [
    {
      "description": "Fill email",
      "status": "passed",
      "error": null,
      "screenshot_url": null
    }
  ],
  "failure_summary": null,
  "full_log_url": null
}
```

### `assert_list`

List saved scenarios visible to the API key.

Input:

- `project_id?: string`
- `cursor?: string`
- `limit?: number`

`project_id` is currently reserved for future filtering support. The current API lists all scenarios visible to the API key.

Returns:

```json
{
  "scenarios": [
    {
      "id": "scenario_123",
      "name": "Login flow",
      "project_id": null,
      "last_run_status": "passed",
      "last_run_at": "2026-03-31T10:00:00.000Z",
      "url": "https://example.com/login"
    }
  ],
  "next_cursor": null
}
```

## Errors

Errors are returned as structured JSON:

```json
{
  "error": {
    "code": "INVALID_API_KEY",
    "message": "The ASSERT_API_KEY is invalid or missing.",
    "field": null
  }
}
```

Common codes:

- `INVALID_API_KEY`
- `SCENARIO_NOT_FOUND`
- `RUN_NOT_FOUND`
- `VALIDATION_ERROR`
- `UPSTREAM_ERROR`

## License

MIT
