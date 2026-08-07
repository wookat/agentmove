import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { kilo } from "../src/adapters/kilo.js";
import { emptyBundle } from "../src/model.js";
import { getProjectAdapter } from "../src/project.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "kilo-home");

interface KiloConfig {
  theme?: string;
  mcp?: Record<string, Record<string, unknown>>;
}

describe("kilo adapter", () => {
  it("exports local/remote servers, AGENTS.md, and skills", async () => {
    const { bundle, warnings } = await kilo.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.filesystem!.transport).toBe("stdio");
    expect(byName.filesystem!.command).toBe("npx");
    expect(byName.filesystem!.args).toEqual(["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]);
    expect(byName.filesystem!.env).toEqual({ FS_API_KEY: "test-not-a-real-token" });
    expect(byName["api-server"]!.transport).toBe("http");
    expect(byName["api-server"]!.headers).toEqual({
      Authorization: "Bearer test-not-a-real-token",
    });
    expect(bundle.instructions).toContain("Use pnpm");
    expect(bundle.skills.map((s) => s.name)).toEqual(["deploy-helper"]);
    expect(warnings).toEqual([]);
  });

  it("round-trips enabled:false and warns for client-specific timeout", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "kilo-flags-"));
    await fs.mkdir(path.join(home, ".config/kilo"), { recursive: true });
    await fs.writeFile(
      path.join(home, ".config/kilo/kilo.json"),
      JSON.stringify({
        mcp: {
          off: { type: "remote", url: "https://x.example.com", enabled: false, timeout: 9000 },
        },
      }),
    );
    const { bundle, warnings } = await kilo.exportBundle(home);
    expect(bundle.mcpServers[0]!.enabled).toBe(false);
    expect(warnings.some((w) => w.includes("timeout"))).toBe(true);
    await fs.rm(home, { recursive: true, force: true });
  });

  it("reads kilo.jsonc with comments and warns they are not preserved", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "kilo-jsonc-"));
    await fs.mkdir(path.join(home, ".config/kilo"), { recursive: true });
    await fs.writeFile(
      path.join(home, ".config/kilo/kilo.jsonc"),
      `{\n  // my servers\n  "mcp": { "docs": { "type": "local", "command": ["npx", "docs"] } }\n}\n`,
    );
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "extra", transport: "stdio", command: "npx" }];
    const { files, warnings } = await kilo.planImport(bundle, home, {});
    const plan = files.find((f) => f.path === ".config/kilo/kilo.jsonc")!;
    const config = JSON.parse(plan.content) as KiloConfig;
    expect(Object.keys(config.mcp!).sort()).toEqual(["docs", "extra"]);
    expect(warnings.some((w) => w.includes("comments are not preserved"))).toBe(true);
    await fs.rm(home, { recursive: true, force: true });
  });

  it("imports by merging into kilo.json, preserving other keys, kilo spelling", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "docs", transport: "stdio", command: "npx", args: ["docs-mcp"], cwd: "/x" },
      { name: "events", transport: "sse", url: "https://sse.example.com", enabled: false },
    ];
    bundle.instructions = "Do good work.";
    bundle.persona = "You are helpful.";
    bundle.memory = [{ content: "likes tabs", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await kilo.planImport(bundle, HOME, {});
    const config = JSON.parse(
      files.find((f) => f.path === ".config/kilo/kilo.json")!.content,
    ) as KiloConfig;
    expect(config.theme).toBe("dark"); // unrelated settings preserved
    expect(Object.keys(config.mcp!).sort()).toEqual([
      "api-server",
      "docs",
      "events",
      "filesystem",
    ]);
    expect(config.mcp!.docs!.type).toBe("local");
    expect(config.mcp!.docs!.command).toEqual(["npx", "docs-mcp"]);
    expect(config.mcp!.docs!.cwd).toBeUndefined();
    expect(config.mcp!.events!.type).toBe("remote");
    expect(config.mcp!.events!.enabled).toBe(false); // native disabled flag
    const agents = files.find((f) => f.path === ".config/kilo/AGENTS.md")!;
    expect(agents.content).toContain("Do good work.");
    expect(agents.content).toContain("You are helpful.");
    expect(files.some((f) => f.path === ".kilo/skills/sk/SKILL.md")).toBe(true);
    expect(warnings.some((w) => w.includes("cwd"))).toBe(true);
    expect(warnings.some((w) => w.includes("sse"))).toBe(true);
    expect(warnings.some((w) => w.includes("no durable memory store"))).toBe(true);
  });

  it("replace-mcp drops existing servers with a warning", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "docs", transport: "stdio", command: "npx" }];
    const { files, warnings } = await kilo.planImport(bundle, HOME, { replaceMcp: true });
    const config = JSON.parse(
      files.find((f) => f.path === ".config/kilo/kilo.json")!.content,
    ) as KiloConfig;
    expect(Object.keys(config.mcp!)).toEqual(["docs"]);
    expect(config.theme).toBe("dark");
    expect(warnings.some((w) => w.includes("removed by --replace-mcp"))).toBe(true);
  });

  it("project scope: kilo.json/.kilo + AGENTS.md + .kilo/skills", async () => {
    const adapter = getProjectAdapter("kilo");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "kilo-proj-"));
    await fs.mkdir(path.join(dir, ".kilo"), { recursive: true });
    await fs.writeFile(
      path.join(dir, ".kilo/kilo.json"),
      JSON.stringify({
        instructions: ["docs/style.md"],
        mcp: { existing: { type: "local", command: ["node", "srv.js"] } },
      }),
    );
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "search", transport: "http", url: "https://s.example.com" }];
    bundle.instructions = "Project rules.";
    bundle.skills = [{ name: "review", files: { "SKILL.md": "y" } }];
    const { files, warnings } = await adapter.planImport(bundle, dir, {});
    const config = JSON.parse(
      files.find((f) => f.path === ".kilo/kilo.json")!.content,
    ) as KiloConfig & { instructions?: unknown };
    expect(Object.keys(config.mcp!).sort()).toEqual(["existing", "search"]);
    expect(config.mcp!.search!.type).toBe("remote");
    expect(config.instructions).toEqual(["docs/style.md"]); // unrelated keys preserved
    expect(files.some((f) => f.path === "AGENTS.md")).toBe(true);
    expect(files.some((f) => f.path === ".kilo/skills/review/SKILL.md")).toBe(true);
    expect(warnings).toEqual([]);

    await fs.writeFile(path.join(dir, "AGENTS.md"), "# Team notes\n");
    const { bundle: exported, warnings: expWarnings } = await adapter.exportProject(dir);
    expect(exported.mcpServers.map((s) => s.name)).toEqual(["existing"]);
    expect(exported.instructions).toContain("Team notes");
    expect(expWarnings).toEqual([]);
    await fs.rm(dir, { recursive: true, force: true });
  });
});
