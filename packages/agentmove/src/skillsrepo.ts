import { promises as fs } from "node:fs";
import path from "node:path";
import { Bundle, CliError, emptyBundle, EXIT_DATA, Skill } from "./model.js";
import { exists, isDir, listDir, readText, readTextTree } from "./fsutil.js";

/**
 * Skills repository (the skills.sh / `npx skills add owner/repo` ecosystem): a
 * repository that is neither an Agent Plugin nor an agentmove bundle but
 * carries Agent Skills as SKILL.md directories — under skills/<name>/, as
 * top-level <name>/ directories, or a single skill at the repository root.
 */
export async function isSkillsRepo(dir: string): Promise<boolean> {
  if (!(await isDir(dir))) return false;
  if (await exists(path.join(dir, "plugin.json"))) return false;
  if (await exists(path.join(dir, "manifest.json"))) return false;
  if (await exists(path.join(dir, "SKILL.md"))) return true;
  return (await skillDirNames(dir)).roots.length > 0;
}

async function skillDirNames(
  dir: string,
): Promise<{ roots: string[]; nested: boolean }> {
  const skillsRoot = path.join(dir, "skills");
  if (await isDir(skillsRoot)) {
    const names: string[] = [];
    for (const name of await listDir(skillsRoot)) {
      if (await exists(path.join(skillsRoot, name, "SKILL.md"))) names.push(name);
    }
    if (names.length) return { roots: names.sort(), nested: true };
  }
  const names: string[] = [];
  for (const name of await listDir(dir)) {
    if (name.startsWith(".")) continue;
    if (await exists(path.join(dir, name, "SKILL.md"))) names.push(name);
  }
  return { roots: names.sort(), nested: false };
}

function skillNameFrom(content: string, fallback: string): string {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (fm?.[1]) {
    const m = /^name:\s*["']?([^"'\r\n]+)["']?\s*$/m.exec(fm[1]);
    if (m?.[1]) return m[1].trim();
  }
  return fallback;
}

export async function readSkillsRepo(
  dir: string,
): Promise<{ bundle: Bundle; warnings: string[] }> {
  const warnings: string[] = [];
  const bundle = emptyBundle();
  const skills: Skill[] = [];

  const rootSkill = await readText(path.join(dir, "SKILL.md"));
  if (rootSkill !== undefined) {
    const files = await readTextTree(dir, warnings);
    skills.push({ name: skillNameFrom(rootSkill, path.basename(dir)), files });
  } else {
    const { roots, nested } = await skillDirNames(dir);
    const base = nested ? path.join(dir, "skills") : dir;
    for (const name of roots) {
      const files = await readTextTree(path.join(base, name), warnings);
      if (Object.keys(files).length) skills.push({ name, files });
    }
  }

  bundle.skills = skills;
  warnings.push(
    `imported as a skills repository (${skills.length} skill(s) from SKILL.md directories); no other layers present`,
  );
  return { bundle, warnings };
}

/**
 * Strip `gh skill install` source-tracking metadata (the `github-*` keys the
 * GitHub CLI injects into the frontmatter `metadata:` map) from a SKILL.md.
 * `gh skill publish` rejects skills that still carry them; this mirrors its
 * `--fix`. Everything else is left byte-identical.
 */
export function stripInstallMetadata(content: string): { content: string; stripped: boolean } {
  const fm = /^---\r?\n([\s\S]*?\r?\n)---/.exec(content);
  if (!fm?.[1]) return { content, stripped: false };
  const lines = fm[1].split(/(?<=\n)/);
  const out: string[] = [];
  let stripped = false;
  let metadataAt = -1;
  let skipDeeperThan = -1;
  for (const line of lines) {
    const indent = /^[ \t]*/.exec(line)![0].length;
    const text = line.trim();
    if (skipDeeperThan >= 0 && text !== "" && indent > skipDeeperThan) continue;
    skipDeeperThan = -1;
    if (/^metadata:\s*$/.test(text) && indent === 0) {
      metadataAt = out.length;
      out.push(line);
      continue;
    }
    if (metadataAt >= 0 && indent > 0 && /^github-[\w-]+:/.test(text)) {
      stripped = true;
      skipDeeperThan = indent;
      continue;
    }
    if (text !== "" && indent === 0) metadataAt = -1;
    out.push(line);
  }
  if (!stripped) return { content, stripped: false };
  // drop a metadata: line left with no children
  const cleaned: string[] = [];
  for (let i = 0; i < out.length; i++) {
    if (/^metadata:\s*$/.test(out[i]!.trim())) {
      const next = out[i + 1];
      if (next === undefined || /^\S/.test(next)) continue;
    }
    cleaned.push(out[i]!);
  }
  const open = /^---\r?\n/.exec(fm[0])![0];
  return {
    content: open + cleaned.join("") + content.slice(fm[0].length - 3),
    stripped: true,
  };
}

/**
 * Write the bundle's skills as a skills repository in the nested layout
 * (skills/<name>/SKILL.md) recognized across the ecosystem — `npx skills add`,
 * `gh skill publish`, and agentmove's own skills-repository import. Install
 * tracking metadata injected by `gh skill install` is stripped so the result
 * passes `gh skill publish` validation.
 */
export async function writeSkillsRepo(skills: Skill[], dir: string): Promise<string[]> {
  if (!skills.length) {
    throw new CliError("no skills to export as a skills repository", EXIT_DATA);
  }
  const warnings: string[] = [];
  for (const skill of skills) {
    for (const [rel, content] of Object.entries(skill.files)) {
      const file = path.join(dir, "skills", skill.name, rel);
      let data = content;
      if (rel === "SKILL.md") {
        const res = stripInstallMetadata(content);
        data = res.content;
        if (res.stripped) {
          warnings.push(
            `skill:${skill.name}: stripped gh install-tracking metadata (metadata.github-*) — gh skill publish rejects skills that carry it`,
          );
        }
      }
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, data);
    }
  }
  return warnings;
}
