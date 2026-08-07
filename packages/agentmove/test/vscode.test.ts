import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { vscode } from "../src/adapters/vscode.js";
import { getProjectAdapter } from "../src/project.js";
import { emptyBundle } from "../src/model.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "vscode-home");

describe("vscode adapter", () => {
  it("exports servers from the user profile mcp.json", async () => {
    const { bundle, warnings } = await vscode.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.playwright!.transport).toBe("stdio");
    expect(byName.playwright!.command).toBe("npx");
    expect(byName.playwright!.env).toEqual({ API_TOKEN: "test-not-a-real-token" });
    expect(byName.github!.transport).toBe("http");
    expect(byName.github!.url).toBe("https://api.githubcopilot.com/mcp");
    expect(warnings.some((w) => w.includes("only user MCP servers and skills migrate"))).toBe(true);
  });

  it("exports personal skills from ~/.agents/skills", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-vsc-sk-"));
    const dir = path.join(home, ".agents/skills/review");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "SKILL.md"), "# review");
    const { bundle } = await vscode.exportBundle(home);
    expect(bundle.skills).toEqual([{ name: "review", files: { "SKILL.md": "# review" } }]);
  });

  it("finds the macOS profile location too", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-vsc-"));
    const dir = path.join(home, "Library/Application Support/Code/User");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "mcp.json"),
      JSON.stringify({ servers: { one: { command: "x" } } }),
    );
    expect(await vscode.detect(home)).toBe(true);
    const { bundle } = await vscode.exportBundle(home);
    expect(bundle.mcpServers.map((s) => s.name)).toEqual(["one"]);
  });

  it("imports with merge under the servers key and warns for unsupported layers", async () => {
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
    const { files, warnings } = await vscode.planImport(bundle, HOME, {});
    expect(files).toHaveLength(2);
    expect(files[0]!.path).toBe(".config/Code/User/mcp.json");
    expect(files[1]!.path).toBe(".agents/skills/sk/SKILL.md");
    const config = JSON.parse(files[0]!.content) as {
      servers: Record<string, Record<string, unknown>>;
    };
    expect(config.servers.playwright).toBeDefined(); // merge keeps existing
    expect(config.servers.docs!.command).toBe("npx");
    expect(config.servers.docs!.type).toBeUndefined(); // stdio entries carry no type
    expect(config.servers.api!.type).toBe("sse");
    expect(config.servers.api!.url).toBe("https://sse.example.com");
    for (const layer of ["instructions", "persona", "memory"]) {
      expect(warnings.some((w) => w.startsWith(`${layer}:`)), layer).toBe(true);
    }
    expect(warnings.some((w) => w.includes("skills: written to ~/.agents/skills"))).toBe(true);
    expect(warnings.some((w) => w.includes("no disabled flag"))).toBe(true);
  });

  it("project scope: .vscode/mcp.json + .github/copilot-instructions.md", async () => {
    const adapter = getProjectAdapter("vscode");
    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "db", transport: "stdio", command: "npx" }];
    bundle.instructions = "Repo rules.";
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await adapter.planImport(bundle, "/nonexistent-project", {});
    const config = JSON.parse(
      files.find((f) => f.path === ".vscode/mcp.json")!.content,
    ) as { servers: Record<string, unknown> };
    expect(config.servers.db).toBeDefined();
    expect(files.some((f) => f.path === ".github/copilot-instructions.md")).toBe(true);
    expect(files.some((f) => f.path === ".github/skills/sk/SKILL.md")).toBe(true);
    expect(warnings.some((w) => w.includes("no SKILL.md mechanism"))).toBe(false);
  });
});
