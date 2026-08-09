import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
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
    expect(bundle.skills.map((s) => s.name)).toEqual(["deploy-helper"]);
    expect(warnings.some((w) => w.startsWith("skills:"))).toBe(false);
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
    expect(warnings.some((w) => w.startsWith("skills:"))).toBe(false);
    expect(files.some((f) => f.path === ".continue/skills/sk/SKILL.md")).toBe(true);
  });

  it("project scope: plans skills into .continue/skills", async () => {
    const adapter = getProjectAdapter("continue");
    const bundle = emptyBundle();
    bundle.skills = [{ name: "review", files: { "SKILL.md": "# Review" } }];
    const { files, warnings } = await adapter.planImport(bundle, "/nonexistent-project", {});
    expect(files.some((f) => f.path === ".continue/skills/review/SKILL.md")).toBe(true);
    expect(warnings.some((w) => w.startsWith("skills:"))).toBe(false);
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

  it("exports inline prompts and rules from config.yaml and yaml block files", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "am-cont-inline-"));
    await fs.mkdir(path.join(home, ".continue/prompts"), { recursive: true });
    await fs.mkdir(path.join(home, ".continue/rules"), { recursive: true });
    await fs.writeFile(path.join(home, ".continue/prompts/dup.md"), "md dup prompt\n");
    await fs.writeFile(
      path.join(home, ".continue/prompts/extra.yaml"),
      [
        "name: block",
        "version: 0.0.1",
        "prompts:",
        "  - name: block-prompt",
        "    prompt: from block file",
        "",
      ].join("\n"),
    );
    await fs.writeFile(path.join(home, ".continue/rules/01-md.md"), "Use pnpm.\n");
    await fs.writeFile(
      path.join(home, ".continue/rules/team.yaml"),
      ["rules:", "  - Never push to main.", ""].join("\n"),
    );
    await fs.writeFile(
      path.join(home, ".continue/config.yaml"),
      [
        "name: Local Config",
        "prompts:",
        "  - name: tests",
        "    description: unit tests",
        "    prompt: Write tests",
        "  - name: dup",
        "    prompt: inline dup",
        "  - uses: owner/hub-prompt",
        "  - prompt: nameless",
        "rules:",
        "  - Be concise.",
        "  - name: scoped",
        "    rule: Use strict TS.",
        "    globs: \"**/*.ts\"",
        "    invokable: true",
        "  - uses: owner/hub-rule",
        "",
      ].join("\n"),
    );

    const { bundle, warnings } = await continueAdapter.exportBundle(home);
    const byName = Object.fromEntries(bundle.commands.map((c) => [c.name, c.content]));
    expect(byName.tests).toBe("---\ndescription: unit tests\ninvokable: true\n---\n\nWrite tests\n");
    expect(byName["block-prompt"]).toBe("---\ninvokable: true\n---\n\nfrom block file\n");
    expect(byName.dup).toBe("md dup prompt\n"); // markdown file wins
    expect(warnings).toContain(
      "commands:tests: defined inline in .continue/config.yaml; exported as a markdown prompt with synthesized frontmatter",
    );
    expect(warnings).toContain(
      "commands:block-prompt: defined inline in .continue/prompts/extra.yaml; exported as a markdown prompt with synthesized frontmatter",
    );
    expect(warnings).toContain(
      "commands:dup: inline prompt in .continue/config.yaml shadowed by an existing prompt with the same name; skipped",
    );
    expect(warnings).toContain(
      "commands: hub block reference (uses: owner/hub-prompt) in .continue/config.yaml is not migrated; install it from the Continue hub on the target",
    );
    expect(warnings).toContain(
      "commands: inline prompt entry in .continue/config.yaml has no string name/prompt; skipped",
    );

    expect(bundle.instructions).toContain("<!-- rule: 01-md.md -->\nUse pnpm.");
    expect(bundle.instructions).toContain(
      "<!-- rule: .continue/rules/team.yaml#1 -->\nNever push to main.",
    );
    expect(bundle.instructions).toContain(
      "<!-- rule: .continue/config.yaml#1 -->\nBe concise.",
    );
    expect(bundle.instructions).toContain(
      "<!-- rule: .continue/config.yaml scoped -->\nUse strict TS.",
    );
    expect(warnings).toContain(
      "instructions: inline rule scoped in .continue/config.yaml merged into the instructions document",
    );
    expect(warnings).toContain(
      "instructions:scoped: continue rule metadata (globs, invokable) cannot be expressed in the merged instructions document; dropped",
    );
    expect(warnings).toContain(
      "instructions: hub block reference (uses: owner/hub-rule) in .continue/config.yaml is not migrated; install it from the Continue hub on the target",
    );
  });

  it("project scope: exports inline prompts/rules from .continue yaml block files", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "am-cont-proj-inline-"));
    await fs.mkdir(path.join(dir, ".continue/prompts"), { recursive: true });
    await fs.mkdir(path.join(dir, ".continue/rules"), { recursive: true });
    await fs.writeFile(
      path.join(dir, ".continue/prompts/team.yaml"),
      ["prompts:", "  - name: deploy", "    prompt: Deploy checklist", ""].join("\n"),
    );
    await fs.writeFile(
      path.join(dir, ".continue/rules/team.yaml"),
      ["rules:", "  - Project rule.", ""].join("\n"),
    );
    const adapter = getProjectAdapter("continue");
    const { bundle, warnings } = await adapter.exportProject(dir);
    expect(bundle.commands.map((c) => c.name)).toEqual(["deploy"]);
    expect(bundle.commands[0]!.content).toBe("---\ninvokable: true\n---\n\nDeploy checklist\n");
    expect(bundle.instructions).toContain(
      "<!-- rule: .continue/rules/team.yaml#1 -->\nProject rule.",
    );
    expect(warnings).toContain(
      "commands:deploy: defined inline in .continue/prompts/team.yaml; exported as a markdown prompt with synthesized frontmatter",
    );
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
