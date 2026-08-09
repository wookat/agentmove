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

  it("opencode merges {agent,agents}/ across ~/.opencode and ~/.config/opencode (fallback dir wins)", async () => {
    const { bundle, warnings } = await opencode.exportBundle(path.join(FIXTURES, "opencode-home"));
    expect(bundle.agents.map((a) => a.name)).toEqual([
      "build",
      "legacy-helper",
      "reviewer",
      "team/planner",
    ]);
    const raw = await fs.readFile(
      path.join(FIXTURES, "opencode-home/.opencode/agent/reviewer.md"),
      "utf8",
    );
    expect(bundle.agents.find((a) => a.name === "reviewer")!.content).toBe(raw);
    expect(warnings).toContain(
      "agents:reviewer: .config/opencode/agents copy shadowed by the .opencode/agent version (opencode keeps one agent per name); the .opencode/agent version is exported",
    );
  });

  it("opencode exports {mode,modes}/*.md primary modes into the agents layer (flat, mode beats agent)", async () => {
    const { bundle, warnings } = await opencode.exportBundle(path.join(FIXTURES, "opencode-home"));
    const build = await fs.readFile(
      path.join(FIXTURES, "opencode-home/.opencode/modes/build.md"),
      "utf8",
    );
    expect(bundle.agents.find((a) => a.name === "build")!.content).toBe(build);
    expect(bundle.agents.some((a) => a.name.includes("deep"))).toBe(false);
    const legacy = await fs.readFile(
      path.join(FIXTURES, "opencode-home/.config/opencode/mode/legacy-helper.md"),
      "utf8",
    );
    expect(bundle.agents.find((a) => a.name === "legacy-helper")!.content).toBe(legacy);
    expect(warnings).toContain(
      'agents:build: .opencode/modes entry is an opencode primary mode (loaded with mode: "primary"); exported as a regular agent',
    );
    expect(warnings).toContain(
      "agents:legacy-helper: .config/opencode/agent copy shadowed by the .config/opencode/mode version (opencode keeps one agent per name); the .config/opencode/mode version is exported",
    );
  });

  it("opencode exports inline agent/command/mode entries from opencode.json(c)", async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), "am-oc-inline-"));
    await fs.mkdir(path.join(home, ".config/opencode/agents"), { recursive: true });
    await fs.mkdir(path.join(home, ".opencode/modes"), { recursive: true });
    await fs.writeFile(path.join(home, ".config/opencode/agents/helper.md"), "md helper\n");
    await fs.writeFile(path.join(home, ".opencode/modes/build.md"), "md build mode\n");
    await fs.writeFile(
      path.join(home, ".config/opencode/opencode.json"),
      JSON.stringify({
        agent: {
          helper: { description: "config helper", prompt: "config helper prompt" },
          disabled: { disable: true, prompt: "never" },
        },
        command: {
          ship: { template: "ship it {env:USER}", description: "ship" },
          broken: { description: "no template" },
        },
        mode: { build: { prompt: "inline build mode" } },
      }),
    );
    await fs.writeFile(
      path.join(home, ".opencode/opencode.jsonc"),
      '{\n  // fallback dir config\n  agent: { helper: { prompt: "fallback helper" } },\n}\n',
    );
    const { bundle, warnings } = await opencode.exportBundle(home);

    // Inline mode entries merge last and win over the markdown mode file.
    expect(bundle.agents.find((a) => a.name === "build")!.content).toBe("inline build mode\n");
    expect(warnings).toContain(
      "agents:build: defined inline under the mode key of .config/opencode/opencode.json; exported as a markdown agent with synthesized frontmatter",
    );
    expect(warnings).toContain(
      'agents:build: .config/opencode/opencode.json entry is an opencode primary mode (loaded with mode: "primary"); exported as a regular agent',
    );
    expect(warnings).toContain(
      "agents:build: .opencode/modes copy shadowed by the .config/opencode/opencode.json version (opencode keeps one agent per name); the .config/opencode/opencode.json version is exported",
    );

    // The ~/.opencode inline agent merges after the ~/.config markdown agent.
    expect(bundle.agents.find((a) => a.name === "helper")!.content).toBe("fallback helper\n");
    expect(warnings).toContain(
      "agents:helper: defined inline under the agent key of .opencode/opencode.jsonc; exported as a markdown agent with synthesized frontmatter",
    );
    expect(warnings).toContain(
      "agents:helper: .config/opencode/agents copy shadowed by the .opencode/opencode.jsonc version (opencode keeps one agent per name); the .opencode/opencode.jsonc version is exported",
    );

    expect(bundle.agents.some((a) => a.name === "disabled")).toBe(false);
    expect(warnings).toContain(
      "agents:disabled: inline agent entry in .config/opencode/opencode.json has disable: true; skipped",
    );

    expect(bundle.commands.map((c) => c.name)).toEqual(["ship"]);
    expect(bundle.commands[0]!.content).toBe("---\ndescription: ship\n---\n\nship it {env:USER}\n");
    expect(warnings).toContain(
      "commands:ship: defined inline under the command key of .config/opencode/opencode.json; exported as a markdown command with synthesized frontmatter",
    );
    expect(warnings).toContain(
      "commands:ship: contains {file:...}/{env:...} placeholders that opencode substitutes at load time relative to .config/opencode/opencode.json; copied as-is",
    );
    expect(warnings).toContain(
      "commands:broken: inline command entry in .config/opencode/opencode.json has no string template (required by opencode); skipped",
    );
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
    bundle.agents = [
      { name: "reviewer", content: "---\ntools: [read]\n---\n\nReview.\n" },
      { name: "team/planner", content: "Plan.\n" },
    ];
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
