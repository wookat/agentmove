import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { continueAdapter } from "../src/adapters/continue.js";
import { getProjectAdapter } from "../src/project.js";
import { emptyBundle } from "../src/model.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "continue-home");

interface ContinueConfig {
  name?: string;
  version?: string;
  schema?: string;
  mcpServers: Record<string, unknown>[];
}

describe("continue adapter", () => {
  it("exports servers from the mcpServers list and rules", async () => {
    const { bundle, warnings } = await continueAdapter.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.sqlite!.transport).toBe("stdio");
    expect(byName.sqlite!.env).toEqual({ DB_TOKEN: "test-not-a-real-token" });
    expect(byName.sentry!.transport).toBe("http"); // streamable-http normalized
    expect(byName.legacy!.transport).toBe("sse");
    expect(warnings.some((w) => w.includes("connectionTimeout"))).toBe(true);
    expect(bundle.instructions).toContain("Always use pnpm.");
    expect(bundle.instructions).toContain("rule: 02-style.md");
    expect(warnings.some((w) => w.includes("rules files merged"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("skills:"))).toBe(true);
    expect(bundle.skills).toEqual([]);
  });

  it("imports by merging the name-keyed list and writes rules markdown", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "docs", transport: "stdio", command: "npx", args: ["docs-mcp"] },
      { name: "remote", transport: "http", url: "https://x.example.com" },
      { name: "off", transport: "sse", url: "https://y.example.com", enabled: false },
    ];
    bundle.instructions = "Do good work.";
    bundle.persona = "You are helpful.";
    bundle.memory = [{ content: "likes tabs", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await continueAdapter.planImport(bundle, HOME, {});
    const config = parseYaml(
      files.find((f) => f.path === ".continue/config.yaml")!.content,
    ) as ContinueConfig;
    const names = config.mcpServers.map((e) => e.name);
    expect(names).toContain("sqlite"); // merge keeps existing
    expect(names).toContain("docs");
    const remote = config.mcpServers.find((e) => e.name === "remote")!;
    expect(remote.type).toBe("streamable-http");
    const off = config.mcpServers.find((e) => e.name === "off")!;
    expect(off.type).toBe("sse");
    expect(warnings.some((w) => w.includes("no disabled flag"))).toBe(true);
    const rules = files.find((f) => f.path === ".continue/rules/agentmove.md")!;
    expect(rules.content).toContain("Do good work.");
    expect(rules.content).toContain("persona (SOUL.md)");
    expect(warnings.some((w) => w.startsWith("memory:"))).toBe(true);
    expect(warnings.some((w) => w.includes("skills skipped"))).toBe(true);
    expect(files.some((f) => f.path.includes("skills/sk"))).toBe(false);
  });

  it("creates a valid config with required metadata for a fresh home, --replace-mcp works", async () => {
    const incoming = emptyBundle();
    incoming.mcpServers = [{ name: "only", transport: "stdio", command: "x" }];
    const fresh = await continueAdapter.planImport(incoming, "/nonexistent-home", {});
    const created = parseYaml(
      fresh.files.find((f) => f.path === ".continue/config.yaml")!.content,
    ) as ContinueConfig;
    expect(created.name).toBeDefined();
    expect(created.schema).toBe("v1");
    expect(created.mcpServers.map((e) => e.name)).toEqual(["only"]);

    const replaced = await continueAdapter.planImport(incoming, HOME, { replaceMcp: true });
    const config = parseYaml(
      replaced.files.find((f) => f.path === ".continue/config.yaml")!.content,
    ) as ContinueConfig;
    expect(config.mcpServers.map((e) => e.name)).toEqual(["only"]);
    expect(replaced.warnings.some((w) => w.includes("removed by --replace-mcp"))).toBe(true);
  });

  it("project scope: .continue/mcpServers blocks + rules", async () => {
    const adapter = getProjectAdapter("continue");
    const exported = await adapter.exportProject(HOME); // fixture reuses .continue layout
    expect(exported.bundle.mcpServers.map((s) => s.name)).toEqual(["project-db"]);
    expect(exported.bundle.instructions).toContain("Always use pnpm.");

    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "db", transport: "http", url: "https://db.example.com" }];
    bundle.instructions = "Repo rules.";
    const { files } = await adapter.planImport(bundle, "/nonexistent-project", {});
    const block = parseYaml(
      files.find((f) => f.path === ".continue/mcpServers/agentmove.yaml")!.content,
    ) as ContinueConfig;
    expect(block.schema).toBe("v1");
    expect(block.mcpServers[0]!.type).toBe("streamable-http");
    expect(files.some((f) => f.path === ".continue/rules/agentmove.md")).toBe(true);
  });
});
