import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { codebuddy } from "../src/adapters/codebuddy.js";
import { emptyBundle } from "../src/model.js";
import { getProjectAdapter } from "../src/project.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "codebuddy-home");

interface CodebuddyConfig {
  mcpServers?: Record<string, Record<string, unknown>>;
  disabledMcpServers?: string[];
}

describe("codebuddy adapter", () => {
  it("exports servers, disabledMcpServers state, memory, and skills", async () => {
    const { bundle, warnings } = await codebuddy.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.filesystem!.transport).toBe("stdio");
    expect(byName.filesystem!.env).toEqual({ FS_API_KEY: "test-not-a-real-token" });
    expect(byName["api-server"]!.transport).toBe("http");
    expect(byName["api-server"]!.enabled).toBe(false); // via disabledMcpServers
    expect(bundle.instructions).toContain("Use pnpm");
    expect(bundle.skills.map((s) => s.name)).toEqual(["deploy-helper"]);
    expect(warnings).toEqual([]);
  });

  it("imports by merging mcpServers and disabledMcpServers; writes CODEBUDDY.md and skills", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "docs", transport: "stdio", command: "npx", args: ["docs-mcp"], cwd: "/x" },
      { name: "events", transport: "sse", url: "https://sse.example.com", enabled: false },
    ];
    bundle.instructions = "Do good work.";
    bundle.persona = "You are helpful.";
    bundle.memory = [{ content: "likes tabs", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await codebuddy.planImport(bundle, HOME, {});
    const mcp = files.find((f) => f.path === ".codebuddy/.mcp.json")!;
    const config = JSON.parse(mcp.content) as CodebuddyConfig;
    expect(Object.keys(config.mcpServers!).sort()).toEqual([
      "api-server",
      "docs",
      "events",
      "filesystem",
    ]);
    expect(config.mcpServers!.docs!.type).toBe("stdio");
    expect(config.mcpServers!.docs!.cwd).toBeUndefined();
    expect(config.mcpServers!.events!.type).toBe("sse");
    expect(config.disabledMcpServers!.sort()).toEqual(["api-server", "events"]);
    const memoryFile = files.find((f) => f.path === ".codebuddy/CODEBUDDY.md")!;
    expect(memoryFile.content).toContain("Do good work.");
    expect(memoryFile.content).toContain("You are helpful.");
    expect(files.some((f) => f.path === ".codebuddy/skills/sk/SKILL.md")).toBe(true);
    expect(warnings.some((w) => w.includes("cwd"))).toBe(true);
    expect(warnings.some((w) => w.includes("auto-memory is app-managed"))).toBe(true);
  });

  it("replace-mcp drops existing servers and stale disabled entries", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "docs", transport: "stdio", command: "npx" }];
    const { files, warnings } = await codebuddy.planImport(bundle, HOME, { replaceMcp: true });
    const config = JSON.parse(
      files.find((f) => f.path === ".codebuddy/.mcp.json")!.content,
    ) as CodebuddyConfig;
    expect(Object.keys(config.mcpServers!)).toEqual(["docs"]);
    expect(config.disabledMcpServers).toBeUndefined();
    expect(warnings.some((w) => w.includes("removed by --replace-mcp"))).toBe(true);
  });

  it("writes to the first existing legacy file (~/.codebuddy.json)", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "cb-legacy-"));
    await fs.writeFile(
      path.join(home, ".codebuddy.json"),
      JSON.stringify({ mcpServers: { keep: { command: "node" } }, projects: {} }),
    );
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "docs", transport: "stdio", command: "npx" }];
    const { files } = await codebuddy.planImport(bundle, home, {});
    expect(files.map((f) => f.path)).toEqual([".codebuddy.json"]);
    const config = JSON.parse(files[0]!.content) as CodebuddyConfig & { projects?: object };
    expect(Object.keys(config.mcpServers!).sort()).toEqual(["docs", "keep"]);
    expect(config.projects).toEqual({}); // local-scope block preserved
    await fs.rm(home, { recursive: true, force: true });
  });

  it("project scope: .mcp.json + CODEBUDDY.md + .codebuddy/skills", async () => {
    const adapter = getProjectAdapter("codebuddy");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cb-proj-"));
    await fs.writeFile(
      path.join(dir, ".mcp.json"),
      JSON.stringify({ mcpServers: { existing: { command: "node" } } }),
    );
    await fs.writeFile(path.join(dir, "CODEBUDDY.md"), "# Project notes\n");
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "search", transport: "stdio", command: "npx" }];
    bundle.instructions = "Project rules.";
    bundle.persona = "Friendly.";
    const { files, warnings } = await adapter.planImport(bundle, dir, {});
    const config = JSON.parse(
      files.find((f) => f.path === ".mcp.json")!.content,
    ) as CodebuddyConfig;
    expect(Object.keys(config.mcpServers!).sort()).toEqual(["existing", "search"]);
    const memo = files.find((f) => f.path === "CODEBUDDY.md")!;
    expect(memo.content).toContain("Project rules.");
    expect(memo.content).toContain("Friendly.");
    expect(warnings.some((w) => w.includes("persona"))).toBe(true);

    const { bundle: exported, warnings: expWarnings } = await adapter.exportProject(dir);
    expect(exported.mcpServers.map((s) => s.name)).toEqual(["existing"]);
    expect(exported.instructions).toContain("Project notes");
    expect(expWarnings).toEqual([]);
    await fs.rm(dir, { recursive: true, force: true });
  });
});
