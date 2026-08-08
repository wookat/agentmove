import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copilot } from "../src/adapters/copilot.js";
import { claudeCode } from "../src/adapters/claude-code.js";
import { gemini } from "../src/adapters/gemini.js";
import { cursor } from "../src/adapters/cursor.js";
import { droid } from "../src/adapters/droid.js";
import { codebuddy } from "../src/adapters/codebuddy.js";
import { qoder } from "../src/adapters/qoder.js";
import { kimi } from "../src/adapters/kimi.js";
import { kiro } from "../src/adapters/kiro.js";
import { opencode } from "../src/adapters/opencode.js";
import { qwen } from "../src/adapters/qwen.js";
import { getProjectAdapter } from "../src/project.js";
import { emptyBundle, filterBundle } from "../src/model.js";
import { readBundle, writeBundle } from "../src/bundle.js";
import { diffBundles } from "../src/diff.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("custom agents layer", () => {
  it("copilot exports ~/.copilot/agents/*.agent.md byte-faithfully", async () => {
    const { bundle } = await copilot.exportBundle(path.join(FIXTURES, "copilot-home"));
    expect(bundle.agents.map((a) => a.name)).toEqual(["code-reviewer"]);
    const raw = await fs.readFile(
      path.join(FIXTURES, "copilot-home/.copilot/agents/code-reviewer.agent.md"),
      "utf8",
    );
    expect(bundle.agents[0]!.content).toBe(raw);
  });

  it("claude-code exports ~/.claude/agents/*.md", async () => {
    const { bundle } = await claudeCode.exportBundle(path.join(FIXTURES, "claude-home"));
    expect(bundle.agents.map((a) => a.name)).toEqual(["test-runner"]);
    expect(bundle.agents[0]!.content).toContain("tools: Bash, Read");
  });

  it("gemini exports ~/.gemini/agents/*.md", async () => {
    const { bundle } = await gemini.exportBundle(path.join(FIXTURES, "gemini-home"));
    expect(bundle.agents.map((a) => a.name)).toEqual(["doc-writer"]);
  });

  it("copilot plans agents into ~/.copilot/agents with the .agent.md extension", async () => {
    const bundle = emptyBundle();
    bundle.agents = [{ name: "helper", content: "---\nname: helper\n---\n\nHelp.\n" }];
    const { files, warnings } = await copilot.planImport(bundle, "/nonexistent-home", {});
    const plan = files.find((f) => f.path === ".copilot/agents/helper.agent.md")!;
    expect(plan.content).toBe("---\nname: helper\n---\n\nHelp.\n");
    expect(warnings.some((w) => w.startsWith("agents:"))).toBe(true);
  });

  it("claude-code plans agents into ~/.claude/agents/*.md", async () => {
    const bundle = emptyBundle();
    bundle.agents = [{ name: "helper", content: "Help.\n" }];
    const { files } = await claudeCode.planImport(bundle, "/nonexistent-home", {});
    expect(files.some((f) => f.path === ".claude/agents/helper.md")).toBe(true);
  });

  it("gemini plans agents into ~/.gemini/agents and warns about the experimental flag", async () => {
    const bundle = emptyBundle();
    bundle.agents = [{ name: "helper", content: "Help.\n" }];
    const { files, warnings } = await gemini.planImport(bundle, "/nonexistent-home", {});
    expect(files.some((f) => f.path === ".gemini/agents/helper.md")).toBe(true);
    expect(warnings.some((w) => w.includes("experimental"))).toBe(true);
  });

  it("opencode exports agents/ plus legacy agent/ (agents/ wins on name clashes)", async () => {
    const { bundle } = await opencode.exportBundle(path.join(FIXTURES, "opencode-home"));
    expect(bundle.agents.map((a) => a.name)).toEqual(["legacy-helper", "reviewer"]);
    const raw = await fs.readFile(
      path.join(FIXTURES, "opencode-home/.config/opencode/agents/reviewer.md"),
      "utf8",
    );
    expect(bundle.agents.find((a) => a.name === "reviewer")!.content).toBe(raw);
  });

  it("qwen exports ~/.qwen/agents/*.md byte-faithfully", async () => {
    const { bundle } = await qwen.exportBundle(path.join(FIXTURES, "qwen-home"));
    expect(bundle.agents.map((a) => a.name)).toEqual(["test-writer"]);
    const raw = await fs.readFile(
      path.join(FIXTURES, "qwen-home/.qwen/agents/test-writer.md"),
      "utf8",
    );
    expect(bundle.agents[0]!.content).toBe(raw);
  });

  it("cursor exports ~/.cursor/agents/*.md byte-faithfully", async () => {
    const { bundle } = await cursor.exportBundle(path.join(FIXTURES, "cursor-home"));
    expect(bundle.agents.map((a) => a.name)).toEqual(["verifier"]);
    const raw = await fs.readFile(
      path.join(FIXTURES, "cursor-home/.cursor/agents/verifier.md"),
      "utf8",
    );
    expect(bundle.agents[0]!.content).toBe(raw);
  });

  it("cursor plans agents into ~/.cursor/agents/*.md with a warning", async () => {
    const bundle = emptyBundle();
    bundle.agents = [{ name: "helper", content: "Help.\n" }];
    const { files, warnings } = await cursor.planImport(bundle, "/nonexistent-home", {});
    expect(files.some((f) => f.path === ".cursor/agents/helper.md")).toBe(true);
    expect(warnings.some((w) => w.startsWith("agents:"))).toBe(true);
  });

  it("kiro exports ~/.kiro/agents/*.md byte-faithfully and warns on JSON agent configs", async () => {
    const { bundle, warnings } = await kiro.exportBundle(path.join(FIXTURES, "kiro-home"));
    expect(bundle.agents.map((a) => a.name)).toEqual(["refactorer"]);
    const raw = await fs.readFile(
      path.join(FIXTURES, "kiro-home/.kiro/agents/refactorer.md"),
      "utf8",
    );
    expect(bundle.agents[0]!.content).toBe(raw);
    expect(warnings.some((w) => w.includes("legacy-config.json"))).toBe(true);
  });

  it("kiro plans agents into ~/.kiro/agents/*.md with a warning", async () => {
    const bundle = emptyBundle();
    bundle.agents = [{ name: "helper", content: "Help.\n" }];
    const { files, warnings } = await kiro.planImport(bundle, "/nonexistent-home", {});
    expect(files.some((f) => f.path === ".kiro/agents/helper.md")).toBe(true);
    expect(warnings.some((w) => w.startsWith("agents:"))).toBe(true);
  });

  it("droid exports ~/.factory/droids/*.md byte-faithfully", async () => {
    const { bundle } = await droid.exportBundle(path.join(FIXTURES, "droid-home"));
    expect(bundle.agents.map((a) => a.name)).toEqual(["code-reviewer"]);
    const raw = await fs.readFile(
      path.join(FIXTURES, "droid-home/.factory/droids/code-reviewer.md"),
      "utf8",
    );
    expect(bundle.agents[0]!.content).toBe(raw);
  });

  it("droid plans agents into ~/.factory/droids/*.md with a warning", async () => {
    const bundle = emptyBundle();
    bundle.agents = [{ name: "helper", content: "Help.\n" }];
    const { files, warnings } = await droid.planImport(bundle, "/nonexistent-home", {});
    expect(files.some((f) => f.path === ".factory/droids/helper.md")).toBe(true);
    expect(warnings.some((w) => w.startsWith("agents:"))).toBe(true);
  });

  it("codebuddy exports ~/.codebuddy/agents/*.md byte-faithfully", async () => {
    const { bundle } = await codebuddy.exportBundle(path.join(FIXTURES, "codebuddy-home"));
    expect(bundle.agents.map((a) => a.name)).toEqual(["code-reviewer"]);
    const raw = await fs.readFile(
      path.join(FIXTURES, "codebuddy-home/.codebuddy/agents/code-reviewer.md"),
      "utf8",
    );
    expect(bundle.agents[0]!.content).toBe(raw);
  });

  it("codebuddy plans agents into ~/.codebuddy/agents/*.md with a warning", async () => {
    const bundle = emptyBundle();
    bundle.agents = [{ name: "helper", content: "Help.\n" }];
    const { files, warnings } = await codebuddy.planImport(bundle, "/nonexistent-home", {});
    expect(files.some((f) => f.path === ".codebuddy/agents/helper.md")).toBe(true);
    expect(warnings.some((w) => w.startsWith("agents:"))).toBe(true);
  });

  it("qoder exports ~/.qoder/agents/*.md byte-faithfully", async () => {
    const { bundle } = await qoder.exportBundle(path.join(FIXTURES, "qoder-home"));
    expect(bundle.agents.map((a) => a.name)).toEqual(["api-reviewer"]);
    const raw = await fs.readFile(
      path.join(FIXTURES, "qoder-home/.qoder/agents/api-reviewer.md"),
      "utf8",
    );
    expect(bundle.agents[0]!.content).toBe(raw);
  });

  it("qoder plans agents into ~/.qoder/agents/*.md with a warning", async () => {
    const bundle = emptyBundle();
    bundle.agents = [{ name: "helper", content: "Help.\n" }];
    const { files, warnings } = await qoder.planImport(bundle, "/nonexistent-home", {});
    expect(files.some((f) => f.path === ".qoder/agents/helper.md")).toBe(true);
    expect(warnings.some((w) => w.startsWith("agents:"))).toBe(true);
  });

  it("kimi exports agents recursively from both user roots, kimi dir wins conflicts", async () => {
    const { bundle } = await kimi.exportBundle(path.join(FIXTURES, "kimi-home"));
    expect(bundle.agents.map((a) => a.name)).toEqual([
      "reviewer",
      "shared-helper",
      "team/planner",
    ]);
    const brand = await fs.readFile(
      path.join(FIXTURES, "kimi-home/.kimi-code/agents/reviewer.md"),
      "utf8",
    );
    expect(bundle.agents.find((a) => a.name === "reviewer")!.content).toBe(brand);
    const nested = await fs.readFile(
      path.join(FIXTURES, "kimi-home/.kimi-code/agents/team/planner.md"),
      "utf8",
    );
    expect(bundle.agents.find((a) => a.name === "team/planner")!.content).toBe(nested);
    const shared = await fs.readFile(
      path.join(FIXTURES, "kimi-home/.agents/agents/shared-helper.md"),
      "utf8",
    );
    expect(bundle.agents.find((a) => a.name === "shared-helper")!.content).toBe(shared);
  });

  it("kimi plans agents into ~/.kimi-code/agents/*.md (nested paths kept) with a warning", async () => {
    const bundle = emptyBundle();
    bundle.agents = [
      { name: "helper", content: "Help.\n" },
      { name: "team/planner", content: "Plan.\n" },
    ];
    const { files, warnings } = await kimi.planImport(bundle, "/nonexistent-home", {});
    expect(files.some((f) => f.path === ".kimi-code/agents/helper.md")).toBe(true);
    expect(files.some((f) => f.path === ".kimi-code/agents/team/planner.md")).toBe(true);
    expect(warnings.some((w) => w.startsWith("agents:"))).toBe(true);
  });

  it("opencode plans agents into ~/.config/opencode/agents/*.md with a warning", async () => {
    const bundle = emptyBundle();
    bundle.agents = [{ name: "helper", content: "Help.\n" }];
    const { files, warnings } = await opencode.planImport(bundle, "/nonexistent-home", {});
    expect(files.some((f) => f.path === ".config/opencode/agents/helper.md")).toBe(true);
    expect(warnings.some((w) => w.startsWith("agents:"))).toBe(true);
  });

  it("qwen plans agents into ~/.qwen/agents/*.md with a warning", async () => {
    const bundle = emptyBundle();
    bundle.agents = [{ name: "helper", content: "Help.\n" }];
    const { files, warnings } = await qwen.planImport(bundle, "/nonexistent-home", {});
    expect(files.some((f) => f.path === ".qwen/agents/helper.md")).toBe(true);
    expect(warnings.some((w) => w.startsWith("agents:"))).toBe(true);
  });

  it("does not plan or warn when the bundle has no agents", async () => {
    const { files, warnings } = await copilot.planImport(emptyBundle(), "/nonexistent-home", {});
    expect(files.some((f) => f.path.startsWith(".copilot/agents/"))).toBe(false);
    expect(warnings.some((w) => w.startsWith("agents:"))).toBe(false);
  });

  it("project scope: copilot .github/agents, claude-code .claude/agents, gemini .gemini/agents", async () => {
    const bundle = emptyBundle();
    bundle.agents = [{ name: "helper", content: "Help.\n" }];
    const copilotFiles = (await getProjectAdapter("copilot").planImport(bundle, "/p", {})).files;
    expect(copilotFiles.some((f) => f.path === ".github/agents/helper.agent.md")).toBe(true);
    const claudeFiles = (await getProjectAdapter("claude-code").planImport(bundle, "/p", {})).files;
    expect(claudeFiles.some((f) => f.path === ".claude/agents/helper.md")).toBe(true);
    const geminiFiles = (await getProjectAdapter("gemini").planImport(bundle, "/p", {})).files;
    expect(geminiFiles.some((f) => f.path === ".gemini/agents/helper.md")).toBe(true);
    const opencodeFiles = (await getProjectAdapter("opencode").planImport(bundle, "/p", {})).files;
    expect(opencodeFiles.some((f) => f.path === ".opencode/agents/helper.md")).toBe(true);
    const qwenFiles = (await getProjectAdapter("qwen").planImport(bundle, "/p", {})).files;
    expect(qwenFiles.some((f) => f.path === ".qwen/agents/helper.md")).toBe(true);
    const cursorFiles = (await getProjectAdapter("cursor").planImport(bundle, "/p", {})).files;
    expect(cursorFiles.some((f) => f.path === ".cursor/agents/helper.md")).toBe(true);
    const kiroFiles = (await getProjectAdapter("kiro").planImport(bundle, "/p", {})).files;
    expect(kiroFiles.some((f) => f.path === ".kiro/agents/helper.md")).toBe(true);
    const droidFiles = (await getProjectAdapter("droid").planImport(bundle, "/p", {})).files;
    expect(droidFiles.some((f) => f.path === ".factory/droids/helper.md")).toBe(true);
    const codebuddyFiles = (await getProjectAdapter("codebuddy").planImport(bundle, "/p", {}))
      .files;
    expect(codebuddyFiles.some((f) => f.path === ".codebuddy/agents/helper.md")).toBe(true);
    const qoderFiles = (await getProjectAdapter("qoder").planImport(bundle, "/p", {})).files;
    expect(qoderFiles.some((f) => f.path === ".qoder/agents/helper.md")).toBe(true);
    const kimiFiles = (await getProjectAdapter("kimi").planImport(bundle, "/p", {})).files;
    expect(kimiFiles.some((f) => f.path === ".kimi-code/agents/helper.md")).toBe(true);
  });

  it("bundle round-trips the agents layer byte-faithfully", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-agents-"));
    const bundle = emptyBundle();
    bundle.agents = [{ name: "reviewer", content: "---\ntools: [read]\n---\n\nReview.\n" }];
    await writeBundle(bundle, dir);
    const back = await readBundle(dir);
    expect(back.agents).toEqual(bundle.agents);
  });

  it("filterBundle keeps/drops the agents layer via --only semantics", () => {
    const bundle = emptyBundle();
    bundle.agents = [{ name: "a", content: "x" }];
    expect(filterBundle(bundle, ["agents"]).agents).toHaveLength(1);
    expect(filterBundle(bundle, ["mcp"]).agents).toHaveLength(0);
  });

  it("diff reports added/removed/changed agents", () => {
    const a = emptyBundle();
    const b = emptyBundle();
    a.agents = [
      { name: "same", content: "x" },
      { name: "gone", content: "y" },
      { name: "edit", content: "v1" },
    ];
    b.agents = [
      { name: "same", content: "x" },
      { name: "edit", content: "v2" },
      { name: "new", content: "z" },
    ];
    const items = diffBundles(a, b).filter((i) => i.layer === "agents");
    expect(items).toEqual([
      { layer: "agents", kind: "removed", name: "gone" },
      { layer: "agents", kind: "changed", name: "edit" },
      { layer: "agents", kind: "added", name: "new" },
    ]);
  });
});
