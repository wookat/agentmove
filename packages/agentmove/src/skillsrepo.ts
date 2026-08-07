import path from "node:path";
import { Bundle, emptyBundle, Skill } from "./model.js";
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
