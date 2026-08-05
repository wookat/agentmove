export type Transport = "stdio" | "http" | "sse";

/** Exit-code contract: 0 success, 2 usage error, 3 bad input data. */
export const EXIT_USAGE = 2;
export const EXIT_DATA = 3;

export class CliError extends Error {
  constructor(
    message: string,
    readonly exitCode: number,
  ) {
    super(message);
    this.name = "CliError";
  }
}

/** Parse file contents, wrapping parser errors with the file path for context. */
export function parseFile<T>(file: string, raw: string, parse: (s: string) => T): T {
  try {
    return parse(raw);
  } catch (e) {
    throw new CliError(`${file}: ${(e as Error).message}`, EXIT_DATA);
  }
}

export interface McpServer {
  name: string;
  transport: Transport;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  headers?: Record<string, string>;
  enabled?: boolean;
}

export type MemoryKind = "long-term" | "daily" | "user-profile";

export interface MemoryEntry {
  content: string;
  /** Original file the entry came from, relative to the client home. */
  source: string;
  kind: MemoryKind;
  /** ISO date (YYYY-MM-DD) for daily entries. */
  date?: string;
}

export interface Skill {
  name: string;
  /** Relative path inside the skill directory -> file content. */
  files: Record<string, string>;
}

export interface BundleManifest {
  schemaVersion: 1;
  exportedFrom?: string;
  exportedAt?: string;
}

export interface Bundle {
  manifest: BundleManifest;
  /** Normalized config subset; `raw` keeps unmapped client config for reference. */
  config: { model?: string; raw?: Record<string, unknown> };
  mcpServers: McpServer[];
  /** Global instructions (AGENTS.md / CLAUDE.md / GEMINI.md style). */
  instructions?: string;
  /** Persona (SOUL.md style). */
  persona?: string;
  memory: MemoryEntry[];
  skills: Skill[];
}

export type Layer = "mcp" | "skills" | "memory" | "instructions" | "persona";

export const LAYERS: Layer[] = ["mcp", "skills", "memory", "instructions", "persona"];

/** Parse a comma-separated `--only` value into layers (usage error on unknowns). */
export function parseLayers(only: string): Layer[] {
  const layers = only.split(",").map((l) => l.trim()).filter(Boolean);
  for (const l of layers) {
    if (!LAYERS.includes(l as Layer)) {
      throw new CliError(`unknown layer "${l}" (expected one of: ${LAYERS.join(", ")})`, EXIT_USAGE);
    }
  }
  return layers as Layer[];
}

/** Keep only the given layers of a bundle (config/model always kept). */
export function filterBundle(bundle: Bundle, layers: Layer[]): Bundle {
  const keep = new Set(layers);
  return {
    ...bundle,
    mcpServers: keep.has("mcp") ? bundle.mcpServers : [],
    skills: keep.has("skills") ? bundle.skills : [],
    memory: keep.has("memory") ? bundle.memory : [],
    instructions: keep.has("instructions") ? bundle.instructions : undefined,
    persona: keep.has("persona") ? bundle.persona : undefined,
  };
}

export function emptyBundle(): Bundle {
  return {
    manifest: { schemaVersion: 1 },
    config: {},
    mcpServers: [],
    memory: [],
    skills: [],
  };
}

export type ClientId =
  | "openclaw"
  | "hermes"
  | "claude-code"
  | "codex"
  | "cursor"
  | "gemini"
  | "windsurf";

export const CLIENT_IDS: ClientId[] = [
  "openclaw",
  "hermes",
  "claude-code",
  "codex",
  "cursor",
  "gemini",
  "windsurf",
];

export interface ExportResult {
  bundle: Bundle;
  warnings: string[];
}

/** A planned file write, relative to the OS home directory. */
export interface FilePlan {
  path: string;
  content: string;
}

export interface ImportResult {
  files: FilePlan[];
  warnings: string[];
}

export interface ImportOptions {
  /** Replace the target's MCP server list instead of merging into it. */
  replaceMcp?: boolean;
}

export interface ClientAdapter {
  id: ClientId;
  label: string;
  /** Human-readable default location of the client's data, for docs/doctor. */
  defaultPath: string;
  /** Whether the client appears to be configured under the given home dir. */
  detect(home: string): Promise<boolean>;
  exportBundle(home: string): Promise<ExportResult>;
  /**
   * Plan an import: returns the file writes that would apply the bundle.
   * Never touches the filesystem for writes; the CLI applies plans.
   */
  planImport(bundle: Bundle, home: string, opts?: ImportOptions): Promise<ImportResult>;
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function asStringRecord(
  v: unknown,
  ctx: string,
  warnings: string[],
): Record<string, string> | undefined {
  if (v === undefined) return undefined;
  if (!isRecord(v)) {
    warnings.push(`${ctx}: expected an object of strings; dropped`);
    return undefined;
  }
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === "string") out[k] = val;
    else warnings.push(`${ctx}.${k}: non-string value dropped`);
  }
  return out;
}

export function stringArgs(v: unknown, ctx: string, warnings: string[]): string[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) {
    warnings.push(`${ctx}: expected an array; dropped`);
    return undefined;
  }
  return v.map(String);
}
