import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { fetchRemoteInput, isRemoteInput, parseTreeUrl } from "../src/remote.js";
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

  it("fails with a data error when git clone fails", async () => {
    await expect(
      fetchRemoteInput("https://invalid.invalid/does-not-exist", []),
    ).rejects.toThrow(/git clone failed/);
  }, 30_000);
});
