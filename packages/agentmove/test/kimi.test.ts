import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { kimi } from "../src/adapters/kimi.js";
import { emptyBundle } from "../src/model.js";
import { getProjectAdapter } from "../src/project.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "kimi-home");

interface KimiConfig {
  mcpServers?: Record<string, Record<string, unknown>>;
}

describe("kimi adapter", () => {
  it("exports stdio/http servers, AGENTS.md, and skills", async () => {
    const { bundle, warnings } = await kimi.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.filesystem!.transport).toBe("stdio");
    expect(byName.filesystem!.command).toBe("npx");
    expect(byName.filesystem!.env).toEqual({ FS_API_KEY: "test-not-a-real-token" });
    expect(byName["api-server"]!.transport).toBe("http");
    expect(byName["api-server"]!.headers).toEqual({
      Authorization: "Bearer test-not-a-real-token",
    });
    expect(bundle.instructions).toContain("Always write tests first");
    expect(bundle.skills.map((s) => s.name)).toEqual(["deploy-helper", "generic-only"]);
    const deploy = bundle.skills.find((s) => s.name === "deploy-helper")!;
    expect(deploy.files["SKILL.md"]).toContain("Helps with deployment tasks."); // brand root wins
    expect(warnings).toEqual([
      "skills:deploy-helper: .agents/skills copy shadowed by the .kimi-code/skills version (kimi loads the brand root first); the .kimi-code/skills version is exported",
    ]);
  });

  it("merges generic ~/.agents/skills with brand root winning duplicates case-insensitively", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "kimi-skills-"));
    await fs.mkdir(path.join(home, ".kimi-code/skills/Alpha"), { recursive: true });
    await fs.writeFile(path.join(home, ".kimi-code/skills/Alpha/SKILL.md"), "brand alpha\n");
    await fs.mkdir(path.join(home, ".agents/skills/alpha"), { recursive: true });
    await fs.writeFile(path.join(home, ".agents/skills/alpha/SKILL.md"), "generic alpha\n");
    await fs.mkdir(path.join(home, ".agents/skills/beta"), { recursive: true });
    await fs.writeFile(path.join(home, ".agents/skills/beta/SKILL.md"), "generic beta\n");
    const { bundle, warnings } = await kimi.exportBundle(home);
    expect(bundle.skills.map((s) => s.name)).toEqual(["Alpha", "beta"]);
    expect(bundle.skills[0]!.files["SKILL.md"]).toBe("brand alpha\n");
    expect(
      warnings.some((w) => w.startsWith("skills:alpha: .agents/skills copy shadowed")),
    ).toBe(true);
    await fs.rm(home, { recursive: true, force: true });
  });

  it("round-trips enabled:false, sse transport, and warns for client-specific fields", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "kimi-flags-"));
    await fs.mkdir(path.join(home, ".kimi-code"), { recursive: true });
    await fs.writeFile(
      path.join(home, ".kimi-code/mcp.json"),
      JSON.stringify({
        mcpServers: {
          off: {
            url: "https://x.example.com",
            enabled: false,
            startupTimeoutMs: 9000,
            bearerTokenEnvVar: "MY_TOKEN",
          },
          legacy: { transport: "sse", url: "https://sse.example.com/sse" },
        },
      }),
    );
    const { bundle, warnings } = await kimi.exportBundle(home);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.off!.enabled).toBe(false);
    expect(byName.legacy!.transport).toBe("sse");
    expect(warnings.some((w) => w.includes("startupTimeoutMs"))).toBe(true);
    expect(warnings.some((w) => w.includes("bearerTokenEnvVar"))).toBe(true);
    await fs.rm(home, { recursive: true, force: true });
  });

  it("imports with merge, preserves cwd, writes Kimi spellings", async () => {
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
    const { files, warnings } = await kimi.planImport(bundle, HOME, {});
    const config = JSON.parse(
      files.find((f) => f.path === ".kimi-code/mcp.json")!.content,
    ) as KimiConfig;
    expect(Object.keys(config.mcpServers!).sort()).toEqual([
      "api-server",
      "docs",
      "events",
      "filesystem",
      "remote",
    ]);
    expect(config.mcpServers!.docs!.command).toBe("npx");
    expect(config.mcpServers!.docs!.cwd).toBe("/srv"); // kimi supports cwd
    expect(config.mcpServers!.docs!.type).toBeUndefined();
    expect(config.mcpServers!.events!.transport).toBe("sse");
    expect(config.mcpServers!.events!.enabled).toBe(false); // native disabled flag
    expect(config.mcpServers!.remote!.transport).toBeUndefined(); // plain url = HTTP
    const agents = files.find((f) => f.path === ".kimi-code/AGENTS.md")!;
    expect(agents.content).toContain("Do good work.");
    expect(agents.content).toContain("You are helpful.");
    expect(files.some((f) => f.path === ".kimi-code/skills/sk/SKILL.md")).toBe(true); // imports write only the brand root
    expect(files.some((f) => f.path.startsWith(".agents/skills/"))).toBe(false);
    expect(warnings.some((w) => w.includes("no durable memory store"))).toBe(true);
    expect(warnings.some((w) => w.includes("persona"))).toBe(true);
  });

  it("replace-mcp drops existing servers with a warning", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "docs", transport: "stdio", command: "npx" }];
    const { files, warnings } = await kimi.planImport(bundle, HOME, { replaceMcp: true });
    const config = JSON.parse(
      files.find((f) => f.path === ".kimi-code/mcp.json")!.content,
    ) as KimiConfig;
    expect(Object.keys(config.mcpServers!)).toEqual(["docs"]);
    expect(warnings.some((w) => w.includes("removed by --replace-mcp"))).toBe(true);
  });

  it("project scope: .kimi-code/mcp.json + AGENTS.md + .kimi-code/skills", async () => {
    const adapter = getProjectAdapter("kimi");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "kimi-proj-"));
    await fs.mkdir(path.join(dir, ".kimi-code"), { recursive: true });
    await fs.writeFile(
      path.join(dir, ".kimi-code/mcp.json"),
      JSON.stringify({
        mcpServers: { existing: { command: "node", args: ["srv.js"] } },
      }),
    );
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "search", transport: "http", url: "https://s.example.com" }];
    bundle.instructions = "Project rules.";
    bundle.skills = [{ name: "review", files: { "SKILL.md": "y" } }];
    const { files, warnings } = await adapter.planImport(bundle, dir, {});
    const config = JSON.parse(
      files.find((f) => f.path === ".kimi-code/mcp.json")!.content,
    ) as KimiConfig;
    expect(Object.keys(config.mcpServers!).sort()).toEqual(["existing", "search"]);
    expect(config.mcpServers!.search!.url).toBe("https://s.example.com");
    expect(files.some((f) => f.path === "AGENTS.md")).toBe(true);
    expect(files.some((f) => f.path === ".kimi-code/skills/review/SKILL.md")).toBe(true);
    expect(warnings).toEqual([]);

    await fs.writeFile(path.join(dir, "AGENTS.md"), "# Team notes\n");
    await fs.mkdir(path.join(dir, ".agents/skills/proj-generic"), { recursive: true });
    await fs.writeFile(path.join(dir, ".agents/skills/proj-generic/SKILL.md"), "pg\n");
    const { bundle: exported, warnings: expWarnings } = await adapter.exportProject(dir);
    expect(exported.mcpServers.map((s) => s.name)).toEqual(["existing"]);
    expect(exported.instructions).toContain("Team notes");
    expect(exported.skills.map((s) => s.name)).toEqual(["proj-generic"]);
    expect(expWarnings).toEqual([]);
    await fs.rm(dir, { recursive: true, force: true });
  });
});
