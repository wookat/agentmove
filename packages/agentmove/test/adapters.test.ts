import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseToml } from "smol-toml";
import { parse as parseYaml } from "yaml";
import { ADAPTERS } from "../src/adapters/index.js";
import { CLIENT_IDS, isRecord } from "../src/model.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const homeOf = (name: string) => path.join(FIXTURES, name);

describe("detect", () => {
  it("detects each fixture client and not the others' homes", async () => {
    for (const id of CLIENT_IDS) {
      const homeName = `${id === "claude-code" ? "claude" : id}-home`;
      expect(await ADAPTERS[id].detect(homeOf(homeName)), id).toBe(true);
      expect(await ADAPTERS[id].detect(homeOf("empty-home")), id).toBe(false);
    }
  });
});

describe("openclaw export", () => {
  it("exports config, mcp, persona, memory, skills", async () => {
    const { bundle, warnings } = await ADAPTERS.openclaw.exportBundle(homeOf("openclaw-home"));
    expect(bundle.config.model).toBe("anthropic/claude-4.5-opus");
    expect(bundle.mcpServers).toHaveLength(2);
    const remote = bundle.mcpServers.find((s) => s.name === "remote")!;
    expect(remote.transport).toBe("http");
    expect(remote.headers?.Authorization).toBe("Bearer abc123");
    expect(bundle.persona).toContain("Clawd");
    expect(bundle.instructions).toContain("Be terse");
    expect(bundle.memory.map((m) => m.kind).sort()).toEqual(["daily", "long-term", "user-profile"]);
    expect(bundle.memory.find((m) => m.kind === "daily")?.date).toBe("2026-08-01");
    expect(bundle.skills.map((s) => s.name)).toEqual(["todo"]);
    expect(warnings).toEqual([]);
  });
});

describe("hermes", () => {
  it("exports § delimited memory entries", async () => {
    const { bundle } = await ADAPTERS.hermes.exportBundle(homeOf("hermes-home"));
    expect(bundle.config.model).toBe("hermes-4");
    expect(bundle.memory.filter((m) => m.kind === "long-term")).toHaveLength(2);
    expect(bundle.memory.filter((m) => m.kind === "user-profile")).toHaveLength(1);
    expect(bundle.skills.map((s) => s.name)).toEqual(["notes"]);
  });

  it("openclaw -> hermes convert plans the documented layout", async () => {
    const { bundle } = await ADAPTERS.openclaw.exportBundle(homeOf("openclaw-home"));
    const { files } = await ADAPTERS.hermes.planImport(bundle, homeOf("hermes-home"));
    const paths = files.map((f) => f.path);
    expect(paths).toContain(".hermes/SOUL.md");
    expect(paths).toContain(".hermes/AGENTS.md");
    expect(paths).toContain(".hermes/memories/MEMORY.md");
    expect(paths).toContain(".hermes/memories/USER.md");
    expect(paths).toContain(".hermes/skills/agentmove-imports/todo/SKILL.md");
    const memory = files.find((f) => f.path === ".hermes/memories/MEMORY.md")!;
    expect(memory.content).toContain("§");
    const config = files.find((f) => f.path === ".hermes/config.yaml")!;
    const parsed = parseYaml(config.content) as Record<string, unknown>;
    expect(parsed.model).toBe("anthropic/claude-4.5-opus");
    expect(isRecord(parsed.mcp_servers) && Object.keys(parsed.mcp_servers)).toEqual([
      "docs",
      "remote",
    ]);
  });
});

describe("claude-code", () => {
  it("exports mcp + instructions + skills", async () => {
    const { bundle } = await ADAPTERS["claude-code"].exportBundle(homeOf("claude-home"));
    expect(bundle.mcpServers[0]?.name).toBe("notion");
    expect(bundle.instructions).toContain("Named exports");
    expect(bundle.skills.map((s) => s.name)).toEqual(["review"]);
  });

  it("approximates persona/memory into CLAUDE.md on import with warnings", async () => {
    const { bundle } = await ADAPTERS.openclaw.exportBundle(homeOf("openclaw-home"));
    const { files, warnings } = await ADAPTERS["claude-code"].planImport(bundle, homeOf("claude-home"));
    const claudeMd = files.find((f) => f.path === ".claude/CLAUDE.md")!;
    expect(claudeMd.content).toContain("persona (SOUL.md)");
    expect(claudeMd.content).toContain("Clawd");
    expect(warnings.some((w) => w.includes("approximated"))).toBe(true);
  });
});

describe("codex", () => {
  it("round-trips TOML mcp servers including http_headers and enabled", async () => {
    const { bundle } = await ADAPTERS.codex.exportBundle(homeOf("codex-home"));
    expect(bundle.config.model).toBe("gpt-5.2-codex");
    const search = bundle.mcpServers.find((s) => s.name === "search")!;
    expect(search.headers?.["X-Api-Key"]).toBe("k123");
    expect(search.enabled).toBe(false);

    const { files } = await ADAPTERS.codex.planImport(bundle, homeOf("empty-home"));
    const config = files.find((f) => f.path === ".codex/config.toml")!;
    const parsed = parseToml(config.content) as Record<string, unknown>;
    const servers = parsed.mcp_servers as Record<string, Record<string, unknown>>;
    expect(servers.search.enabled).toBe(false);
    expect((servers.search.http_headers as Record<string, string>)["X-Api-Key"]).toBe("k123");
    expect(servers.linear.command).toBe("npx");
  });

  it("maps bearer_token_env_var and env_http_headers to placeholder headers on export", async () => {
    const { bundle, warnings } = await ADAPTERS.codex.exportBundle(homeOf("codex-home"));
    const github = bundle.mcpServers.find((s) => s.name === "github")!;
    expect(github.headers?.Authorization).toBe("Bearer ${GITHUB_TOKEN}");
    expect(github.headers?.["X-Org-Id"]).toBe("${ORG_ID}");
    expect(
      warnings.some((w) => w.includes("startup_timeout_sec, tool_timeout_sec")),
    ).toBe(true);
  });

  it("writes placeholder headers back as native bearer_token_env_var / env_http_headers", async () => {
    const { bundle } = await ADAPTERS.codex.exportBundle(homeOf("codex-home"));
    const { files, warnings } = await ADAPTERS.codex.planImport(bundle, homeOf("empty-home"));
    const config = files.find((f) => f.path === ".codex/config.toml")!;
    const parsed = parseToml(config.content) as Record<string, unknown>;
    const servers = parsed.mcp_servers as Record<string, Record<string, unknown>>;
    expect(servers.github.bearer_token_env_var).toBe("GITHUB_TOKEN");
    expect((servers.github.env_http_headers as Record<string, string>)["X-Org-Id"]).toBe("ORG_ID");
    expect(servers.github.http_headers).toBeUndefined();
    expect(warnings.some((w) => w.includes("bearer_token_env_var"))).toBe(true);
  });
});

describe("cursor", () => {
  it("exports mcp and reports lossy layers on import", async () => {
    const { bundle } = await ADAPTERS.cursor.exportBundle(homeOf("cursor-home"));
    expect(bundle.mcpServers[0]?.url).toBe("https://api.githubcopilot.com/mcp/");
    expect(bundle.skills.map((s) => s.name)).toEqual(["deploy-helper"]);

    const { bundle: src } = await ADAPTERS.openclaw.exportBundle(homeOf("openclaw-home"));
    const { files, warnings } = await ADAPTERS.cursor.planImport(src, homeOf("cursor-home"));
    expect(files.some((f) => f.path === ".cursor/rules/agentmove-imported.mdc")).toBe(true);
    expect(warnings.some((w) => w.startsWith("memory:"))).toBe(true);
    expect(warnings.some((w) => w.startsWith("skills:"))).toBe(false);
  });

  it("plans skills into ~/.cursor/skills on import", async () => {
    const { bundle } = await ADAPTERS.cursor.exportBundle(homeOf("cursor-home"));
    const { files } = await ADAPTERS.cursor.planImport(bundle, homeOf("empty-home"));
    expect(files.some((f) => f.path === ".cursor/skills/deploy-helper/SKILL.md")).toBe(true);
  });
});

describe("gemini", () => {
  it("splits Gemini Added Memories from instructions", async () => {
    const { bundle } = await ADAPTERS.gemini.exportBundle(homeOf("gemini-home"));
    expect(bundle.instructions).toContain("Prefer pnpm");
    expect(bundle.instructions).not.toContain("Added Memories");
    expect(bundle.memory).toHaveLength(2);
    expect(bundle.memory[0]?.content).toBe("User's name is Thomas.");
  });

  it("writes memories back into GEMINI.md on import", async () => {
    const { bundle } = await ADAPTERS.gemini.exportBundle(homeOf("gemini-home"));
    const { files } = await ADAPTERS.gemini.planImport(bundle, homeOf("empty-home"));
    const md = files.find((f) => f.path === ".gemini/GEMINI.md")!;
    expect(md.content).toContain("## Gemini Added Memories");
    expect(md.content).toContain("- Deploys on Cloudflare.");
  });
});
