import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { amazonq } from "../src/adapters/amazonq.js";
import { getProjectAdapter } from "../src/project.js";
import { emptyBundle } from "../src/model.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "amazonq-home");

interface AmazonqConfig {
  mcpServers: Record<string, Record<string, unknown>>;
}

describe("amazonq adapter", () => {
  it("exports servers from mcpServers with native disabled + client-specific warnings", async () => {
    const { bundle, warnings } = await amazonq.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.fetch!.transport).toBe("stdio");
    expect(byName.fetch!.env).toEqual({ FETCH_API_KEY: "test-not-a-real-token" });
    expect(byName.postgres!.enabled).toBe(false);
    expect(byName.internal!.transport).toBe("http");
    expect(byName.internal!.headers).toEqual({ Authorization: "Bearer test-not-a-real-token" });
    expect(warnings.some((w) => w.includes("timeout"))).toBe(true);
    expect(warnings.some((w) => w.includes("oauthScopes"))).toBe(true);
  });

  it("imports by merging mcpServers; other layers warn and are skipped", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "docs", transport: "stdio", command: "npx", args: ["docs-mcp"] },
      { name: "events", transport: "sse", url: "https://sse.example.com", enabled: false },
    ];
    bundle.instructions = "Do good work.";
    bundle.persona = "You are helpful.";
    bundle.memory = [{ content: "likes tabs", source: "s", kind: "long-term" }];
    bundle.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await amazonq.planImport(bundle, HOME, {});
    const config = JSON.parse(
      files.find((f) => f.path === ".aws/amazonq/mcp.json")!.content,
    ) as AmazonqConfig;
    expect(Object.keys(config.mcpServers)).toContain("fetch"); // merge keeps existing
    expect(config.mcpServers.fetch!.timeout).toBe(60000);
    expect(config.mcpServers.internal!.oauthScopes).toEqual([]);
    expect(config.mcpServers.docs!.type).toBe("stdio");
    expect(config.mcpServers.events!.type).toBe("http"); // sse downgraded
    expect(config.mcpServers.events!.disabled).toBe(true);
    expect(warnings.some((w) => w.includes("no sse transport type"))).toBe(true);
    expect(files).toHaveLength(1); // no instructions/skills files written
    expect(warnings.some((w) => w.startsWith("instructions:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("persona:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("memory:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("skills:"))).toBe(true);
  });

  it("supports --replace-mcp and missing homes", async () => {
    const incoming = emptyBundle();
    incoming.mcpServers = [{ name: "only", transport: "stdio", command: "x" }];
    const replaced = await amazonq.planImport(incoming, HOME, { replaceMcp: true });
    const config = JSON.parse(
      replaced.files.find((f) => f.path === ".aws/amazonq/mcp.json")!.content,
    ) as AmazonqConfig;
    expect(Object.keys(config.mcpServers)).toEqual(["only"]);
    expect(replaced.warnings.some((w) => w.includes("removed by --replace-mcp"))).toBe(true);

    const { bundle } = await amazonq.exportBundle("/nonexistent-home");
    expect(bundle.mcpServers).toEqual([]);
  });

  it("exports cli-agents JSON as portable agents with per-field drop warnings", async () => {
    const { bundle, warnings } = await amazonq.exportBundle(HOME);
    expect(bundle.agents.map((a) => a.name)).toEqual(["aws-helper", "code-reviewer"]);
    expect(bundle.agents.find((a) => a.name === "code-reviewer")!.content).toBe(
      '---\ndescription: "Reviews code for style and correctness"\n---\nYou are a careful code reviewer.\nFocus on correctness first.\n',
    );
    expect(bundle.agents.find((a) => a.name === "aws-helper")!.content).toBe(
      "You help with AWS infrastructure questions.\n",
    );
    expect(warnings).toContain("agents:broken.json: invalid JSON; not migrated");
    expect(warnings).toContain(
      "agents:empty.json: agent has neither prompt nor description; not migrated",
    );
    expect(warnings).toContain(
      'agents:code-reviewer: amazonq agent field "tools" has no portable equivalent; dropped',
    );
    expect(warnings).toContain(
      'agents:code-reviewer: amazonq agent field "model" has no portable equivalent; dropped',
    );
  });

  it("imports agents as agent JSON files, flattening nested names", async () => {
    const bundle = emptyBundle();
    bundle.agents = [
      {
        name: "docs-writer",
        content: '---\ndescription: "Writes docs"\n---\nYou write documentation.\n',
      },
      { name: "backend/sql", content: "You are a SQL expert.\n" },
      {
        name: "multi",
        content: "---\ndescription: d\nmode: subagent\n---\nBody here.\n",
      },
    ];
    const { files, warnings } = await amazonq.planImport(bundle, HOME, {});
    const writer = JSON.parse(
      files.find((f) => f.path === ".aws/amazonq/cli-agents/docs-writer.json")!.content,
    ) as Record<string, string>;
    expect(writer.description).toBe("Writes docs");
    expect(writer.prompt).toBe("You write documentation.\n");
    const sql = JSON.parse(
      files.find((f) => f.path === ".aws/amazonq/cli-agents/backend-sql.json")!.content,
    ) as Record<string, string>;
    expect(sql.prompt).toBe("You are a SQL expert.\n");
    expect(sql.description).toContain("Imported by agentmove");
    const multi = JSON.parse(
      files.find((f) => f.path === ".aws/amazonq/cli-agents/multi.json")!.content,
    ) as Record<string, string>;
    expect(multi.prompt).toContain("mode: subagent");
    expect(
      warnings.some((w) => w.includes("agents:backend/sql") && w.includes("imported as backend-sql")),
    ).toBe(true);
    expect(warnings.some((w) => w.includes("kept verbatim inside prompt"))).toBe(true);
  });

  it("round-trips an exported agent back to parse-equivalent JSON", async () => {
    const { bundle } = await amazonq.exportBundle(HOME);
    const { files } = await amazonq.planImport(bundle, "/nonexistent-home", {});
    const reviewer = JSON.parse(
      files.find((f) => f.path === ".aws/amazonq/cli-agents/code-reviewer.json")!.content,
    ) as Record<string, string>;
    expect(reviewer.description).toBe("Reviews code for style and correctness");
    expect(reviewer.prompt).toBe("You are a careful code reviewer.\nFocus on correctness first.\n");
  });

  it("project scope: .amazonq/mcp.json + AmazonQ.md", async () => {
    const adapter = getProjectAdapter("amazonq");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-amazonq-"));
    await fs.mkdir(path.join(dir, ".amazonq"), { recursive: true });
    await fs.writeFile(
      path.join(dir, ".amazonq/mcp.json"),
      JSON.stringify({ mcpServers: { local: { type: "stdio", command: "node" } } }),
    );
    await fs.writeFile(path.join(dir, "AmazonQ.md"), "# Repo rules\n");
    await fs.mkdir(path.join(dir, ".amazonq/cli-agents"), { recursive: true });
    await fs.writeFile(
      path.join(dir, ".amazonq/cli-agents/helper.json"),
      JSON.stringify({ description: "Project helper", prompt: "Help here.\n" }),
    );
    const exported = await adapter.exportProject(dir);
    expect(exported.bundle.mcpServers.map((s) => s.name)).toEqual(["local"]);
    expect(exported.bundle.instructions).toContain("Repo rules");
    expect(exported.bundle.agents.map((a) => a.name)).toEqual(["helper"]);

    const bundle = emptyBundle();
    bundle.mcpServers = [{ name: "db", transport: "http", url: "https://db.example.com" }];
    bundle.instructions = "Project rules.";
    bundle.agents = [{ name: "tester", content: "You test things.\n" }];
    bundle.skills = [{ name: "review", files: { "SKILL.md": "y" } }];
    const { files, warnings } = await adapter.planImport(bundle, dir, {});
    const config = JSON.parse(
      files.find((f) => f.path === ".amazonq/mcp.json")!.content,
    ) as AmazonqConfig;
    expect(Object.keys(config.mcpServers).sort()).toEqual(["db", "local"]);
    expect(config.mcpServers.db!.type).toBe("http");
    expect(files.some((f) => f.path === "AmazonQ.md")).toBe(true);
    expect(files.some((f) => f.path === ".amazonq/cli-agents/tester.json")).toBe(true);
    expect(warnings.some((w) => w.startsWith("skills:"))).toBe(true);
  });
});
