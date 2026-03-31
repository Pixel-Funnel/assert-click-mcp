import fs from "node:fs";
import path from "node:path";

export const CONFIG_FILE = "assert.config.json";
export const LOCAL_CONFIG_FILE = "assert.config.local.json";

type JsonObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => cloneValue(item)) as T;
  if (isPlainObject(value)) {
    const out: JsonObject = {};
    for (const [key, inner] of Object.entries(value)) out[key] = cloneValue(inner);
    return out as T;
  }
  return value;
}

function mergeConfig(base: JsonObject, extra: JsonObject): JsonObject {
  const out = cloneValue(base);
  for (const [key, value] of Object.entries(extra)) {
    const current = out[key];
    if (isPlainObject(current) && isPlainObject(value)) {
      out[key] = mergeConfig(current, value);
      continue;
    }
    out[key] = cloneValue(value);
  }
  return out;
}

function readConfigFile(absPath: string): JsonObject {
  let raw: string;
  try {
    raw = fs.readFileSync(absPath, "utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read ${path.basename(absPath)}: ${message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid JSON in ${path.basename(absPath)}: ${message}`);
  }

  if (!isPlainObject(parsed)) {
    throw new Error(`${path.basename(absPath)} must contain a JSON object`);
  }
  return parsed;
}

function findConfigDirectory(startDir: string): string | null {
  let current = path.resolve(startDir);
  while (true) {
    if (
      fs.existsSync(path.join(current, CONFIG_FILE)) ||
      fs.existsSync(path.join(current, LOCAL_CONFIG_FILE))
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function resolveExplicitTarget(cwd: string, configPath: string): { configDir: string; files: string[] } {
  const target = path.resolve(cwd, configPath);
  if (!fs.existsSync(target)) {
    throw new Error(`Config file not found: ${configPath}`);
  }
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    return {
      configDir: target,
      files: [path.join(target, CONFIG_FILE), path.join(target, LOCAL_CONFIG_FILE)].filter((filePath) => fs.existsSync(filePath)),
    };
  }

  const configDir = path.dirname(target);
  const baseName = path.basename(target);
  if (baseName === CONFIG_FILE) {
    return {
      configDir,
      files: [target, path.join(configDir, LOCAL_CONFIG_FILE)].filter((filePath) => fs.existsSync(filePath)),
    };
  }
  if (baseName === LOCAL_CONFIG_FILE) {
    return {
      configDir,
      files: [path.join(configDir, CONFIG_FILE), target].filter((filePath) => fs.existsSync(filePath)),
    };
  }
  return { configDir, files: [target] };
}

function readString(source: unknown, keys: string[]): string | null {
  if (!isPlainObject(source)) return null;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function sectionFor(config: JsonObject, sectionName: string): JsonObject {
  const section = config[sectionName];
  return isPlainObject(section) ? section : {};
}

function resolveApiKey(env: NodeJS.ProcessEnv, common: JsonObject, section: JsonObject): string | null {
  const envName =
    readString(section, ["projectApiKeyEnv"]) ||
    readString(common, ["projectApiKeyEnv"]);
  const envCandidates = ["ASSERT_API_KEY"];
  if (envName && !envCandidates.includes(envName)) envCandidates.push(envName);
  for (const name of envCandidates) {
    const value = env[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return (
    readString(section, ["projectApiKey"]) ||
    readString(common, ["projectApiKey"]) ||
    null
  );
}

export interface ResolvedMcpConfig {
  apiKey: string | null;
  baseUrl: string;
  projectId: string | null;
  loadedFiles: string[];
}

export function resolveMcpConfig(options: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  configPath?: string | null;
  defaultBaseUrl?: string;
} = {}): ResolvedMcpConfig {
  const cwd = options.cwd || process.cwd();
  const env = options.env || process.env;
  const configPath = options.configPath || env.ASSERT_CONFIG || null;

  let configDir: string | null = null;
  let files: string[] = [];
  let baseConfig: JsonObject = {};
  let localConfig: JsonObject = {};
  if (configPath) {
    const explicit = resolveExplicitTarget(cwd, configPath);
    configDir = explicit.configDir;
    files = explicit.files;
  } else {
    configDir = findConfigDirectory(cwd);
    if (configDir) {
      files = [path.join(configDir, CONFIG_FILE), path.join(configDir, LOCAL_CONFIG_FILE)].filter((filePath) => fs.existsSync(filePath));
    }
  }

  let config: JsonObject = {};
  for (const filePath of files) {
    const parsed = readConfigFile(filePath);
    const baseName = path.basename(filePath);
    if (baseName === LOCAL_CONFIG_FILE) {
      localConfig = mergeConfig(localConfig, parsed);
    } else {
      baseConfig = mergeConfig(baseConfig, parsed);
    }
    config = mergeConfig(config, parsed);
  }

  const mcp = sectionFor(config, "mcp");
  const localMcp = sectionFor(localConfig, "mcp");
  return {
    apiKey: resolveApiKey(env, config, mcp),
    baseUrl:
      (env.ASSERT_API_URL ||
        env.ASSERT_HOST_URL ||
        readString(localMcp, ["apiUrl", "baseUrl", "hostUrl"]) ||
        readString(localConfig, ["apiUrl", "baseUrl", "hostUrl"]) ||
        options.defaultBaseUrl ||
        "https://api.assert.click").replace(/\/$/, ""),
    projectId:
      env.ASSERT_PROJECT_ID ||
      readString(mcp, ["projectId", "project_id"]) ||
      readString(config, ["projectId", "project_id"]) ||
      null,
    loadedFiles: files,
  };
}
