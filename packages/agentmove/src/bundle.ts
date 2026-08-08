import { promises as fs } from "node:fs";
import path from "node:path";
import {
  AgentDef,
  Bundle,
  CliError,
  emptyBundle,
  EXIT_DATA,
  isRecord,
  MemoryEntry,
  parseFile,
  Skill,
} from "./model.js";
import { listDir, isDir, readText, readTextTree } from "./fsutil.js";

/**
 * On-disk bundle layout:
 *   manifest.json, config.json, mcp-servers.json, instructions.md, persona.md,
 *   memory/memory.json, memory/raw/<source files>, skills/<name>/..., agents/<name>.md
 */
/** Bundle-owned entries removed before a re-export so no stale layers linger. */
const BUNDLE_ENTRIES = [
  "manifest.json",
  "config.json",
  "mcp-servers.json",
  "instructions.md",
  "persona.md",
  "memory",
  "skills",
  "agents",
];

export async function writeBundle(bundle: Bundle, dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  for (const entry of BUNDLE_ENTRIES) {
    await fs.rm(path.join(dir, entry), { recursive: true, force: true });
  }
  const manifest = { ...bundle.manifest, exportedAt: bundle.manifest.exportedAt ?? new Date().toISOString() };
  await fs.writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  await fs.writeFile(path.join(dir, "config.json"), JSON.stringify(bundle.config, null, 2) + "\n");
  await fs.writeFile(
    path.join(dir, "mcp-servers.json"),
    JSON.stringify(bundle.mcpServers, null, 2) + "\n",
  );
  if (bundle.instructions !== undefined) {
    await fs.writeFile(path.join(dir, "instructions.md"), bundle.instructions);
  }
  if (bundle.persona !== undefined) {
    await fs.writeFile(path.join(dir, "persona.md"), bundle.persona);
  }
  await fs.mkdir(path.join(dir, "memory/raw"), { recursive: true });
  await fs.writeFile(
    path.join(dir, "memory/memory.json"),
    JSON.stringify(bundle.memory, null, 2) + "\n",
  );
  for (const entry of bundle.memory) {
    const raw = path.join(dir, "memory/raw", entry.source.replace(/[/\\]/g, "__"));
    await fs.writeFile(raw, entry.content);
  }
  for (const skill of bundle.skills) {
    for (const [rel, content] of Object.entries(skill.files)) {
      const file = path.join(dir, "skills", skill.name, rel);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, content);
    }
  }
  if (bundle.agents.length) {
    await fs.mkdir(path.join(dir, "agents"), { recursive: true });
    for (const agent of bundle.agents) {
      await fs.writeFile(path.join(dir, "agents", `${agent.name}.md`), agent.content);
    }
  }
}

export async function readBundle(dir: string): Promise<Bundle> {
  const bundle = emptyBundle();
  const manifestRaw = await readText(path.join(dir, "manifest.json"));
  if (manifestRaw === undefined) {
    throw new CliError(`${dir}: not an agentmove bundle (missing manifest.json)`, EXIT_DATA);
  }
  const manifest = parseFile<unknown>(path.join(dir, "manifest.json"), manifestRaw, JSON.parse);
  if (!isRecord(manifest) || manifest.schemaVersion !== 1) {
    throw new CliError(`${dir}: unsupported bundle schema (expected schemaVersion 1)`, EXIT_DATA);
  }
  bundle.manifest = {
    schemaVersion: 1,
    exportedFrom: typeof manifest.exportedFrom === "string" ? manifest.exportedFrom : undefined,
    exportedAt: typeof manifest.exportedAt === "string" ? manifest.exportedAt : undefined,
  };

  const configRaw = await readText(path.join(dir, "config.json"));
  if (configRaw !== undefined) {
    const config = parseFile<unknown>(path.join(dir, "config.json"), configRaw, JSON.parse);
    if (isRecord(config)) bundle.config = config as Bundle["config"];
  }
  const mcpRaw = await readText(path.join(dir, "mcp-servers.json"));
  if (mcpRaw !== undefined) {
    const servers = parseFile<unknown>(path.join(dir, "mcp-servers.json"), mcpRaw, JSON.parse);
    if (Array.isArray(servers)) bundle.mcpServers = servers as Bundle["mcpServers"];
  }
  bundle.instructions = await readText(path.join(dir, "instructions.md"));
  bundle.persona = await readText(path.join(dir, "persona.md"));

  const memoryRaw = await readText(path.join(dir, "memory/memory.json"));
  if (memoryRaw !== undefined) {
    const memory = parseFile<unknown>(path.join(dir, "memory/memory.json"), memoryRaw, JSON.parse);
    if (Array.isArray(memory)) bundle.memory = memory as MemoryEntry[];
  }

  const skillsDir = path.join(dir, "skills");
  if (await isDir(skillsDir)) {
    const skills: Skill[] = [];
    for (const name of await listDir(skillsDir)) {
      const skillDir = path.join(skillsDir, name);
      if (!(await isDir(skillDir))) continue;
      const files = await readTextTree(skillDir, []);
      if (Object.keys(files).length) skills.push({ name, files });
    }
    bundle.skills = skills;
  }

  const agentsDir = path.join(dir, "agents");
  if (await isDir(agentsDir)) {
    const agents: AgentDef[] = [];
    for (const name of (await listDir(agentsDir)).sort()) {
      if (!name.endsWith(".md")) continue;
      const content = await readText(path.join(agentsDir, name));
      if (content !== undefined) agents.push({ name: name.slice(0, -3), content });
    }
    bundle.agents = agents;
  }
  return bundle;
}

const SECRET_KEY_RE = /(key|token|secret|password|credential|authorization|cookie)/i;

/** Keys whose values are env-var *names* (e.g. Codex bearer_token_env_var), not secrets. */
const ENV_VAR_NAME_KEY_RE = /_env_var(s)?$/i;

/** Values that are already env-var placeholders (optionally with a Bearer prefix) carry no literal secret. */
function isPlaceholderValue(v: string): boolean {
  return /^(Bearer )?\$\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(v) || v.startsWith("${");
}

function redactValue(value: unknown, ctx: string, redacted: string[]): unknown {
  if (Array.isArray(value)) {
    return value.map((item, i) => redactValue(item, `${ctx}[${i}]`, redacted));
  }
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (
        SECRET_KEY_RE.test(k) &&
        !ENV_VAR_NAME_KEY_RE.test(k) &&
        typeof v === "string" &&
        v &&
        !isPlaceholderValue(v)
      ) {
        out[k] = `\${${k}}`;
        redacted.push(`${ctx}.${k}`);
      } else {
        out[k] = redactValue(v, `${ctx}.${k}`, redacted);
      }
    }
    return out;
  }
  return value;
}

/** Replace likely-secret env/header values with ${VAR} placeholders unless keeping secrets. */
export function stripSecrets(bundle: Bundle): { bundle: Bundle; redacted: string[] } {
  const redacted: string[] = [];
  const servers = bundle.mcpServers.map((s) => {
    const clean = (rec: Record<string, string> | undefined, ctx: string) => {
      if (!rec) return rec;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(rec)) {
        if (SECRET_KEY_RE.test(k) && v && !isPlaceholderValue(v)) {
          out[k] = `\${${k}}`;
          redacted.push(`mcp:${s.name}.${ctx}.${k}`);
        } else {
          out[k] = v;
        }
      }
      return out;
    };
    return { ...s, env: clean(s.env, "env"), headers: clean(s.headers, "headers") };
  });
  const config: Bundle["config"] = bundle.config.raw
    ? { ...bundle.config, raw: redactValue(bundle.config.raw, "config", redacted) as Record<string, unknown> }
    : bundle.config;
  return { bundle: { ...bundle, mcpServers: servers, config }, redacted };
}
