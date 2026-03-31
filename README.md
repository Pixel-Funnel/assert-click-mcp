# @assert-click/mcp

Run real Playwright E2E tests from your AI coding agent — no Playwright knowledge required. Describe what to test in plain English, Assert writes and executes the test against your live app, and reports back step-by-step results.

Works with Claude (Desktop & Code), Cursor, Windsurf, and any MCP-compatible client.

---

## Quick start (3 steps)

### 1. Create a free account and get your API key

Go to **[dashboard.assert.click/register](https://dashboard.assert.click/register)** and sign up — it's free.

Once you're in:
1. Click **Settings** in the left sidebar
2. Click **API Keys**
3. Click **Create API key**, give it a name (e.g. "Cursor"), copy the key

> Keep this key safe — you won't be able to see it again.

---

### 2. Add Assert to your MCP client config

Pick your client below and paste the config. Replace `your_api_key_here` with the key you just copied.

**Claude Desktop** — edit `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "assert": {
      "command": "npx",
      "args": ["-y", "@assert-click/mcp"],
      "env": {
        "ASSERT_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

**Claude Code** — edit `~/.claude/claude_desktop_config.json` (same format as above).

**Cursor** — go to Settings → MCP, add a new server, paste:
```json
{
  "command": "npx",
  "args": ["-y", "@assert-click/mcp"],
  "env": {
    "ASSERT_API_KEY": "your_api_key_here"
  }
}
```

**Windsurf** — go to Settings → Cascade → MCP Servers, paste the same config.

---

### 3. Restart your AI client

Close and reopen it. That's it — Assert is now available as a tool.

---

## Try it

Once configured, ask your AI:

> *"Write and run an E2E test that checks a user can log in to https://myapp.com and reach the dashboard."*

The AI will:
1. Generate a test scenario from your description
2. Run it against your live app using Playwright
3. Report back pass/fail with step-by-step details and failure explanations

You don't need to install Playwright, write any code, or touch a config file.

---

## What the AI can do

| Say something like... | What happens |
|---|---|
| "Write and run a login test for my app" | Generates + runs a scenario in one go |
| "Run my existing tests" | Lists saved scenarios and runs them |
| "Save this test for later" | Saves the scenario so it can be reused |
| "What tests do I have?" | Lists all saved scenarios |

---

## Tools reference

### `assert_list`
List existing test scenarios saved in Assert.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `project_id` | string | No | Filter by project ID |
| `cursor` | string | No | Pagination cursor from previous response |
| `limit` | number | No | Max results (default 20, max 100) |

**Returns:** `{ scenarios: [...], next_cursor: string | null }`

---

### `assert_generate`
Generate a test scenario from a plain-English description. Optionally save it.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | Yes | Plain English description of what to test |
| `url` | string | Yes | Base URL of the app under test |
| `project_id` | string | No | Associate with a project |
| `save` | boolean | No | Save to Assert for future runs (default: false) |

**Returns:** `{ scenario_id: string | null, markdown: string, saved: boolean }`

---

### `assert_run`
Execute a test. Provide either a saved `scenario_id` or raw `markdown`. Runs are async — poll with `assert_status`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `scenario_id` | string | One of | ID of a saved scenario |
| `markdown` | string | One of | Ad-hoc scenario (no save required) |
| `request_id` | string | No | Idempotency key |

**Returns:** `{ run_id: string, status: "running" }`

---

### `assert_status`
Poll a run for step-level results. The AI calls this every few seconds until complete.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `run_id` | string | Yes | Run ID from `assert_run` |

**Returns:**
```json
{
  "run_id": "abc123",
  "status": "passed | failed | running | queued | errored",
  "steps": [
    { "description": "Fill email", "status": "passed", "error": null, "screenshot_url": null },
    { "description": "Click Sign in", "status": "failed", "error": "Element not found", "screenshot_url": "https://..." }
  ],
  "failure_summary": "Element not found on step: Click Sign in"
}
```

---

## Scenario Markdown format

Assert uses a plain-text format to describe tests. The AI writes this for you — but if you want to write or edit scenarios yourself:

```markdown
URL: https://myapp.com/login
SCENARIO: User logs in with valid credentials
PROCESS:
  - Fill "email" with "test@example.com"
  - Fill "password" with "hunter2"
  - Click "Sign in"
  - Wait for "Welcome back"
EXPECT: Dashboard
```

Supported steps: `Fill`, `Click`, `Select option`, `Check`, `Press`, `Wait for`, `Scroll`, `Upload`, `Go back`, `Reload`, and more. See [assert.click](https://assert.click) for the full reference.

---

## Error handling

All tools return structured errors — never raw exceptions:

```json
{
  "error": {
    "code": "INVALID_API_KEY | SCENARIO_NOT_FOUND | RUN_NOT_FOUND | VALIDATION_ERROR | UPSTREAM_ERROR",
    "message": "Human-readable explanation",
    "field": "the_offending_field | null"
  }
}
```

If you see `INVALID_API_KEY`, double-check your key in the config file and that it hasn't been revoked in the Assert dashboard.

---

## License

MIT
