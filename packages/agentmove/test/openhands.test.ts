import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseToml } from "smol-toml";
import { openhands } from "../src/adapters/openhands.js";
import { emptyBundle, isRecord } from "../src/model.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "openhands-home");

describe("openhands adapter", () => {
  it("exports stdio/shttp/sse server lists and user microagents", async () => {
    const { bundle, warnings } = await openhands.exportBundle(HOME);
    const byName = Object.fromEntries(bundle.mcpServers.map((s) => [s.name, s]));
    expect(byName.files!.transport).toBe("stdio");
    expect(byName.files!.command).toBe("npx");
    expect(byName["mcp-example-com"]!.transport).toBe("http");
    expect(byName["mcp-example-com"]!.headers?.Authorization).toBe("Bearer test-not-a-real-token");
    expect(byName["sse-example-com"]!.transport).toBe("sse");
    expect(bundle.instructions).toContain("Always use pnpm.");
    expect(warnings.some((w) => w.includes("microagents"))).toBe(true);
  });

  it("imports into transport-specific TOML lists with merge semantics", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [
      { name: "web", transport: "http", url: "https://other.example.com/mcp" },
      {
        name: "authed",
        transport: "sse",
        url: "https://a.example.com/sse",
        headers: { Authorization: "Bearer tok" },
      },
      { name: "solo", transport: "stdio", command: "srv" },
    ];
    bundle.instructions = "Do good work.";
    const { files, warnings } = await openhands.planImport(bundle, HOME, {});
    const config = parseToml(files.find((f) => f.path.endsWith("config.toml"))!.content);
    expect(isRecord(config) && isRecord(config.mcp)).toBe(true);
    const mcp = (config as { mcp: Record<string, unknown> }).mcp;
    const stdio = mcp.stdio_servers as { name: string }[];
    expect(stdio.map((s) => s.name).sort()).toEqual(["files", "solo"]); // merged
    const shttp = mcp.shttp_servers as unknown[];
    expect(shttp).toHaveLength(2); // existing + imported, deduped by url
    const sse = mcp.sse_servers as unknown[];
    expect(sse).toContainEqual({ url: "https://a.example.com/sse", api_key: "tok" });
    expect(
      files.find((f) => f.path === ".openhands/microagents/agentmove-imported.md")!.content,
    ).toContain("Do good work.");
    expect(warnings).toEqual([]);
  });

  it("warns on non-bearer headers, memory, skills, and skips config on unrelated imports", async () => {
    const bundle = emptyBundle();
    bundle.mcpServers = [
      {
        name: "hdr",
        transport: "http",
        url: "https://h.example.com/mcp",
        headers: { "X-Custom": "v" },
      },
    ];
    const withMcp = await openhands.planImport(bundle, HOME, {});
    expect(withMcp.warnings.some((w) => w.includes("api_key"))).toBe(true);

    const other = emptyBundle();
    other.persona = "You are helpful.";
    other.memory = [{ content: "m", source: "s", kind: "long-term" }];
    other.skills = [{ name: "sk", files: { "SKILL.md": "x" } }];
    const { files, warnings } = await openhands.planImport(other, HOME, {});
    expect(files.some((f) => f.path.endsWith("config.toml"))).toBe(false);
    expect(files.find((f) => f.path.endsWith("agentmove-imported.md"))!.content).toContain(
      "You are helpful.",
    );
    expect(warnings.some((w) => w.startsWith("memory:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("skills:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("persona:"))).toBe(true);
  });
});
