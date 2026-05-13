import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

let packageVersion = "0.0.0";
try {
  packageVersion = String(require("../package.json")?.version || packageVersion);
} catch {
  // Fall back to a safe placeholder if package.json cannot be resolved.
}

export const PACKAGE_VERSION = packageVersion;
export const USER_AGENT = `assert-mcp/${PACKAGE_VERSION}`;
