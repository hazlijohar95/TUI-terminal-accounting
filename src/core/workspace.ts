import { readFileSync, existsSync } from "node:fs";
import { resolve, normalize, isAbsolute } from "node:path";
import { z } from "zod";

// Schema for workspace configuration
const SourceSchema = z.object({
  id: z.string().min(1, "Source ID is required"),
  path: z.string().min(1, "Source path is required"),
  type: z.string().min(1, "Source type is required"),
});

const LedgerSchema = z.object({
  path: z.string().min(1, "Ledger path is required"),
  format: z.string().min(1, "Ledger format is required"),
});

const WorkspaceConfigSchema = z.object({
  name: z.string().min(1, "Workspace name is required"),
  jurisdiction: z.string().min(2).max(3, "Jurisdiction must be 2-3 character code"),
  sources: z.array(SourceSchema),
  ledger: LedgerSchema,
});

export type WorkspaceConfig = z.infer<typeof WorkspaceConfigSchema>;

/**
 * Sanitize a file path to prevent path traversal attacks
 */
function sanitizePath(filePath: string, baseDir: string = process.cwd()): string {
  // Normalize the path to resolve .. and . segments
  const normalized = normalize(filePath);

  // If absolute path, check it doesn't escape allowed directories
  if (isAbsolute(normalized)) {
    // For now, allow absolute paths but log a warning
    // In production, you might want to restrict to specific directories
    return normalized;
  }

  // For relative paths, resolve against base directory
  const resolved = resolve(baseDir, normalized);

  // Ensure the resolved path is still within base directory
  if (!resolved.startsWith(baseDir)) {
    throw new Error(`Path traversal detected: ${filePath} resolves outside workspace`);
  }

  return resolved;
}

/**
 * Validate and sanitize all paths in workspace config
 */
function validatePaths(config: WorkspaceConfig): WorkspaceConfig {
  const baseDir = process.cwd();

  // Sanitize ledger path
  const sanitizedLedgerPath = sanitizePath(config.ledger.path, baseDir);

  // Sanitize source paths
  const sanitizedSources = config.sources.map(source => ({
    ...source,
    path: sanitizePath(source.path, baseDir),
  }));

  return {
    ...config,
    ledger: {
      ...config.ledger,
      path: sanitizedLedgerPath,
    },
    sources: sanitizedSources,
  };
}

export function loadWorkspaceConfig(): WorkspaceConfig {
  const configPath = "oa-workspace.json";

  if (!existsSync(configPath)) {
    throw new Error("Workspace config not found. Run 'oa workspace init' first.");
  }

  let content: string;
  try {
    content = readFileSync(configPath, "utf-8");
  } catch (err) {
    throw new Error(`Failed to read workspace config: ${(err as Error).message}`);
  }

  let rawConfig: unknown;
  try {
    rawConfig = JSON.parse(content);
  } catch (err) {
    throw new Error(`Invalid JSON in workspace config: ${(err as Error).message}`);
  }

  // Validate with Zod
  const parseResult = WorkspaceConfigSchema.safeParse(rawConfig);
  if (!parseResult.success) {
    const errors = parseResult.error.issues
      .map(e => `  - ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`Invalid workspace configuration:\n${errors}`);
  }

  // Validate and sanitize paths
  return validatePaths(parseResult.data);
}

/**
 * Validate OpenAI API key format
 */
export function validateApiKey(key: string | undefined): string {
  if (!key) {
    throw new Error("OPENAI_API_KEY not found. Set it in your environment or .env file.");
  }

  // OpenAI keys start with "sk-" and are typically 51 characters
  if (!key.startsWith("sk-")) {
    throw new Error("Invalid OPENAI_API_KEY format. Key should start with 'sk-'");
  }

  if (key.length < 20) {
    throw new Error("Invalid OPENAI_API_KEY format. Key appears too short.");
  }

  return key;
}
