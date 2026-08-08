import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { goose, parseGooseMemoryFile } from "../src/adapters/goose.js";
import { getProjectAdapter } from "../src/project.js";
import { emptyBundle, isRecord } from "../src/model.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "goose-home");

describe("goose adapter", () => {
  it("exports extensions (skipping builtins), hints, memory files, skills", async () => {
    const { bundle, warnings } = await goose.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.developer).toBeUndefined(); // builtin skipped
    expect(byName.filesystem!.transport).toBe("stdio");
    expect(byName.filesystem!.command).toBe("npx");
    expect(byName.filesystem!.env).toEqual({ API_TOKEN: "test-not-a-real-token" });
    expect(byName["remote-tools"]!.transport).toBe("http");
    expect(byName["remote-tools"]!.url).toBe("https://example.com/mcp");
    expect(byName["remote-tools"]!.enabled).toBe(false);
    expect(bundle.instructions).toContain("Prefer concise answers.");
    expect(bundle.memory.map((m) => m.content)).toEqual([
      "The user prefers dark mode.",
      "The project uses pnpm workspaces.",
    ]);
    expect(bundle.skills.map((s) => s.name)).toEqual(["todo"]);
    expect(bundle.commands.map((c) => c.name)).toEqual(["daily-report", "lint-fix"]);
    expect(warnings).toEqual([
      'commands:lint-fix: goose recipe field "parameters" has no portable command equivalent; dropped',
      "commands: converted from goose recipe YAML/JSON (title/description + prompt/instructions); {{ param }} placeholders are goose-specific and copied as-is",
    ]);
  });

  it("imports MCP as extensions (merge), hints, memory, skills", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "docs", transport: "stdio", command: "npx", args: ["docs-mcp"] },
      { name: "api", transport: "sse", url: "https://sse.example.com" },
    ];
    bundle.instructions = "Do good work.";
    bundle.persona = "You are helpful.";
    bundle.memory = [{ content: "likes tabs", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await goose.planImport(bundle, HOME, {});
    const config = parseYaml(
      files.find((f) => f.path === ".config/goose/config.yaml")!.content,
    ) as Record<string, unknown>;
    const ext = config.extensions as Record<string, Record<string, unknown>>;
    expect(ext.docs!.type).toBe("stdio");
    expect(ext.docs!.cmd).toBe("npx");
    expect(ext.api!.type).toBe("sse");
    expect(ext.api!.uri).toBe("https://sse.example.com");
    expect(ext.filesystem).toBeDefined(); // merge keeps existing
    expect(isRecord(ext.developer)).toBe(true); // builtins untouched
    const hints = files.find((f) => f.path === ".config/goose/.goosehints")!.content;
    expect(hints).toContain("Do good work.");
    expect(hints).toContain("persona");
    const mem = files.find((f) => f.path === ".config/goose/memory/imported.txt")!.content;
    expect(mem).toContain("likes tabs");
    expect(files.some((f) => f.path === ".agents/skills/sk/SKILL.md")).toBe(true);
    expect(warnings.some((w) => w.includes("persona"))).toBe(true);
  });

  it("parses memory files: blank-line entries, '# tags' lines stripped", () => {
    const entries = parseGooseMemoryFile("# a b\nfirst\n\nsecond line one\nline two\n", "src");
    expect(entries.map((e) => e.content)).toEqual(["first", "second line one\nline two"]);
  });

  it("project scope: .goosehints + .goose/memory + .agents/skills; MCP warned", async () => {
    const adapter = getProjectAdapter("goose");
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "db", transport: "stdio", command: "npx" }];
    bundle.instructions = "Repo rules.";
    bundle.memory = [{ content: "m1", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await adapter.planImport(bundle, "/nonexistent-project", {});
    expect(files.some((f) => f.path === ".goosehints")).toBe(true);
    expect(files.some((f) => f.path === ".goose/memory/imported.txt")).toBe(true);
    expect(files.some((f) => f.path === ".agents/skills/sk/SKILL.md")).toBe(true);
    expect(warnings.some((w) => w.includes("no project-scoped extension config"))).toBe(true);
  });

  it("project scope: commands become .goose/recipes/ recipes without touching user config", async () => {
    const adapter = getProjectAdapter("goose");
    const bundle = emptyBundle();
    bundle.commands = [{ name: "deploy", content: "---\ndescription: \"d\"\n---\nDeploy.\n" }];
    const { files, warnings } = await adapter.planImport(bundle, "/nonexistent-project", {});
    const recipe = files.find((f) => f.path === ".goose/recipes/deploy.yaml")!;
    const parsed = parseYaml(recipe.content) as Record<string, unknown>;
    expect(parsed.prompt).toBe("Deploy.\n");
    expect(parsed.description).toBe("d");
    expect(files.some((f) => f.path.includes("config.yaml"))).toBe(false);
    expect(warnings.some((w) => w.includes("slash-command registration lives in the user-level config.yaml"))).toBe(
      true,
    );
  });
});
