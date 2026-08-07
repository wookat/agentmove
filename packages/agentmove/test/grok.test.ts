import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parse as parseToml } from "smol-toml";
import { grok } from "../src/adapters/grok.js";
import { emptyBundle } from "../src/model.js";
import { getProjectAdapter } from "../src/project.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "grok-home");

interface GrokConfig {
  cli?: Record<string, unknown>;
  mcp_servers?: Record<string, Record<string, unknown>>;
}

describe("grok adapter", () => {
  it("exports stdio/http servers, AGENTS.md, and skills", async () => {
    const { bundle, warnings } = await grok.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.filesystem!.transport).toBe("stdio");
    expect(byName.filesystem!.command).toBe("npx");
    expect(byName.filesystem!.env).toEqual({ FS_API_KEY: "test-not-a-real-token" });
    expect(byName["api-server"]!.transport).toBe("http");
    expect(byName["api-server"]!.headers).toEqual({
      Authorization: "Bearer test-not-a-real-token",
    });
    expect(bundle.instructions).toContain("Prefer small commits");
    expect(bundle.skills.map((s) => s.name)).toEqual(["deploy-helper"]);
    expect(warnings).toEqual([]);
  });

  it("warns for client-specific timeout settings on export", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "grok-flags-"));
    await fs.mkdir(path.join(home, ".grok"), { recursive: true });
    await fs.writeFile(
      path.join(home, ".grok/config.toml"),
      `[mcp_servers.slow]\ncommand = "npx"\nstartup_timeout_sec = 60\ntool_timeout_sec = 600\n`,
    );
    const { bundle, warnings } = await grok.exportBundle(home);
    expect(bundle.mcpServers[0]!.name).toBe("slow");
    expect(warnings.some((w) => w.includes("timeout settings are client-specific"))).toBe(true);
    await fs.rm(home, { recursive: true, force: true });
  });

  it("imports with merge, preserves unrelated config, warns for disabled/cwd/sse", async () => {
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
    const { files, warnings } = await grok.planImport(bundle, HOME, {});
    const config = parseToml(
      files.find((f) => f.path === ".grok/config.toml")!.content,
    ) as GrokConfig;
    expect(config.cli).toEqual({ theme: "dark" }); // unrelated table preserved
    expect(Object.keys(config.mcp_servers!).sort()).toEqual([
      "api-server",
      "docs",
      "events",
      "filesystem",
      "remote",
    ]);
    expect(config.mcp_servers!.docs!.command).toBe("npx");
    expect(config.mcp_servers!.docs!.cwd).toBeUndefined();
    expect(config.mcp_servers!.events!.url).toBe("https://e.example.com/sse");
    expect(config.mcp_servers!.remote!.url).toBe("https://example.com/mcp");
    expect(warnings.some((w) => w.includes("does not document cwd"))).toBe(true);
    expect(warnings.some((w) => w.includes("no documented sse transport"))).toBe(true);
    expect(warnings.some((w) => w.includes("no documented disabled flag"))).toBe(true);
    const agents = files.find((f) => f.path === ".grok/AGENTS.md")!;
    expect(agents.content).toContain("Do good work.");
    expect(agents.content).toContain("You are helpful.");
    expect(files.some((f) => f.path === ".grok/skills/sk/SKILL.md")).toBe(true);
    expect(warnings.some((w) => w.includes("no durable memory store"))).toBe(true);
  });

  it("replace-mcp drops existing servers with a warning", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "docs", transport: "stdio", command: "npx" }];
    const { files, warnings } = await grok.planImport(bundle, HOME, { replaceMcp: true });
    const config = parseToml(
      files.find((f) => f.path === ".grok/config.toml")!.content,
    ) as GrokConfig;
    expect(Object.keys(config.mcp_servers!)).toEqual(["docs"]);
    expect(warnings.some((w) => w.includes("removed by --replace-mcp"))).toBe(true);
  });

  it("project scope: .grok/config.toml + AGENTS.md + .grok/skills", async () => {
    const adapter = getProjectAdapter("grok");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "grok-proj-"));
    await fs.mkdir(path.join(dir, ".grok"), { recursive: true });
    await fs.writeFile(
      path.join(dir, ".grok/config.toml"),
      `[mcp_servers.existing]\ncommand = "node"\nargs = ["srv.js"]\n`,
    );
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "search", transport: "http", url: "https://s.example.com" }];
    bundle.instructions = "Project rules.";
    bundle.skills = [{ name: "review", files: { "SKILL.md": "y" } }];
    const { files, warnings } = await adapter.planImport(bundle, dir, {});
    const config = parseToml(
      files.find((f) => f.path === ".grok/config.toml")!.content,
    ) as GrokConfig;
    expect(Object.keys(config.mcp_servers!).sort()).toEqual(["existing", "search"]);
    expect(config.mcp_servers!.search!.url).toBe("https://s.example.com");
    expect(files.some((f) => f.path === "AGENTS.md")).toBe(true);
    expect(files.some((f) => f.path === ".grok/skills/review/SKILL.md")).toBe(true);
    expect(warnings).toEqual([]);

    await fs.writeFile(path.join(dir, "AGENTS.md"), "# Team notes\n");
    const { bundle: exported, warnings: expWarnings } = await adapter.exportProject(dir);
    expect(exported.mcpServers.map((s) => s.name)).toEqual(["existing"]);
    expect(exported.instructions).toContain("Team notes");
    expect(expWarnings).toEqual([]);
    await fs.rm(dir, { recursive: true, force: true });
  });
});
