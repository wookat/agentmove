import { promises as fs } from "node:fs";
import path from "node:path";

export async function readText(file: string): Promise<string | undefined> {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return undefined;
  }
}

export async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export async function listDir(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

export async function isDir(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

const TEXT_EXTENSIONS = new Set([
  ".md", ".txt", ".json", ".json5", ".yaml", ".yml", ".toml", ".js", ".mjs", ".cjs",
  ".ts", ".py", ".sh", ".bash", ".rb", ".csv", ".xml", ".html", ".css", ".env",
]);

export function isTextFile(name: string): boolean {
  const ext = path.extname(name).toLowerCase();
  return ext === "" || TEXT_EXTENSIONS.has(ext);
}

/** Recursively read text files in a directory. Returns relative path -> content. */
export async function readTextTree(
  dir: string,
  warnings: string[],
  prefix = "",
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const name of await listDir(dir)) {
    const full = path.join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (await isDir(full)) {
      Object.assign(out, await readTextTree(full, warnings, rel));
    } else if (isTextFile(name)) {
      const content = await readText(full);
      if (content !== undefined) out[rel] = content;
    } else {
      warnings.push(`${rel}: non-text file skipped (binary assets are not migrated in v0)`);
    }
  }
  return out;
}
