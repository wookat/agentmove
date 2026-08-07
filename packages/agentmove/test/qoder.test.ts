import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { qoder } from "../src/adapters/qoder.js";
import { emptyBundle } from "../src/model.js";
import { getProjectAdapter } from "../src/project.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "qoder-home");

interface QoderSettings {
  theme?: string;
  mcpServers?: Record<string, Record<string, unknown>>;
  mcp?: Record<string, unknown>;
}

describe("qoder adapter", () => {
  it("exports servers, memory, and skills from ~/.qoder", async () => {
    const { bundle, warnings } = await qoder.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.filesystem!.transport).toBe("stdio");
    expect(byName.filesystem!.env).toEqual({ FS_API_KEY: "test-not-a-real-token" });
    expect(byName["api-server"]!.transport).toBe("http");
    expect(byName["api-server"]!.headers).toEqual({
      Authorization: "Bearer test-not-a-real-token",
    });
    expect(bundle.instructions).toContain("Use pnpm");
    expect(bundle.skills.map((s) => s.name)).toEqual(["deploy-helper"]);
    expect(warnings).toEqual([]);
  });

  it("skips ws servers and warns on isProxy during export", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "qoder-ws-"));
    await fs.mkdir(path.join(home, ".qoder"));
    await fs.writeFile(
      path.join(home, ".qoder/settings.json"),
      JSON.stringify({
        mcpServers: {
          sock: { type: "ws", url: "wss://example.com/mcp" },
          proxy: { command: "node", isProxy: true },
        },
      }),
    );
    const { bundle, warnings } = await qoder.exportBundle(home);
    expect(bundle.mcpServers.map((s) => s.name)).toEqual(["proxy"]);
    expect(warnings.some((w) => w.includes("ws (WebSocket)"))).toBe(true);
    expect(warnings.some((w) => w.includes("isProxy"))).toBe(true);
    await fs.rm(home, { recursive: true, force: true });
  });

  it("imports by merging mcpServers into settings.json, preserving other keys", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "docs", transport: "stdio", command: "npx", args: ["docs-mcp"], cwd: "/x" },
      { name: "events", transport: "sse", url: "https://sse.example.com", enabled: false },
    ];
    bundle.instructions = "Do good work.";
    bundle.persona = "You are helpful.";
    bundle.memory = [{ content: "likes tabs", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await qoder.planImport(bundle, HOME, {});
    const settings = JSON.parse(
      files.find((f) => f.path === ".qoder/settings.json")!.content,
    ) as QoderSettings;
    expect(settings.theme).toBe("dark"); // unrelated settings preserved
    expect(settings.mcp).toEqual({ allowed: ["filesystem"] });
    expect(Object.keys(settings.mcpServers!).sort()).toEqual([
      "api-server",
      "docs",
      "events",
      "filesystem",
    ]);
    expect(settings.mcpServers!.docs!.type).toBe("stdio");
    expect(settings.mcpServers!.docs!.cwd).toBeUndefined();
    expect(settings.mcpServers!.events!.type).toBe("sse");
    const memoryFile = files.find((f) => f.path === ".qoder/AGENTS.md")!;
    expect(memoryFile.content).toContain("Do good work.");
    expect(memoryFile.content).toContain("You are helpful.");
    expect(files.some((f) => f.path === ".qoder/skills/sk/SKILL.md")).toBe(true);
    expect(warnings.some((w) => w.includes("cwd"))).toBe(true);
    expect(warnings.some((w) => w.includes("no disabled flag"))).toBe(true);
    expect(warnings.some((w) => w.includes("auto-memory is app-managed"))).toBe(true);
  });

  it("replace-mcp drops existing servers with a warning", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "docs", transport: "stdio", command: "npx" }];
    const { files, warnings } = await qoder.planImport(bundle, HOME, { replaceMcp: true });
    const settings = JSON.parse(
      files.find((f) => f.path === ".qoder/settings.json")!.content,
    ) as QoderSettings;
    expect(Object.keys(settings.mcpServers!)).toEqual(["docs"]);
    expect(settings.theme).toBe("dark");
    expect(warnings.some((w) => w.includes("removed by --replace-mcp"))).toBe(true);
  });

  it("project scope: .mcp.json + AGENTS.md + .qoder/skills", async () => {
    const adapter = getProjectAdapter("qoder");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "qoder-proj-"));
    await fs.writeFile(
      path.join(dir, ".mcp.json"),
      JSON.stringify({ mcpServers: { existing: { command: "node" } } }),
    );
    await fs.writeFile(path.join(dir, "AGENTS.md"), "# Project notes\n");
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "search", transport: "stdio", command: "npx" }];
    bundle.instructions = "Project rules.";
    bundle.persona = "Friendly.";
    const { files, warnings } = await adapter.planImport(bundle, dir, {});
    const config = JSON.parse(
      files.find((f) => f.path === ".mcp.json")!.content,
    ) as QoderSettings;
    expect(Object.keys(config.mcpServers!).sort()).toEqual(["existing", "search"]);
    expect(config.mcpServers!.search!.type).toBe("stdio");
    const memo = files.find((f) => f.path === "AGENTS.md")!;
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
