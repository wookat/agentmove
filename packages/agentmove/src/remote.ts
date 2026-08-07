import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { CliError, EXIT_DATA } from "./model.js";

const execFileAsync = promisify(execFile);

export function isRemoteInput(input: string): boolean {
  return /^https?:\/\//.test(input);
}

/**
 * Resolve an http(s) import source to a local path the normal detection chain
 * can handle: a URL ending in .json is fetched to a temp file (standalone
 * mcp.json), anything else is shallow-cloned with git (an Agent Plugin or
 * agentmove bundle repository).
 */
export async function fetchRemoteInput(
  input: string,
  warnings: string[],
): Promise<string> {
  if (input.startsWith("http://")) {
    warnings.push(`${input}: insecure http URL; prefer https`);
  }
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-remote-"));

  if (/\.json(\?.*)?$/.test(input)) {
    let res: Response;
    try {
      res = await fetch(input);
    } catch (e) {
      throw new CliError(`${input}: fetch failed (${(e as Error).message})`, EXIT_DATA);
    }
    if (!res.ok) {
      throw new CliError(`${input}: fetch failed (HTTP ${res.status})`, EXIT_DATA);
    }
    const file = path.join(work, "remote-mcp.json");
    await fs.writeFile(file, await res.text());
    return file;
  }

  const dir = path.join(work, "repo");
  try {
    await execFileAsync("git", ["clone", "--depth", "1", input, dir], {
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
  } catch (e) {
    throw new CliError(
      `${input}: git clone failed (${(e as Error).message.split("\n")[0]})`,
      EXIT_DATA,
    );
  }
  return dir;
}
