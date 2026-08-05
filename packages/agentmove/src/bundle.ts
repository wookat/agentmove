import { promises as fs } from "node:fs";
import path from "node:path";
import {
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
 *   memory/memory.json, memory/raw/<source files>, skills/<name>/...
 */
export async function writeBundle(bundle: Bundle, dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
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
  return bundle;
}

const SECRET_KEY_RE = /(key|token|secret|password|credential)/i;

/** Replace likely-secret env/header values with ${VAR} placeholders unless keeping secrets. */
export function stripSecrets(bundle: Bundle): { bundle: Bundle; redacted: string[] } {
  const redacted: string[] = [];
  const servers = bundle.mcpServers.map((s) => {
    const clean = (rec: Record<string, string> | undefined, ctx: string) => {
      if (!rec) return rec;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(rec)) {
        if (SECRET_KEY_RE.test(k) && v && !v.startsWith("${")) {
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
  return { bundle: { ...bundle, mcpServers: servers }, redacted };
}
