import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ADAPTERS } from "../src/adapters/index.js";
import { readBundle, stripSecrets, writeBundle } from "../src/bundle.js";
import { diffBundles } from "../src/diff.js";
import { runDoctor } from "../src/doctor.js";
import { applyPlans, backupPaths } from "../src/apply.js";
import { emptyBundle, filterBundle, parseLayers } from "../src/model.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("bundle round-trip", () => {
  it("write + read preserves all layers", async () => {
    const { bundle } = await ADAPTERS.openclaw.exportBundle(path.join(FIXTURES, "openclaw-home"));
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-"));
    await writeBundle(bundle, dir);
    const loaded = await readBundle(dir);
    expect(loaded.mcpServers).toEqual(bundle.mcpServers);
    expect(loaded.persona).toBe(bundle.persona);
    expect(loaded.instructions).toBe(bundle.instructions);
    expect(loaded.memory).toEqual(bundle.memory);
    expect(loaded.skills).toEqual(bundle.skills);
    expect(diffBundles(bundle, loaded)).toEqual([]);
  });
});

describe("stripSecrets", () => {
  it("replaces likely-secret env values with placeholders", async () => {
    const { bundle } = await ADAPTERS["claude-code"].exportBundle(path.join(FIXTURES, "claude-home"));
    const { bundle: clean, redacted } = stripSecrets(bundle);
    expect(redacted).toEqual(["mcp:notion.env.NOTION_TOKEN"]);
    expect(clean.mcpServers[0]?.env?.NOTION_TOKEN).toBe("${NOTION_TOKEN}");
  });
});

describe("diff", () => {
  it("reports per-layer differences between clients", async () => {
    const [a, b] = await Promise.all([
      ADAPTERS.openclaw.exportBundle(path.join(FIXTURES, "openclaw-home")),
      ADAPTERS.hermes.exportBundle(path.join(FIXTURES, "hermes-home")),
    ]);
    const items = diffBundles(a.bundle, b.bundle);
    expect(items.find((i) => i.layer === "config" && i.name === "model")).toBeTruthy();
    expect(items.filter((i) => i.layer === "mcp").length).toBeGreaterThan(0);
    expect(items.filter((i) => i.layer === "skills").length).toBe(2);
  });
});

describe("doctor", () => {
  it("detects only the fixture client for each home", async () => {
    const reports = await runDoctor(path.join(FIXTURES, "codex-home"));
    const codex = reports.find((r) => r.id === "codex")!;
    expect(codex.detected).toBe(true);
    expect(codex.inventory?.mcpServers).toBe(2);
    expect(reports.find((r) => r.id === "hermes")?.detected).toBe(false);
  });
});

describe("apply + backup", () => {
  it("backs up overwritten files and writes plans", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-home-"));
    await fs.mkdir(path.join(home, ".hermes"), { recursive: true });
    await fs.writeFile(path.join(home, ".hermes/SOUL.md"), "old persona\n");
    const plans = [
      { path: ".hermes/SOUL.md", content: "new persona\n" },
      { path: ".hermes/AGENTS.md", content: "instructions\n" },
    ];
    const backupDir = await backupPaths(plans, home);
    expect(backupDir).toBeTruthy();
    expect(await fs.readFile(path.join(backupDir!, ".hermes/SOUL.md"), "utf8")).toBe("old persona\n");
    await applyPlans(plans, home);
    expect(await fs.readFile(path.join(home, ".hermes/SOUL.md"), "utf8")).toBe("new persona\n");
    expect(await fs.readFile(path.join(home, ".hermes/AGENTS.md"), "utf8")).toBe("instructions\n");
  });
});

describe("layer filtering (--only)", () => {
  it("parses comma-separated layers and rejects unknowns", () => {
    expect(parseLayers("mcp, skills")).toEqual(["mcp", "skills"]);
    expect(parseLayers("memory,instructions,persona")).toEqual([
      "memory",
      "instructions",
      "persona",
    ]);
    expect(() => parseLayers("mcp,bogus")).toThrow(/unknown layer "bogus"/);
  });

  it("keeps only the requested layers", () => {
    const bundle = {
      ...emptyBundle(),
      mcpServers: [{ name: "a", transport: "stdio" as const }],
      skills: [{ name: "s", files: { "SKILL.md": "x" } }],
      memory: [{ content: "m", source: "MEMORY.md", kind: "long-term" as const }],
      instructions: "inst",
      persona: "soul",
    };
    const onlyMcp = filterBundle(bundle, parseLayers("mcp"));
    expect(onlyMcp.mcpServers).toHaveLength(1);
    expect(onlyMcp.skills).toHaveLength(0);
    expect(onlyMcp.memory).toHaveLength(0);
    expect(onlyMcp.instructions).toBeUndefined();
    expect(onlyMcp.persona).toBeUndefined();

    const rest = filterBundle(bundle, parseLayers("skills,memory,instructions,persona"));
    expect(rest.mcpServers).toHaveLength(0);
    expect(rest.skills).toHaveLength(1);
    expect(rest.memory).toHaveLength(1);
    expect(rest.instructions).toBe("inst");
    expect(rest.persona).toBe("soul");
  });
});
