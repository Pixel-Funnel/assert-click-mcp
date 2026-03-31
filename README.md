# @assert-click/mcp

MCP server for Assert.

It exposes four tools over stdio:

- `assert_list`
- `assert_generate`
- `assert_run`
- `assert_status`

## Requirements

- Node.js `>=18.17`
- A project-scoped Assert key, either stored in `assert.config.json` or provided via `ASSERT_API_KEY`

## Install

Create `assert.config.json` in your repo:

```json
{
  "projectApiKey": "assert_project_key_here",
  "projectId": "project_123"
}
```

Then point your MCP client at it:

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

Optional environment variables:

- `ASSERT_API_KEY`: preferred API key env var
- `ASSERT_PROJECT_ID`: optional default project ID
- `ASSERT_CONFIG`: optional path to a config file or directory

## Config files

The MCP server will look for these files from the current directory upward:

- `assert.config.json`
- `assert.config.local.json`

`assert.config.local.json` is merged on top of `assert.config.json`.

Example:

```json
{
  "projectApiKey": "assert_project_key_here",
  "projectId": "project_123"
}
```

If you prefer env-based secrets instead of committing the key:

```json
{
  "projectApiKeyEnv": "ASSERT_API_KEY",
  "projectId": "project_123"
}
```

## Tools

### `assert_list`

List saved scenarios.

Input:

- `project_id?: string`
- `cursor?: string`
- `limit?: number`

Returns:

```json
{
  "scenarios": [
    {
      "id": "scenario_123",
      "name": "Login flow",
      "project_id": "project_123",
      "last_run_status": "passed",
      "last_run_at": "2026-03-31T10:00:00.000Z",
      "url": "https://example.com/login"
    }
  ],
  "next_cursor": null
}
```

### `assert_generate`

Generate scenario markdown on the Assert service.

Input:

- `description: string`
- `url: string`
- `project_id?: string`
- `save?: boolean`

Returns:

```json
{
  "scenario_id": "scenario_123",
  "markdown": "URL: https://example.com/login\nSCENARIO: Login\nPROCESS:\n  - Fill \"email\" with \"user@example.com\"\nEXPECT: Dashboard",
  "saved": true
}
```

### `assert_run`

Start a run from either a saved scenario ID or ad-hoc markdown.

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

Fetch run status and step-level results.

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
