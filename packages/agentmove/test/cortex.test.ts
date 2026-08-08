import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { cortex } from "../src/adapters/cortex.js";
import { emptyBundle } from "../src/model.js";
import { getProjectAdapter } from "../src/project.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "cortex-home");

interface CortexConfig {
  mcpServers?: Record<string, Record<string, unknown>>;
}

describe("cortex adapter", () => {
  it("exports stdio/http servers, AGENTS.md, and skills", async () => {
    const { bundle, warnings } = await cortex.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.filesystem!.transport).toBe("stdio");
    expect(byName.filesystem!.command).toBe("npx");
    expect(byName.filesystem!.env).toEqual({ FS_API_KEY: "test-not-a-real-token" });
    expect(byName["api-server"]!.transport).toBe("http");
    expect(byName["api-server"]!.headers).toEqual({
      Authorization: "Bearer test-not-a-real-token",
    });
    expect(bundle.instructions).toContain("Always write tests first");
    expect(bundle.skills.map((s) => s.name)).toEqual(["deploy-helper"]);
    expect(warnings).toEqual([]);
  });

  it("handles sse type, cwd, and warns for client-specific timeout", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "cortex-flags-"));
    await fs.mkdir(path.join(home, ".snowflake/cortex"), { recursive: true });
    await fs.writeFile(
      path.join(home, ".snowflake/cortex/mcp.json"),
      JSON.stringify({
        mcpServers: {
          legacy: { type: "sse", url: "https://sse.example.com/sse", timeout: 90000 },
          local: { type: "stdio", command: "node", args: ["srv.js"], cwd: "/srv" },
        },
      }),
    );
    const { bundle, warnings } = await cortex.exportBundle(home);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.legacy!.transport).toBe("sse");
    expect(byName.local!.cwd).toBe("/srv");
    expect(warnings.some((w) => w.includes("timeout"))).toBe(true);
    await fs.rm(home, { recursive: true, force: true });
  });

  it("imports with merge, writes explicit type, warns for enabled:false", async () => {
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
    const { files, warnings } = await cortex.planImport(bundle, HOME, {});
    const config = JSON.parse(
      files.find((f) => f.path === ".snowflake/cortex/mcp.json")!.content,
    ) as CortexConfig;
    expect(Object.keys(config.mcpServers!).sort()).toEqual([
      "api-server",
      "docs",
      "events",
      "filesystem",
      "remote",
    ]);
    expect(config.mcpServers!.docs!.type).toBe("stdio");
    expect(config.mcpServers!.docs!.cwd).toBe("/srv"); // cortex supports cwd
    expect(config.mcpServers!.events!.type).toBe("sse");
    expect(config.mcpServers!.events!.enabled).toBeUndefined();
    expect(config.mcpServers!.remote!.type).toBe("http");
    const agents = files.find((f) => f.path === ".snowflake/cortex/AGENTS.md")!;
    expect(agents.content).toContain("Do good work.");
    expect(agents.content).toContain("You are helpful.");
    expect(files.some((f) => f.path === ".snowflake/cortex/skills/sk/SKILL.md")).toBe(true);
    expect(warnings.some((w) => w.includes("no disabled flag"))).toBe(true);
    expect(warnings.some((w) => w.includes("agent-managed"))).toBe(true);
    expect(warnings.some((w) => w.includes("persona"))).toBe(true);
  });

  it("replace-mcp drops existing servers with a warning", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "docs", transport: "stdio", command: "npx" }];
    const { files, warnings } = await cortex.planImport(bundle, HOME, { replaceMcp: true });
    const config = JSON.parse(
      files.find((f) => f.path === ".snowflake/cortex/mcp.json")!.content,
    ) as CortexConfig;
    expect(Object.keys(config.mcpServers!)).toEqual(["docs"]);
    expect(warnings.some((w) => w.includes("removed by --replace-mcp"))).toBe(true);
  });

  it("project scope: .cortex/mcp.json + AGENTS.md + .cortex/skills", async () => {
    const adapter = getProjectAdapter("cortex");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cortex-proj-"));
    await fs.mkdir(path.join(dir, ".cortex"), { recursive: true });
    await fs.writeFile(
      path.join(dir, ".cortex/mcp.json"),
      JSON.stringify({
        mcpServers: { existing: { type: "stdio", command: "node", args: ["srv.js"] } },
      }),
    );
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "search", transport: "http", url: "https://s.example.com" }];
    bundle.instructions = "Project rules.";
    bundle.skills = [{ name: "review", files: { "SKILL.md": "y" } }];
    const { files, warnings } = await adapter.planImport(bundle, dir, {});
    const config = JSON.parse(
      files.find((f) => f.path === ".cortex/mcp.json")!.content,
    ) as CortexConfig;
    expect(Object.keys(config.mcpServers!).sort()).toEqual(["existing", "search"]);
    expect(config.mcpServers!.search!.url).toBe("https://s.example.com");
    expect(config.mcpServers!.search!.type).toBe("http");
    expect(files.some((f) => f.path === "AGENTS.md")).toBe(true);
    expect(files.some((f) => f.path === ".cortex/skills/review/SKILL.md")).toBe(true);
    expect(warnings).toEqual([]);

    await fs.writeFile(path.join(dir, "AGENTS.md"), "# Team notes\n");
    const { bundle: exported, warnings: expWarnings } = await adapter.exportProject(dir);
    expect(exported.mcpServers.map((s) => s.name)).toEqual(["existing"]);
    expect(exported.instructions).toContain("Team notes");
    expect(expWarnings).toEqual([]);
    await fs.rm(dir, { recursive: true, force: true });
  });
});
