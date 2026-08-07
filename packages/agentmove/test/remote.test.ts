import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import {
  createArchive,
  extractArchive,
  fetchRemoteInput,
  isArchiveInput,
  isRemoteInput,
  parseTreeUrl,
  rewriteBlobUrl,
} from "../src/remote.js";
import { isMcpJsonFile, isPluginDir, readMcpFile } from "../src/plugin.js";
import { CliError } from "../src/model.js";

const MCP = {
  mcpServers: { fsx: { type: "stdio", command: "npx", args: ["fs-mcp"] } },
};

let server: http.Server;
let base: string;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === "/team-mcp.json") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(MCP));
    } else {
      res.statusCode = 404;
      res.end("not found");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address() as { port: number };
  base = `http://127.0.0.1:${addr.port}`;
});

afterAll(() => {
  server.close();
});

describe("remote import inputs", () => {
  it("classifies URLs vs local paths", () => {
    expect(isRemoteInput("https://example.com/mcp.json")).toBe(true);
    expect(isRemoteInput("http://example.com/repo")).toBe(true);
    expect(isRemoteInput("./bundle")).toBe(false);
    expect(isRemoteInput("/abs/mcp.json")).toBe(false);
  });

  it("fetches a .json URL to a temp file usable as a standalone mcp.json", async () => {
    const warnings: string[] = [];
    const file = await fetchRemoteInput(`${base}/team-mcp.json`, warnings);
    expect(await isMcpJsonFile(file)).toBe(true);
    const { bundle } = await readMcpFile(file);
    expect(bundle.mcpServers.map((s) => [s.name, s.transport])).toEqual([["fsx", "stdio"]]);
    expect(warnings.some((w) => w.includes("insecure http URL"))).toBe(true);
  });

  it("fails with a data error on HTTP errors", async () => {
    await expect(fetchRemoteInput(`${base}/missing.json`, [])).rejects.toThrowError(CliError);
    await expect(fetchRemoteInput(`${base}/missing.json`, [])).rejects.toThrow(/HTTP 404/);
  });

  it("clones a non-.json URL with git and detects an Agent Plugin", async () => {
    const src = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-remote-src-"));
    await fs.writeFile(
      path.join(src, "plugin.json"),
      JSON.stringify({ name: "team-plugin" }) + "\n",
    );
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: src, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
    git("init", "-q");
    git("-c", "user.email=t@t", "-c", "user.name=t", "add", "plugin.json");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "init");
    // A local path clones the same way a remote git URL does.
    const dir = await fetchRemoteInput(src, []);
    expect(await isPluginDir(dir)).toBe(true);
  });

  it("parses tree URLs into repo, branch, and subpath", () => {
    expect(
      parseTreeUrl("https://github.com/acme/skills/tree/main/skills/web-design"),
    ).toEqual({ repo: "https://github.com/acme/skills", branch: "main", subpath: "skills/web-design" });
    expect(parseTreeUrl("https://github.com/acme/skills/tree/v2")).toEqual({
      repo: "https://github.com/acme/skills",
      branch: "v2",
      subpath: undefined,
    });
    expect(parseTreeUrl("https://github.com/acme/skills/tree/main/dir/")).toEqual({
      repo: "https://github.com/acme/skills",
      branch: "main",
      subpath: "dir",
    });
    expect(parseTreeUrl("https://github.com/acme/skills")).toBeUndefined();
    expect(parseTreeUrl("https://github.com/acme/skills/blob/main/SKILL.md")).toBeUndefined();
  });

  it("parses GitLab-style /-/tree/ URLs, including subgroups", () => {
    expect(
      parseTreeUrl("https://gitlab.com/group/sub/repo/-/tree/main/skills/web"),
    ).toEqual({ repo: "https://gitlab.com/group/sub/repo", branch: "main", subpath: "skills/web" });
    expect(parseTreeUrl("https://gitlab.com/group/repo/-/tree/v2")).toEqual({
      repo: "https://gitlab.com/group/repo",
      branch: "v2",
      subpath: undefined,
    });
  });

  it("rewrites blob file URLs to their raw form", () => {
    expect(rewriteBlobUrl("https://github.com/acme/dev/blob/main/team-mcp.json")).toBe(
      "https://raw.githubusercontent.com/acme/dev/main/team-mcp.json",
    );
    expect(
      rewriteBlobUrl("https://gitlab.com/group/sub/repo/-/blob/main/team-mcp.json"),
    ).toBe("https://gitlab.com/group/sub/repo/-/raw/main/team-mcp.json");
    expect(rewriteBlobUrl("https://example.com/team-mcp.json")).toBe(
      "https://example.com/team-mcp.json",
    );
  });

  it("recognizes archive inputs", () => {
    expect(isArchiveInput("plugin.zip")).toBe(true);
    expect(isArchiveInput("https://example.com/skills.tar.gz")).toBe(true);
    expect(isArchiveInput("https://example.com/skills.tgz?token=x")).toBe(true);
    expect(isArchiveInput("https://example.com/repo")).toBe(false);
    expect(isArchiveInput("bundle")).toBe(false);
  });

  it("extracts a .tgz archive and unwraps a single top-level directory", async () => {
    const work = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-test-"));
    const src = path.join(work, "my-skills");
    await fs.mkdir(path.join(src, "skills", "web"), { recursive: true });
    await fs.writeFile(path.join(src, "skills", "web", "SKILL.md"), "# web\n");
    const archive = path.join(work, "my-skills.tgz");
    execFileSync("tar", ["-czf", archive, "-C", work, "my-skills"]);
    const dir = await extractArchive(archive);
    expect(path.basename(dir)).toBe("my-skills");
    expect(await fs.readFile(path.join(dir, "skills", "web", "SKILL.md"), "utf8")).toBe("# web\n");
  });

  it("round-trips a directory through createArchive and extractArchive", async () => {
    const work = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-test-"));
    const src = path.join(work, "my-plugin");
    await fs.mkdir(path.join(src, "skills", "rev"), { recursive: true });
    await fs.writeFile(path.join(src, "skills", "rev", "SKILL.md"), "# rev\n");
    const archive = path.join(work, "my-plugin.tgz");
    await createArchive(src, archive);
    const dir = await extractArchive(archive);
    expect(path.basename(dir)).toBe("my-plugin");
    expect(await fs.readFile(path.join(dir, "skills", "rev", "SKILL.md"), "utf8")).toBe("# rev\n");
  });

  it("fails with a data error on a corrupt archive", async () => {
    const work = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-test-"));
    const bad = path.join(work, "bad.tgz");
    await fs.writeFile(bad, "not an archive");
    await expect(extractArchive(bad)).rejects.toThrow(/archive extraction failed/);
  });

  it("fails with a data error when git clone fails", async () => {
    await expect(
      fetchRemoteInput("https://invalid.invalid/does-not-exist", []),
    ).rejects.toThrow(/git clone failed/);
  }, 30_000);
});
