import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { nanocoder } from "../src/adapters/nanocoder.js";
import { emptyBundle } from "../src/model.js";
import { getProjectAdapter } from "../src/project.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "nanocoder-home");

interface NanocoderConfig {
  mcpServers?: Record<string, Record<string, unknown>>;
}

describe("nanocoder adapter", () => {
  it("exports stdio/http servers with client-specific warnings", async () => {
    const { bundle, warnings } = await nanocoder.exportBundle(HOME);
    const servers = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(servers.filesystem!.transport).toBe("stdio");
    expect(servers.filesystem!.command).toBe("npx");
    expect(servers.filesystem!.env).toEqual({ FS_API_KEY: "test-not-a-real-token" });
    expect(servers["api-server"]!.transport).toBe("http");
    expect(servers["api-server"]!.headers).toEqual({
      Authorization: "Bearer test-not-a-real-token",
    });
    expect(warnings.some((w) => w.includes("alwaysAllow"))).toBe(true);
    expect(warnings.some((w) => w.includes("timeout"))).toBe(true);
  });

  it("skips websocket servers and round-trips the enabled flag", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "nanocoder-ws-"));
    await fs.mkdir(path.join(home, ".config/nanocoder"), { recursive: true });
    await fs.writeFile(
      path.join(home, ".config/nanocoder/.mcp.json"),
      JSON.stringify({
        mcpServers: {
          realtime: { transport: "websocket", url: "wss://rt.example.com" },
          paused: { transport: "stdio", command: "node", enabled: false },
        },
      }),
    );
    const { bundle, warnings } = await nanocoder.exportBundle(home);
    expect(bundle.mcpServers.map((s) => s.name)).toEqual(["paused"]);
    expect(bundle.mcpServers[0]!.enabled).toBe(false);
    expect(warnings.some((w) => w.includes("websocket"))).toBe(true);
    await fs.rm(home, { recursive: true, force: true });
  });

  it("imports with merge, preserves existing entries, warns for cwd/sse", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "docs", transport: "stdio", command: "npx", args: ["docs-mcp"], cwd: "/srv" },
      { name: "events", transport: "sse", url: "https://e.example.com/sse", enabled: false },
      { name: "remote", transport: "http", url: "https://example.com/mcp" },
    ];
    bundle.instructions = "Do good work.";
    bundle.persona = "You are helpful.";
    bundle.memory = [{ content: "likes tabs", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await nanocoder.planImport(bundle, HOME, {});
    const config = JSON.parse(
      files.find((f) => f.path === ".config/nanocoder/.mcp.json")!.content,
    ) as NanocoderConfig;
    const servers = config.mcpServers!;
    expect(Object.keys(servers).sort()).toEqual([
      "api-server",
      "docs",
      "events",
      "filesystem",
      "remote",
    ]);
    expect(servers.filesystem!.alwaysAllow).toEqual(["list_directory", "read_file"]);
    expect(servers.docs!.transport).toBe("stdio");
    expect(servers.docs!.cwd).toBeUndefined();
    expect(servers.events!.transport).toBe("http");
    expect(servers.events!.enabled).toBe(false);
    expect(servers.remote!.transport).toBe("http");
    expect(warnings.some((w) => w.includes("does not support cwd"))).toBe(true);
    expect(warnings.some((w) => w.includes("no sse transport"))).toBe(true);
    expect(warnings.some((w) => w.includes("AGENTS.md from the project root"))).toBe(true);
    expect(warnings.some((w) => w.includes("persona"))).toBe(true);
    expect(warnings.some((w) => w.includes("no durable memory store"))).toBe(true);
    expect(warnings.some((w) => w.includes("skill.yaml bundle format"))).toBe(true);
    expect(files.every((f) => f.path === ".config/nanocoder/.mcp.json")).toBe(true);
  });

  it("replace-mcp drops existing servers with a warning", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "docs", transport: "stdio", command: "npx" }];
    const { files, warnings } = await nanocoder.planImport(bundle, HOME, { replaceMcp: true });
    const config = JSON.parse(
      files.find((f) => f.path === ".config/nanocoder/.mcp.json")!.content,
    ) as NanocoderConfig;
    expect(Object.keys(config.mcpServers!)).toEqual(["docs"]);
    expect(warnings.some((w) => w.includes("removed by --replace-mcp"))).toBe(true);
  });

  it("project scope: .mcp.json + root AGENTS.md", async () => {
    const adapter = getProjectAdapter("nanocoder");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nanocoder-proj-"));
    await fs.writeFile(
      path.join(dir, ".mcp.json"),
      JSON.stringify({
        mcpServers: { existing: { transport: "stdio", command: "node", args: ["srv.js"] } },
      }),
    );
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "search", transport: "http", url: "https://s.example.com" }];
    bundle.instructions = "Project rules.";
    const { files, warnings } = await adapter.planImport(bundle, dir, {});
    const config = JSON.parse(
      files.find((f) => f.path === ".mcp.json")!.content,
    ) as NanocoderConfig;
    expect(Object.keys(config.mcpServers!).sort()).toEqual(["existing", "search"]);
    expect(config.mcpServers!.search!.url).toBe("https://s.example.com");
    expect(files.some((f) => f.path === "AGENTS.md")).toBe(true);
    expect(warnings).toEqual([]);

    await fs.writeFile(path.join(dir, "AGENTS.md"), "# Team notes\n");
    const { bundle: exported, warnings: expWarnings } = await adapter.exportProject(dir);
    expect(exported.mcpServers.map((s) => s.name)).toEqual(["existing"]);
    expect(exported.instructions).toContain("Team notes");
    expect(expWarnings).toEqual([]);
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("exports flat custom agents byte-faithfully", async () => {
    const { bundle } = await nanocoder.exportBundle(HOME);
    expect(bundle.agents.map((a) => a.name)).toEqual(["code-reviewer"]);
    expect(bundle.agents[0]!.content).toContain("name: code-reviewer");
    expect(bundle.agents[0]!.content).toContain("You are a code review specialist.");
  });

  it("imports agents, injecting required frontmatter and flattening nested names", async () => {
    const bundle = emptyBundle();
    bundle.agents = [
      {
        name: "full",
        content: "---\nname: full\ndescription: Complete agent\nmodel: inherit\n---\nBody full.\n",
      },
      { name: "desc-only", content: "---\ndescription: Has description\n---\nBody desc.\n" },
      { name: "bare", content: "Just a system prompt.\n" },
      { name: "backend/sql", content: "---\nname: sql\ndescription: SQL helper\n---\nSQL body.\n" },
      { name: "backend-sql", content: "Collides after flattening.\n" },
    ];
    const { files, warnings } = await nanocoder.planImport(bundle, HOME, {});
    const byPath = Object.fromEntries(files.map((f) => [f.path, f.content]));
    expect(byPath[".config/nanocoder/agents/full.md"]).toBe(
      "---\nname: full\ndescription: Complete agent\nmodel: inherit\n---\nBody full.\n",
    );
    expect(byPath[".config/nanocoder/agents/desc-only.md"]).toBe(
      '---\nname: "desc-only"\ndescription: Has description\n---\nBody desc.\n',
    );
    expect(warnings).toContain(
      "agents:desc-only: nanocoder requires a name frontmatter field; added",
    );
    expect(byPath[".config/nanocoder/agents/bare.md"]).toBe(
      '---\nname: "bare"\ndescription: "Imported by agentmove from agent bare"\n---\nJust a system prompt.\n',
    );
    expect(warnings).toContain(
      "agents:bare: nanocoder requires name/description frontmatter; a frontmatter block was added",
    );
    expect(byPath[".config/nanocoder/agents/backend-sql.md"]).toBe(
      "---\nname: sql\ndescription: SQL helper\n---\nSQL body.\n",
    );
    expect(warnings).toContain(
      "agents:backend/sql: nanocoder only discovers top-level agent files; imported as backend-sql",
    );
    expect(warnings).toContain(
      "agents:backend-sql: name collides with another agent after flattening; skipped",
    );
    expect(warnings).toContain(
      "agents: frontmatter fields (provider/model/contextWindow/tools/disallowedTools/subscribe) are client-specific and copied as-is; review after import",
    );
  });

  it("round-trips complete agents byte-faithfully", async () => {
    const { bundle } = await nanocoder.exportBundle(HOME);
    const { files } = await nanocoder.planImport(bundle, HOME, {});
    const original = bundle.agents[0]!.content;
    expect(files.find((f) => f.path === ".config/nanocoder/agents/code-reviewer.md")!.content).toBe(
      original,
    );
  });

  it("project scope: .nanocoder/agents export/import", async () => {
    const adapter = getProjectAdapter("nanocoder");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nanocoder-agents-proj-"));
    await fs.mkdir(path.join(dir, ".nanocoder/agents"), { recursive: true });
    await fs.writeFile(
      path.join(dir, ".nanocoder/agents/helper.md"),
      "---\nname: helper\ndescription: Helps here\n---\nProject helper.\n",
    );
    const { bundle: exported } = await adapter.exportProject(dir);
    expect(exported.agents.map((a) => a.name)).toEqual(["helper"]);
    const bundle = emptyBundle();
    bundle.agents = exported.agents;
    const { files, warnings } = await adapter.planImport(bundle, dir, {});
    expect(files.find((f) => f.path === ".nanocoder/agents/helper.md")!.content).toBe(
      "---\nname: helper\ndescription: Helps here\n---\nProject helper.\n",
    );
    expect(warnings.some((w) => w.includes("client-specific and copied as-is"))).toBe(true);
    await fs.rm(dir, { recursive: true, force: true });
  });
});
