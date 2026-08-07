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
 * A GitHub-style tree URL pointing at a branch (and optionally a directory)
 * inside a repository: https://host/owner/repo/tree/<branch>[/<subpath>].
 * The branch is taken as the first path segment after /tree/ (branch names
 * containing slashes are not resolvable from the URL alone).
 */
const TREE_URL = /^(https?:\/\/[^/]+\/[^/]+\/[^/]+)\/tree\/([^/]+)(?:\/(.+?))?\/?$/;

/**
 * A GitLab-style tree URL: https://host/group[/subgroup…]/repo/-/tree/<branch>[/<subpath>].
 * The explicit /-/ marker allows arbitrarily nested subgroups before the repo.
 */
const GITLAB_TREE_URL = /^(https?:\/\/[^/]+\/.+?)\/-\/tree\/([^/]+)(?:\/(.+?))?\/?$/;

export function parseTreeUrl(
  input: string,
): { repo: string; branch: string; subpath?: string } | undefined {
  const m = GITLAB_TREE_URL.exec(input) ?? TREE_URL.exec(input);
  if (!m) return undefined;
  return { repo: m[1]!, branch: m[2]!, subpath: m[3] };
}

/**
 * Rewrite a web "blob" file URL to the raw file it renders, so a pasted
 * GitHub/GitLab file link to a .json config fetches the file instead of the
 * HTML page: github.com/o/r/blob/<ref>/<path> → raw.githubusercontent.com,
 * and GitLab's /-/blob/ → /-/raw/.
 */
export function rewriteBlobUrl(input: string): string {
  const gh = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/.exec(input);
  if (gh) return `https://raw.githubusercontent.com/${gh[1]}/${gh[2]}/${gh[3]}`;
  return input.replace(/^(https?:\/\/[^/]+\/.+?)\/-\/blob\//, "$1/-/raw/");
}

/**
 * Resolve an http(s) import source to a local path the normal detection chain
 * can handle: a URL ending in .json is fetched to a temp file (standalone
 * mcp.json), a /tree/<branch>/<subpath> URL is shallow-cloned at that branch
 * and resolved to the subdirectory, anything else is shallow-cloned with git
 * (an Agent Plugin, agentmove bundle, or skills repository).
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
    const url = rewriteBlobUrl(input);
    let res: Response;
    try {
      res = await fetch(url);
    } catch (e) {
      throw new CliError(`${input}: fetch failed (${(e as Error).message})`, EXIT_DATA);
    }
    if (!res.ok) {
      throw new CliError(`${url}: fetch failed (HTTP ${res.status})`, EXIT_DATA);
    }
    const file = path.join(work, "remote-mcp.json");
    await fs.writeFile(file, await res.text());
    return file;
  }

  const dir = path.join(work, "repo");
  const tree = parseTreeUrl(input);
  const cloneUrl = tree ? tree.repo : input;
  const args = ["clone", "--depth", "1"];
  if (tree) args.push("--branch", tree.branch);
  try {
    await execFileAsync("git", [...args, cloneUrl, dir], {
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
  } catch (e) {
    throw new CliError(
      `${input}: git clone failed (${(e as Error).message.split("\n")[0]})`,
      EXIT_DATA,
    );
  }
  if (tree?.subpath) {
    const resolved = path.resolve(path.join(dir, ...tree.subpath.split("/")));
    if (!resolved.startsWith(path.resolve(dir) + path.sep)) {
      throw new CliError(`${input}: invalid path inside the repository`, EXIT_DATA);
    }
    try {
      if (!(await fs.stat(resolved)).isDirectory()) throw new Error("not a directory");
    } catch {
      throw new CliError(
        `${input}: path "${tree.subpath}" not found in the repository (branch ${tree.branch})`,
        EXIT_DATA,
      );
    }
    return resolved;
  }
  return dir;
}
