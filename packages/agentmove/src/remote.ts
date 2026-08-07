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

const ARCHIVE_SUFFIX = /\.(zip|tgz|tar\.gz)(\?.*)?$/;

export function isArchiveInput(input: string): boolean {
  return ARCHIVE_SUFFIX.test(input);
}

/**
 * Extract a .zip / .tgz / .tar.gz archive into a temp directory and return
 * the directory to hand to the detection chain. If the archive unpacks to a
 * single top-level directory (GitHub "Download ZIP" / release-asset layout),
 * that directory is returned instead of the wrapper.
 */
export async function extractArchive(file: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-archive-"));
  const isZip = /\.zip$/i.test(file.replace(/\?.*$/, ""));
  const attempts: [string, string[]][] = isZip
    ? [
        ["unzip", ["-q", file, "-d", dir]],
        ["tar", ["-xf", file, "-C", dir]],
      ]
    : [["tar", ["-xzf", file, "-C", dir]]];
  let lastError = "";
  let extracted = false;
  for (const [cmd, args] of attempts) {
    try {
      await execFileAsync(cmd, args);
      extracted = true;
      break;
    } catch (e) {
      lastError = (e as Error).message.split("\n")[0]!;
    }
  }
  if (!extracted) {
    throw new CliError(`${file}: archive extraction failed (${lastError})`, EXIT_DATA);
  }
  const entries = (await fs.readdir(dir, { withFileTypes: true })).filter(
    (e) => e.name !== "__MACOSX",
  );
  if (entries.length === 1 && entries[0]!.isDirectory()) {
    return path.join(dir, entries[0]!.name);
  }
  return dir;
}

/**
 * Archive a directory into a .zip / .tgz / .tar.gz file (the directory itself
 * becomes the single top-level entry). Uses system tools: `tar -czf` for
 * tarballs; for zip, `zip -r` first then `tar -a -cf` (bsdtar on Windows and
 * macOS creates zip natively).
 */
export async function createArchive(srcDir: string, outFile: string): Promise<void> {
  const parent = path.dirname(path.resolve(srcDir));
  const base = path.basename(path.resolve(srcDir));
  const out = path.resolve(outFile);
  const isZip = /\.zip$/i.test(out);
  const attempts: [string, string[], string | undefined][] = isZip
    ? [
        ["zip", ["-qr", out, base], parent],
        ["tar", ["-a", "-cf", out, "-C", parent, base], undefined],
      ]
    : [["tar", ["-czf", out, "-C", parent, base], undefined]];
  let lastError = "";
  for (const [cmd, args, cwd] of attempts) {
    try {
      await execFileAsync(cmd, args, cwd ? { cwd } : {});
      return;
    } catch (e) {
      lastError = (e as Error).message.split("\n")[0]!;
    }
  }
  throw new CliError(`${outFile}: archive creation failed (${lastError})`, EXIT_DATA);
}

/**
 * Resolve an http(s) import source to a local path the normal detection chain
 * can handle: a URL ending in .json is fetched to a temp file (standalone
 * mcp.json), a .zip / .tgz / .tar.gz URL is downloaded and extracted (an
 * Agent Plugin, bundle, or skills repository shipped as an archive, e.g. a
 * GitHub release asset or "Download ZIP" link), a /tree/<branch>/<subpath>
 * URL is shallow-cloned at that branch and resolved to the subdirectory,
 * anything else is shallow-cloned with git.
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

  if (isArchiveInput(input)) {
    let res: Response;
    try {
      res = await fetch(input);
    } catch (e) {
      throw new CliError(`${input}: fetch failed (${(e as Error).message})`, EXIT_DATA);
    }
    if (!res.ok) {
      throw new CliError(`${input}: fetch failed (HTTP ${res.status})`, EXIT_DATA);
    }
    const base = path.basename(new URL(input).pathname) || "archive";
    const file = path.join(work, base);
    await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
    return extractArchive(file);
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
