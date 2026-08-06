import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { amp } from "../src/adapters/amp.js";
import { getProjectAdapter } from "../src/project.js";
import { emptyBundle, isRecord } from "../src/model.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "amp-home");

describe("amp adapter", () => {
  it("exports amp.mcpServers, AGENTS.md, and skills", async () => {
    const { bundle, warnings } = await amp.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.playwright!.transport).toBe("stdio");
    expect(byName.playwright!.command).toBe("npx");
    expect(byName.playwright!.env).toEqual({ API_TOKEN: "test-not-a-real-token" });
    expect(byName.linear!.transport).toBe("http");
    expect(byName.linear!.url).toBe("https://mcp.linear.app/sse");
    expect(byName.linear!.headers).toEqual({ Authorization: "token test-not-a-real-token" });
    expect(bundle.instructions).toContain("Prefer concise answers.");
    expect(bundle.skills.map((s) => s.name)).toEqual(["todo"]);
    expect(warnings).toEqual([]);
  });

  it("imports into settings.json (merge), instructions with persona/memory approximation, skills", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "docs", transport: "stdio", command: "npx", args: ["docs-mcp"] },
      { name: "api", transport: "sse", url: "https://sse.example.com" },
      { name: "off", transport: "stdio", command: "x", enabled: false },
    ];
    bundle.instructions = "Do good work.";
    bundle.persona = "You are helpful.";
    bundle.memory = [{ content: "likes tabs", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await amp.planImport(bundle, HOME, {});
    const settings = JSON.parse(
      files.find((f) => f.path === ".config/amp/settings.json")!.content,
    ) as Record<string, unknown>;
    const servers = settings["amp.mcpServers"] as Record<string, Record<string, unknown>>;
    expect(servers.docs!.command).toBe("npx");
    expect(servers.docs!.type).toBeUndefined(); // amp entries carry no type field
    expect(servers.api!.url).toBe("https://sse.example.com");
    expect(servers.playwright).toBeDefined(); // merge keeps existing
    expect(isRecord(settings["amp.notifications.enabled"]) || settings["amp.notifications.enabled"] === true).toBe(true);
    const agents = files.find((f) => f.path === ".config/amp/AGENTS.md")!.content;
    expect(agents).toContain("Do good work.");
    expect(agents).toContain("persona");
    expect(agents).toContain("likes tabs");
    expect(files.some((f) => f.path === ".agents/skills/sk/SKILL.md")).toBe(true);
    expect(warnings.some((w) => w.includes("persona"))).toBe(true);
    expect(warnings.some((w) => w.includes("no disabled flag"))).toBe(true);
  });

  it("project scope: .amp/settings.json workspace servers + AGENTS.md + .agents/skills", async () => {
    const adapter = getProjectAdapter("amp");
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "db", transport: "stdio", command: "npx" }];
    bundle.instructions = "Repo rules.";
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await adapter.planImport(bundle, "/nonexistent-project", {});
    const settings = JSON.parse(
      files.find((f) => f.path === ".amp/settings.json")!.content,
    ) as Record<string, unknown>;
    expect((settings["amp.mcpServers"] as Record<string, unknown>).db).toBeDefined();
    expect(files.some((f) => f.path === "AGENTS.md")).toBe(true);
    expect(files.some((f) => f.path === ".agents/skills/sk/SKILL.md")).toBe(true);
    expect(warnings.some((w) => w.includes("require approval"))).toBe(true);
  });
});
