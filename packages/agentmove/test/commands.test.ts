import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { claudeCode } from "../src/adapters/claude-code.js";
import { cursor } from "../src/adapters/cursor.js";
import { codex } from "../src/adapters/codex.js";
import { copilot } from "../src/adapters/copilot.js";
import { opencode } from "../src/adapters/opencode.js";
import { qwen } from "../src/adapters/qwen.js";
import { windsurf } from "../src/adapters/windsurf.js";
import { amazonq } from "../src/adapters/amazonq.js";
import { kiro } from "../src/adapters/kiro.js";
import { codebuddy } from "../src/adapters/codebuddy.js";
import { droid } from "../src/adapters/droid.js";
import { qoder } from "../src/adapters/qoder.js";
import { roo } from "../src/adapters/roo.js";
import { kilo } from "../src/adapters/kilo.js";
import { cline } from "../src/adapters/cline.js";
import { auggie } from "../src/adapters/auggie.js";
import { nanocoder } from "../src/adapters/nanocoder.js";
import { continueAdapter } from "../src/adapters/continue.js";
import { vscode } from "../src/adapters/vscode.js";
import { gemini, geminiCommandToToml } from "../src/adapters/gemini.js";
import { crush } from "../src/adapters/crush.js";
import { cortex } from "../src/adapters/cortex.js";
import { goose, gooseCommandToRecipe } from "../src/adapters/goose.js";
import { parse as parseYaml } from "yaml";
import { trae } from "../src/adapters/trae.js";
import { parse as parseToml } from "smol-toml";
import { getProjectAdapter } from "../src/project.js";
import { emptyBundle, filterBundle } from "../src/model.js";
import { readBundle, writeBundle } from "../src/bundle.js";
import { diffBundles } from "../src/diff.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("custom commands layer", () => {
  it("claude-code exports ~/.claude/commands recursively, byte-faithfully", async () => {
    const { bundle } = await claudeCode.exportBundle(path.join(FIXTURES, "claude-home"));
    expect(bundle.commands.map((c) => c.name)).toEqual(["deploy", "git/commit"]);
    const raw = await fs.readFile(
      path.join(FIXTURES, "claude-home/.claude/commands/deploy.md"),
      "utf8",
    );
    expect(bundle.commands.find((c) => c.name === "deploy")!.content).toBe(raw);
    const nested = await fs.readFile(
      path.join(FIXTURES, "claude-home/.claude/commands/git/commit.md"),
      "utf8",
    );
    expect(bundle.commands.find((c) => c.name === "git/commit")!.content).toBe(nested);
  });

  it("cursor exports ~/.cursor/commands/*.md byte-faithfully", async () => {
    const { bundle } = await cursor.exportBundle(path.join(FIXTURES, "cursor-home"));
    expect(bundle.commands.map((c) => c.name)).toEqual(["address-comments"]);
    const raw = await fs.readFile(
      path.join(FIXTURES, "cursor-home/.cursor/commands/address-comments.md"),
      "utf8",
    );
    expect(bundle.commands[0]!.content).toBe(raw);
  });

  it("codex exports ~/.codex/prompts/*.md byte-faithfully", async () => {
    const { bundle } = await codex.exportBundle(path.join(FIXTURES, "codex-home"));
    expect(bundle.commands.map((c) => c.name)).toEqual(["fix-issue"]);
    const raw = await fs.readFile(
      path.join(FIXTURES, "codex-home/.codex/prompts/fix-issue.md"),
      "utf8",
    );
    expect(bundle.commands[0]!.content).toBe(raw);
  });

  it("windsurf exports ~/.codeium/windsurf/global_workflows/*.md byte-faithfully", async () => {
    const { bundle } = await windsurf.exportBundle(path.join(FIXTURES, "windsurf-home"));
    expect(bundle.commands.map((c) => c.name)).toEqual(["deploy"]);
    const raw = await fs.readFile(
      path.join(FIXTURES, "windsurf-home/.codeium/windsurf/global_workflows/deploy.md"),
      "utf8",
    );
    expect(bundle.commands[0]!.content).toBe(raw);
  });

  it("amazonq exports ~/.aws/amazonq/prompts/*.md byte-faithfully", async () => {
    const { bundle } = await amazonq.exportBundle(path.join(FIXTURES, "amazonq-home"));
    expect(bundle.commands.map((c) => c.name)).toEqual(["create-diagram"]);
    const raw = await fs.readFile(
      path.join(FIXTURES, "amazonq-home/.aws/amazonq/prompts/create-diagram.md"),
      "utf8",
    );
    expect(bundle.commands[0]!.content).toBe(raw);
  });

  it("kiro exports ~/.kiro/prompts/*.md byte-faithfully and plans them flat", async () => {
    const { bundle } = await kiro.exportBundle(path.join(FIXTURES, "kiro-home"));
    expect(bundle.commands.map((c) => c.name)).toEqual(["code-review"]);
    const raw = await fs.readFile(
      path.join(FIXTURES, "kiro-home/.kiro/prompts/code-review.md"),
      "utf8",
    );
    expect(bundle.commands[0]!.content).toBe(raw);

    const incoming = emptyBundle();
    incoming.commands = [
      { name: "deploy", content: "Deploy.\n" },
      { name: "git/commit", content: "Commit.\n" },
    ];
    const { files, warnings } = await kiro.planImport(incoming, "/nonexistent-home", {});
    expect(files.some((f) => f.path === ".kiro/prompts/deploy.md")).toBe(true);
    expect(files.some((f) => f.path === ".kiro/prompts/git-commit.md")).toBe(true);
    expect(warnings.some((w) => w.includes("imported as git-commit"))).toBe(true);
    expect(warnings.some((w) => w.includes("@name"))).toBe(true);
  });

  it("windsurf plans commands flat, flattening nested names and warning on oversize workflows", async () => {
    const bundle = emptyBundle();
    bundle.commands = [
      { name: "git/commit", content: "Commit.\n" },
      { name: "huge", content: "x".repeat(12001) },
    ];
    const { files, warnings } = await windsurf.planImport(bundle, "/nonexistent-home", {});
    expect(
      files.some((f) => f.path === ".codeium/windsurf/global_workflows/git-commit.md"),
    ).toBe(true);
    expect(files.some((f) => f.path === ".codeium/windsurf/global_workflows/huge.md")).toBe(true);
    expect(warnings.some((w) => w.includes("imported as git-commit"))).toBe(true);
    expect(warnings.some((w) => w.includes("12000-character workflow limit"))).toBe(true);
  });

  it("amazonq plans commands flat into ~/.aws/amazonq/prompts with a warning", async () => {
    const bundle = emptyBundle();
    bundle.commands = [
      { name: "deploy", content: "Deploy.\n" },
      { name: "git/commit", content: "Commit.\n" },
    ];
    const { files, warnings } = await amazonq.planImport(bundle, "/nonexistent-home", {});
    expect(files.some((f) => f.path === ".aws/amazonq/prompts/deploy.md")).toBe(true);
    expect(files.some((f) => f.path === ".aws/amazonq/prompts/git-commit.md")).toBe(true);
    expect(warnings.some((w) => w.includes("imported as git-commit"))).toBe(true);
    expect(warnings.some((w) => w.includes("@name"))).toBe(true);
  });

  it("project scope: windsurf workflows and amazonq prompts round-trip", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-cmd-proj3-"));
    await fs.mkdir(path.join(dir, ".windsurf/workflows"), { recursive: true });
    await fs.writeFile(path.join(dir, ".windsurf/workflows/review.md"), "Review.\n");
    await fs.mkdir(path.join(dir, ".amazonq/prompts"), { recursive: true });
    await fs.writeFile(path.join(dir, ".amazonq/prompts/analyze.md"), "Analyze.\n");
    const ws = await getProjectAdapter("windsurf").exportProject(dir);
    expect(ws.bundle.commands.map((c) => c.name)).toEqual(["review"]);
    const aq = await getProjectAdapter("amazonq").exportProject(dir);
    expect(aq.bundle.commands.map((c) => c.name)).toEqual(["analyze"]);
    const wsFiles = (await getProjectAdapter("windsurf").planImport(ws.bundle, "/p", {})).files;
    expect(wsFiles.some((f) => f.path === ".windsurf/workflows/review.md")).toBe(true);
    const aqFiles = (await getProjectAdapter("amazonq").planImport(aq.bundle, "/p", {})).files;
    expect(aqFiles.some((f) => f.path === ".amazonq/prompts/analyze.md")).toBe(true);
  });

  it("codebuddy exports ~/.codebuddy/commands recursively, byte-faithfully", async () => {
    const { bundle } = await codebuddy.exportBundle(path.join(FIXTURES, "codebuddy-home"));
    expect(bundle.commands.map((c) => c.name)).toEqual(["team/deploy"]);
    const raw = await fs.readFile(
      path.join(FIXTURES, "codebuddy-home/.codebuddy/commands/team/deploy.md"),
      "utf8",
    );
    expect(bundle.commands[0]!.content).toBe(raw);
  });

  it("droid exports ~/.factory/commands markdown and warns on script commands", async () => {
    const { bundle, warnings } = await droid.exportBundle(path.join(FIXTURES, "droid-home"));
    expect(bundle.commands.map((c) => c.name)).toEqual(["review"]);
    const raw = await fs.readFile(
      path.join(FIXTURES, "droid-home/.factory/commands/review.md"),
      "utf8",
    );
    expect(bundle.commands[0]!.content).toBe(raw);
    expect(
      warnings.some(
        (w) => w.includes("commands:cleanup.sh") && w.includes("script commands are not migrated"),
      ),
    ).toBe(true);
  });

  it("codebuddy plans commands into ~/.codebuddy/commands (nested names kept) with a warning", async () => {
    const bundle = emptyBundle();
    bundle.commands = [
      { name: "deploy", content: "Deploy.\n" },
      { name: "team/deploy", content: "Team deploy.\n" },
    ];
    const { files, warnings } = await codebuddy.planImport(bundle, "/nonexistent-home", {});
    expect(files.some((f) => f.path === ".codebuddy/commands/deploy.md")).toBe(true);
    expect(files.some((f) => f.path === ".codebuddy/commands/team/deploy.md")).toBe(true);
    expect(warnings.some((w) => w.includes("$ARGUMENTS"))).toBe(true);
  });

  it("droid plans commands into ~/.factory/commands (nested names kept) with a warning", async () => {
    const bundle = emptyBundle();
    bundle.commands = [
      { name: "review", content: "Review.\n" },
      { name: "git/commit", content: "Commit.\n" },
    ];
    const { files, warnings } = await droid.planImport(bundle, "/nonexistent-home", {});
    expect(files.some((f) => f.path === ".factory/commands/review.md")).toBe(true);
    expect(files.some((f) => f.path === ".factory/commands/git/commit.md")).toBe(true);
    expect(warnings.some((w) => w.includes("slugs command filenames"))).toBe(true);
  });

  it("project scope: codebuddy and droid commands round-trip", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-cmd-proj4-"));
    await fs.mkdir(path.join(dir, ".codebuddy/commands/team"), { recursive: true });
    await fs.writeFile(path.join(dir, ".codebuddy/commands/team/deploy.md"), "Deploy.\n");
    await fs.mkdir(path.join(dir, ".factory/commands"), { recursive: true });
    await fs.writeFile(path.join(dir, ".factory/commands/review.md"), "Review.\n");
    const cb = await getProjectAdapter("codebuddy").exportProject(dir);
    expect(cb.bundle.commands.map((c) => c.name)).toEqual(["team/deploy"]);
    const dr = await getProjectAdapter("droid").exportProject(dir);
    expect(dr.bundle.commands.map((c) => c.name)).toEqual(["review"]);
    const cbFiles = (await getProjectAdapter("codebuddy").planImport(cb.bundle, "/p", {})).files;
    expect(cbFiles.some((f) => f.path === ".codebuddy/commands/team/deploy.md")).toBe(true);
    const drFiles = (await getProjectAdapter("droid").planImport(dr.bundle, "/p", {})).files;
    expect(drFiles.some((f) => f.path === ".factory/commands/review.md")).toBe(true);
  });

  it("qoder exports ~/.qoder/commands recursively, byte-faithfully", async () => {
    const { bundle } = await qoder.exportBundle(path.join(FIXTURES, "qoder-home"));
    expect(bundle.commands.map((c) => c.name)).toEqual(["git/commit"]);
    const raw = await fs.readFile(
      path.join(FIXTURES, "qoder-home/.qoder/commands/git/commit.md"),
      "utf8",
    );
    expect(bundle.commands[0]!.content).toBe(raw);
  });

  it("roo exports ~/.roo/commands/*.md byte-faithfully", async () => {
    const { bundle } = await roo.exportBundle(path.join(FIXTURES, "roo-home"));
    expect(bundle.commands.map((c) => c.name)).toEqual(["review"]);
    const raw = await fs.readFile(
      path.join(FIXTURES, "roo-home/.roo/commands/review.md"),
      "utf8",
    );
    expect(bundle.commands[0]!.content).toBe(raw);
  });

  it("qoder plans commands into ~/.qoder/commands (nested names kept) with a warning", async () => {
    const bundle = emptyBundle();
    bundle.commands = [
      { name: "deploy", content: "Deploy.\n" },
      { name: "git/commit", content: "Commit.\n" },
    ];
    const { files, warnings } = await qoder.planImport(bundle, "/nonexistent-home", {});
    expect(files.some((f) => f.path === ".qoder/commands/deploy.md")).toBe(true);
    expect(files.some((f) => f.path === ".qoder/commands/git/commit.md")).toBe(true);
    expect(warnings.some((w) => w.includes("name/description"))).toBe(true);
  });

  it("roo plans commands flat into ~/.roo/commands with a warning", async () => {
    const bundle = emptyBundle();
    bundle.commands = [
      { name: "review", content: "Review.\n" },
      { name: "git/commit", content: "Commit.\n" },
    ];
    const { files, warnings } = await roo.planImport(bundle, "/nonexistent-home", {});
    expect(files.some((f) => f.path === ".roo/commands/review.md")).toBe(true);
    expect(files.some((f) => f.path === ".roo/commands/git-commit.md")).toBe(true);
    expect(warnings.some((w) => w.includes("imported as git-commit"))).toBe(true);
    expect(warnings.some((w) => w.includes("argument-hint/mode"))).toBe(true);
  });

  it("project scope: qoder and roo commands round-trip", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-cmd-proj5-"));
    await fs.mkdir(path.join(dir, ".qoder/commands/git"), { recursive: true });
    await fs.writeFile(path.join(dir, ".qoder/commands/git/commit.md"), "Commit.\n");
    await fs.mkdir(path.join(dir, ".roo/commands"), { recursive: true });
    await fs.writeFile(path.join(dir, ".roo/commands/review.md"), "Review.\n");
    const qd = await getProjectAdapter("qoder").exportProject(dir);
    expect(qd.bundle.commands.map((c) => c.name)).toEqual(["git/commit"]);
    const ro = await getProjectAdapter("roo").exportProject(dir);
    expect(ro.bundle.commands.map((c) => c.name)).toEqual(["review"]);
    const qdFiles = (await getProjectAdapter("qoder").planImport(qd.bundle, "/p", {})).files;
    expect(qdFiles.some((f) => f.path === ".qoder/commands/git/commit.md")).toBe(true);
    const roFiles = (await getProjectAdapter("roo").planImport(ro.bundle, "/p", {})).files;
    expect(roFiles.some((f) => f.path === ".roo/commands/review.md")).toBe(true);
  });

  it("claude-code plans commands into ~/.claude/commands (nested names kept) with a warning", async () => {
    const bundle = emptyBundle();
    bundle.commands = [
      { name: "deploy", content: "Deploy.\n" },
      { name: "git/commit", content: "Commit.\n" },
    ];
    const { files, warnings } = await claudeCode.planImport(bundle, "/nonexistent-home", {});
    expect(files.some((f) => f.path === ".claude/commands/deploy.md")).toBe(true);
    expect(files.some((f) => f.path === ".claude/commands/git/commit.md")).toBe(true);
    expect(warnings.some((w) => w.startsWith("commands:"))).toBe(true);
  });

  it("cursor plans commands flat, flattening nested names with a warning", async () => {
    const bundle = emptyBundle();
    bundle.commands = [
      { name: "deploy", content: "Deploy.\n" },
      { name: "git/commit", content: "Commit.\n" },
    ];
    const { files, warnings } = await cursor.planImport(bundle, "/nonexistent-home", {});
    expect(files.some((f) => f.path === ".cursor/commands/deploy.md")).toBe(true);
    expect(files.some((f) => f.path === ".cursor/commands/git-commit.md")).toBe(true);
    expect(warnings.some((w) => w.includes("imported as git-commit"))).toBe(true);
  });

  it("codex plans commands into ~/.codex/prompts with a deprecation note", async () => {
    const bundle = emptyBundle();
    bundle.commands = [{ name: "fix-issue", content: "Fix.\n" }];
    const { files, warnings } = await codex.planImport(bundle, "/nonexistent-home", {});
    expect(files.some((f) => f.path === ".codex/prompts/fix-issue.md")).toBe(true);
    expect(warnings.some((w) => w.includes("deprecated in favor of skills"))).toBe(true);
  });

  it("opencode exports ~/.config/opencode/commands recursively, byte-faithfully", async () => {
    const { bundle } = await opencode.exportBundle(path.join(FIXTURES, "opencode-home"));
    expect(bundle.commands.map((c) => c.name)).toEqual(["team/review"]);
    const raw = await fs.readFile(
      path.join(FIXTURES, "opencode-home/.config/opencode/commands/team/review.md"),
      "utf8",
    );
    expect(bundle.commands[0]!.content).toBe(raw);
  });

  it("qwen exports ~/.qwen/commands markdown and warns on deprecated TOML files", async () => {
    const { bundle, warnings } = await qwen.exportBundle(path.join(FIXTURES, "qwen-home"));
    expect(bundle.commands.map((c) => c.name)).toEqual(["analyze"]);
    const raw = await fs.readFile(
      path.join(FIXTURES, "qwen-home/.qwen/commands/analyze.md"),
      "utf8",
    );
    expect(bundle.commands[0]!.content).toBe(raw);
    expect(warnings.some((w) => w.includes("commands:legacy") && w.includes("TOML"))).toBe(true);
  });

  it("opencode plans commands into ~/.config/opencode/commands (nested names kept)", async () => {
    const bundle = emptyBundle();
    bundle.commands = [
      { name: "deploy", content: "Deploy.\n" },
      { name: "team/review", content: "Review.\n" },
    ];
    const { files, warnings } = await opencode.planImport(bundle, "/nonexistent-home", {});
    expect(files.some((f) => f.path === ".config/opencode/commands/deploy.md")).toBe(true);
    expect(files.some((f) => f.path === ".config/opencode/commands/team/review.md")).toBe(true);
    expect(warnings.some((w) => w.startsWith("commands:"))).toBe(true);
  });

  it("qwen plans commands into ~/.qwen/commands (nested names kept) with a warning", async () => {
    const bundle = emptyBundle();
    bundle.commands = [{ name: "git/commit", content: "Commit.\n" }];
    const { files, warnings } = await qwen.planImport(bundle, "/nonexistent-home", {});
    expect(files.some((f) => f.path === ".qwen/commands/git/commit.md")).toBe(true);
    expect(warnings.some((w) => w.startsWith("commands:"))).toBe(true);
  });

  it("project scope: opencode and qwen commands round-trip", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-cmd-proj2-"));
    await fs.mkdir(path.join(dir, ".opencode/commands/team"), { recursive: true });
    await fs.writeFile(path.join(dir, ".opencode/commands/team/review.md"), "Review.\n");
    await fs.mkdir(path.join(dir, ".qwen/commands"), { recursive: true });
    await fs.writeFile(path.join(dir, ".qwen/commands/analyze.md"), "Analyze.\n");
    const oc = await getProjectAdapter("opencode").exportProject(dir);
    expect(oc.bundle.commands.map((c) => c.name)).toEqual(["team/review"]);
    const qw = await getProjectAdapter("qwen").exportProject(dir);
    expect(qw.bundle.commands.map((c) => c.name)).toEqual(["analyze"]);
    const ocFiles = (await getProjectAdapter("opencode").planImport(oc.bundle, "/p", {})).files;
    expect(ocFiles.some((f) => f.path === ".opencode/commands/team/review.md")).toBe(true);
    const qwFiles = (await getProjectAdapter("qwen").planImport(qw.bundle, "/p", {})).files;
    expect(qwFiles.some((f) => f.path === ".qwen/commands/analyze.md")).toBe(true);
  });

  it("skips flattened commands whose names collide, with a warning", async () => {
    const bundle = emptyBundle();
    bundle.commands = [
      { name: "git-commit", content: "A.\n" },
      { name: "git/commit", content: "B.\n" },
    ];
    const { files, warnings } = await cursor.planImport(bundle, "/nonexistent-home", {});
    expect(files.filter((f) => f.path === ".cursor/commands/git-commit.md")).toHaveLength(1);
    expect(warnings.some((w) => w.includes("collides"))).toBe(true);
  });

  it("does not plan or warn when the bundle has no commands", async () => {
    const { files, warnings } = await cursor.planImport(emptyBundle(), "/nonexistent-home", {});
    expect(files.some((f) => f.path.startsWith(".cursor/commands/"))).toBe(false);
    expect(warnings.some((w) => w.startsWith("commands:"))).toBe(false);
  });

  it("clients without a commands directory leave commands to the CLI skip warning", async () => {
    expect(copilot.supportsCommands ?? false).toBe(false);
  });

  it("project scope: claude-code .claude/commands (nested), cursor .cursor/commands (flat)", async () => {
    const bundle = emptyBundle();
    bundle.commands = [{ name: "git/commit", content: "Commit.\n" }];
    const claudeFiles = (await getProjectAdapter("claude-code").planImport(bundle, "/p", {})).files;
    expect(claudeFiles.some((f) => f.path === ".claude/commands/git/commit.md")).toBe(true);
    const cursorFiles = (await getProjectAdapter("cursor").planImport(bundle, "/p", {})).files;
    expect(cursorFiles.some((f) => f.path === ".cursor/commands/git-commit.md")).toBe(true);
  });

  it("project scope: claude-code and cursor export project commands", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-cmd-proj-"));
    await fs.mkdir(path.join(dir, ".claude/commands/git"), { recursive: true });
    await fs.writeFile(path.join(dir, ".claude/commands/git/commit.md"), "Commit.\n");
    await fs.mkdir(path.join(dir, ".cursor/commands"), { recursive: true });
    await fs.writeFile(path.join(dir, ".cursor/commands/review.md"), "Review.\n");
    const claude = await getProjectAdapter("claude-code").exportProject(dir);
    expect(claude.bundle.commands.map((c) => c.name)).toEqual(["git/commit"]);
    const cur = await getProjectAdapter("cursor").exportProject(dir);
    expect(cur.bundle.commands.map((c) => c.name)).toEqual(["review"]);
  });

  it("kilo exports ~/.config/kilo/commands plus legacy workflows (new wins)", async () => {
    const { bundle, warnings } = await kilo.exportBundle(path.join(FIXTURES, "kilo-home"));
    expect(bundle.commands.map((c) => c.name)).toEqual(["release", "submit-pr"]);
    const raw = await fs.readFile(
      path.join(FIXTURES, "kilo-home/.config/kilo/commands/submit-pr.md"),
      "utf8",
    );
    expect(bundle.commands.find((c) => c.name === "submit-pr")!.content).toBe(raw);
    const legacy = await fs.readFile(
      path.join(FIXTURES, "kilo-home/.kilocode/workflows/release.md"),
      "utf8",
    );
    expect(bundle.commands.find((c) => c.name === "release")!.content).toBe(legacy);
    expect(warnings.some((w) => w.includes("legacy ~/.kilocode/workflows/"))).toBe(true);
  });

  it("kilo plans commands flat into ~/.config/kilo/commands with a warning", async () => {
    const bundle = emptyBundle();
    bundle.commands = [
      { name: "submit-pr", content: "Submit.\n" },
      { name: "git/commit", content: "Commit.\n" },
    ];
    const { files, warnings } = await kilo.planImport(bundle, "/nonexistent-home", {});
    expect(files.some((f) => f.path === ".config/kilo/commands/submit-pr.md")).toBe(true);
    expect(files.some((f) => f.path === ".config/kilo/commands/git-commit.md")).toBe(true);
    expect(warnings.some((w) => w.includes("imported as git-commit"))).toBe(true);
    expect(warnings.some((w) => w.includes("description/agent/model/subtask"))).toBe(true);
  });

  it("cline exports ~/Documents/Cline/Workflows/*.md, warning on non-markdown files", async () => {
    const { bundle, warnings } = await cline.exportBundle(path.join(FIXTURES, "cline-home"));
    expect(bundle.commands.map((c) => c.name)).toEqual(["deploy"]);
    const raw = await fs.readFile(
      path.join(FIXTURES, "cline-home/Documents/Cline/Workflows/deploy.md"),
      "utf8",
    );
    expect(bundle.commands[0]!.content).toBe(raw);
    expect(
      warnings.some((w) => w.includes("commands:release.txt") && w.includes("not migrated")),
    ).toBe(true);
  });

  it("cline plans commands flat into ~/Documents/Cline/Workflows with a warning", async () => {
    const bundle = emptyBundle();
    bundle.commands = [
      { name: "deploy", content: "Deploy.\n" },
      { name: "git/commit", content: "Commit.\n" },
    ];
    const { files, warnings } = await cline.planImport(bundle, "/nonexistent-home", {});
    expect(files.some((f) => f.path === "Documents/Cline/Workflows/deploy.md")).toBe(true);
    expect(files.some((f) => f.path === "Documents/Cline/Workflows/git-commit.md")).toBe(true);
    expect(warnings.some((w) => w.includes("imported as git-commit"))).toBe(true);
    expect(warnings.some((w) => w.includes("toggles are app-managed"))).toBe(true);
  });

  it("project scope: kilo and cline commands round-trip", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-cmd-proj6-"));
    await fs.mkdir(path.join(dir, ".kilo/commands"), { recursive: true });
    await fs.writeFile(path.join(dir, ".kilo/commands/submit-pr.md"), "Submit.\n");
    await fs.mkdir(path.join(dir, ".kilocode/workflows"), { recursive: true });
    await fs.writeFile(path.join(dir, ".kilocode/workflows/release.md"), "Release.\n");
    await fs.mkdir(path.join(dir, ".clinerules/workflows"), { recursive: true });
    await fs.writeFile(path.join(dir, ".clinerules/workflows/deploy.md"), "Deploy.\n");
    const ki = await getProjectAdapter("kilo").exportProject(dir);
    expect(ki.bundle.commands.map((c) => c.name)).toEqual(["release", "submit-pr"]);
    expect(ki.warnings.some((w) => w.includes("legacy .kilocode/workflows/"))).toBe(true);
    const cl = await getProjectAdapter("cline").exportProject(dir);
    expect(cl.bundle.commands.map((c) => c.name)).toEqual(["deploy"]);
    const kiFiles = (await getProjectAdapter("kilo").planImport(ki.bundle, "/p", {})).files;
    expect(kiFiles.some((f) => f.path === ".kilo/commands/submit-pr.md")).toBe(true);
    expect(kiFiles.some((f) => f.path === ".kilo/commands/release.md")).toBe(true);
    const clFiles = (await getProjectAdapter("cline").planImport(cl.bundle, "/p", {})).files;
    expect(clFiles.some((f) => f.path === ".clinerules/workflows/deploy.md")).toBe(true);
  });

  it("auggie exports ~/.augment/commands recursively, byte-faithfully", async () => {
    const { bundle } = await auggie.exportBundle(path.join(FIXTURES, "auggie-home"));
    expect(bundle.commands.map((c) => c.name)).toEqual(["frontend/component", "optimize"]);
    const raw = await fs.readFile(
      path.join(FIXTURES, "auggie-home/.augment/commands/optimize.md"),
      "utf8",
    );
    expect(bundle.commands.find((c) => c.name === "optimize")!.content).toBe(raw);
  });

  it("auggie plans commands into ~/.augment/commands (nested names kept) with a warning", async () => {
    const bundle = emptyBundle();
    bundle.commands = [
      { name: "optimize", content: "Optimize.\n" },
      { name: "frontend/component", content: "Component.\n" },
    ];
    const { files, warnings } = await auggie.planImport(bundle, "/nonexistent-home", {});
    expect(files.some((f) => f.path === ".augment/commands/optimize.md")).toBe(true);
    expect(files.some((f) => f.path === ".augment/commands/frontend/component.md")).toBe(true);
    expect(warnings.some((w) => w.includes("description/argument-hint"))).toBe(true);
  });

  it("nanocoder exports commands with namespaces and directory-as-command bundles", async () => {
    const { bundle, warnings } = await nanocoder.exportBundle(
      path.join(FIXTURES, "nanocoder-home"),
    );
    expect(bundle.commands.map((c) => c.name)).toEqual([
      "deploy",
      "git/commit",
      "pr-reviewer/review",
      "pr-reviewer/status",
      "solo",
      "test",
    ]);
    const raw = await fs.readFile(
      path.join(FIXTURES, "nanocoder-home/.config/nanocoder/commands/test.md"),
      "utf8",
    );
    expect(bundle.commands.find((c) => c.name === "test")!.content).toBe(raw);
    const dirCmd = await fs.readFile(
      path.join(FIXTURES, "nanocoder-home/.config/nanocoder/commands/deploy/deploy.md"),
      "utf8",
    );
    expect(bundle.commands.find((c) => c.name === "deploy")!.content).toBe(dirCmd);
    expect(
      warnings.some(
        (w) => w.includes("commands:deploy") && w.includes("resources/ files are client-specific"),
      ),
    ).toBe(true);
  });

  it("nanocoder plans commands into ~/.config/nanocoder/commands (nested names kept) with a warning", async () => {
    const bundle = emptyBundle();
    bundle.commands = [
      { name: "test", content: "Test.\n" },
      { name: "git/commit", content: "Commit.\n" },
    ];
    const { files, warnings } = await nanocoder.planImport(bundle, "/nonexistent-home", {});
    expect(files.some((f) => f.path === ".config/nanocoder/commands/test.md")).toBe(true);
    expect(files.some((f) => f.path === ".config/nanocoder/commands/git/commit.md")).toBe(true);
    expect(warnings.some((w) => w.includes("description/aliases/triggers/tags"))).toBe(true);
  });

  it("project scope: auggie and nanocoder commands round-trip", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-cmd-proj7-"));
    await fs.mkdir(path.join(dir, ".augment/commands/frontend"), { recursive: true });
    await fs.writeFile(path.join(dir, ".augment/commands/optimize.md"), "Optimize.\n");
    await fs.writeFile(path.join(dir, ".augment/commands/frontend/component.md"), "Comp.\n");
    await fs.mkdir(path.join(dir, ".nanocoder/commands/git"), { recursive: true });
    await fs.writeFile(path.join(dir, ".nanocoder/commands/test.md"), "Test.\n");
    await fs.writeFile(path.join(dir, ".nanocoder/commands/git/commit.md"), "Commit.\n");
    const au = await getProjectAdapter("auggie").exportProject(dir);
    expect(au.bundle.commands.map((c) => c.name)).toEqual(["frontend/component", "optimize"]);
    const na = await getProjectAdapter("nanocoder").exportProject(dir);
    expect(na.bundle.commands.map((c) => c.name)).toEqual(["git/commit", "test"]);
    const auFiles = (await getProjectAdapter("auggie").planImport(au.bundle, "/p", {})).files;
    expect(auFiles.some((f) => f.path === ".augment/commands/frontend/component.md")).toBe(true);
    const naFiles = (await getProjectAdapter("nanocoder").planImport(na.bundle, "/p", {})).files;
    expect(naFiles.some((f) => f.path === ".nanocoder/commands/git/commit.md")).toBe(true);
  });

  it("continue exports ~/.continue/prompts recursively, byte-faithfully (legacy .prompt warned)", async () => {
    const { bundle, warnings } = await continueAdapter.exportBundle(
      path.join(FIXTURES, "continue-home"),
    );
    expect(bundle.commands.map((c) => c.name)).toEqual(["explain", "team/review"]);
    const raw = await fs.readFile(
      path.join(FIXTURES, "continue-home/.continue/prompts/explain.md"),
      "utf8",
    );
    expect(bundle.commands.find((c) => c.name === "explain")!.content).toBe(raw);
    expect(
      warnings.some(
        (w) => w.includes("commands:legacy.prompt") && w.includes("legacy v1 .prompt files"),
      ),
    ).toBe(true);
  });

  it("continue plans commands into ~/.continue/prompts (nested names kept) with a warning", async () => {
    const bundle = emptyBundle();
    bundle.commands = [
      { name: "explain", content: "Explain.\n" },
      { name: "team/review", content: "Review.\n" },
    ];
    const { files, warnings } = await continueAdapter.planImport(bundle, "/nonexistent-home", {});
    expect(files.some((f) => f.path === ".continue/prompts/explain.md")).toBe(true);
    expect(files.some((f) => f.path === ".continue/prompts/team/review.md")).toBe(true);
    expect(warnings.some((w) => w.includes("invokable: true"))).toBe(true);
  });

  it("vscode exports only *.prompt.md from the User/prompts folder, byte-faithfully", async () => {
    const { bundle } = await vscode.exportBundle(path.join(FIXTURES, "vscode-home"));
    expect(bundle.commands.map((c) => c.name)).toEqual(["gen-tests"]);
    const raw = await fs.readFile(
      path.join(FIXTURES, "vscode-home/.config/Code/User/prompts/gen-tests.prompt.md"),
      "utf8",
    );
    expect(bundle.commands[0]!.content).toBe(raw);
  });

  it("vscode plans flat <name>.prompt.md files, flattening nested names with a warning", async () => {
    const bundle = emptyBundle();
    bundle.commands = [
      { name: "gen-tests", content: "Tests.\n" },
      { name: "git/commit", content: "Commit.\n" },
    ];
    const { files, warnings } = await vscode.planImport(bundle, "/nonexistent-home", {});
    expect(
      files.some((f) => f.path.endsWith("Code/User/prompts/gen-tests.prompt.md")),
    ).toBe(true);
    expect(
      files.some((f) => f.path.endsWith("Code/User/prompts/git-commit.prompt.md")),
    ).toBe(true);
    expect(warnings.some((w) => w.includes("imported as git-commit"))).toBe(true);
    expect(warnings.some((w) => w.includes("Settings Sync"))).toBe(true);
  });

  it("project scope: continue and vscode commands round-trip", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-cmd-proj8-"));
    await fs.mkdir(path.join(dir, ".continue/prompts/team"), { recursive: true });
    await fs.writeFile(path.join(dir, ".continue/prompts/explain.md"), "Explain.\n");
    await fs.writeFile(path.join(dir, ".continue/prompts/team/review.md"), "Review.\n");
    await fs.mkdir(path.join(dir, ".github/prompts"), { recursive: true });
    await fs.writeFile(path.join(dir, ".github/prompts/gen-tests.prompt.md"), "Tests.\n");
    const co = await getProjectAdapter("continue").exportProject(dir);
    expect(co.bundle.commands.map((c) => c.name)).toEqual(["explain", "team/review"]);
    const vs = await getProjectAdapter("vscode").exportProject(dir);
    expect(vs.bundle.commands.map((c) => c.name)).toEqual(["gen-tests"]);
    const coFiles = (await getProjectAdapter("continue").planImport(co.bundle, "/p", {})).files;
    expect(coFiles.some((f) => f.path === ".continue/prompts/team/review.md")).toBe(true);
    const vsFiles = (await getProjectAdapter("vscode").planImport(vs.bundle, "/p", {})).files;
    expect(vsFiles.some((f) => f.path === ".github/prompts/gen-tests.prompt.md")).toBe(true);
  });

  it("gemini exports ~/.gemini/commands TOML files as markdown commands (nested names kept)", async () => {
    const { bundle, warnings } = await gemini.exportBundle(path.join(FIXTURES, "gemini-home"));
    expect(bundle.commands.map((c) => c.name)).toEqual(["changelog", "git/commit"]);
    const changelog = bundle.commands.find((c) => c.name === "changelog")!;
    expect(changelog.content.startsWith('---\ndescription: "Adds a new entry to the CHANGELOG file."\n---\n')).toBe(true);
    expect(changelog.content).toContain("{{args}}");
    const commit = bundle.commands.find((c) => c.name === "git/commit")!;
    expect(commit.content.startsWith("---")).toBe(false);
    expect(commit.content).toContain("!{git diff --staged}");
    expect(
      warnings.some((w) => w.includes("commands:broken.toml") && w.includes("no prompt string field")),
    ).toBe(true);
    expect(warnings.some((w) => w.includes('TOML field "model"'))).toBe(true);
    expect(warnings.some((w) => w.includes("converted from gemini TOML"))).toBe(true);
  });

  it("gemini plans commands as TOML (frontmatter description lifted; prompt round-trips)", async () => {
    const bundle = emptyBundle();
    bundle.commands = [
      { name: "changelog", content: '---\ndescription: "Adds an entry."\n---\nUpdate CHANGELOG with {{args}}.\n' },
      { name: "git/commit", content: "Write a commit message.\n" },
      { name: "reviewer", content: "---\nmodel: fake\nargument-hint: file\n---\nReview.\n" },
    ];
    const { files, warnings } = await gemini.planImport(bundle, "/nonexistent-home", {});
    const changelog = files.find((f) => f.path === ".gemini/commands/changelog.toml")!;
    const parsed = parseToml(changelog.content) as { description: string; prompt: string };
    expect(parsed.description).toBe("Adds an entry.");
    expect(parsed.prompt).toBe("Update CHANGELOG with {{args}}.\n");
    expect(files.some((f) => f.path === ".gemini/commands/git/commit.toml")).toBe(true);
    const reviewer = parseToml(files.find((f) => f.path === ".gemini/commands/reviewer.toml")!.content) as {
      prompt: string;
    };
    expect(reviewer.prompt).toContain("model: fake");
    expect(
      warnings.some((w) => w.includes("commands:reviewer") && w.includes("kept verbatim inside prompt")),
    ).toBe(true);
    expect(warnings.some((w) => w.includes("markdown bodies were converted to the prompt field"))).toBe(true);
  });

  it("gemini\u2192gemini command round-trip preserves prompt and description", async () => {
    const { bundle } = await gemini.exportBundle(path.join(FIXTURES, "gemini-home"));
    const { files } = await gemini.planImport(bundle, "/nonexistent-home", {});
    for (const name of ["changelog", "git/commit"]) {
      const original = await fs.readFile(
        path.join(FIXTURES, `gemini-home/.gemini/commands/${name}.toml`),
        "utf8",
      );
      const written = files.find((f) => f.path === `.gemini/commands/${name}.toml`)!;
      expect(parseToml(written.content)).toEqual(parseToml(original));
    }
  });

  it("project scope: gemini .gemini/commands round-trips", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-cmd-proj9-"));
    await fs.mkdir(path.join(dir, ".gemini/commands/git"), { recursive: true });
    await fs.writeFile(
      path.join(dir, ".gemini/commands/git/fix.toml"),
      'description = "Fixes an issue."\nprompt = "Fix: {{args}}"\n',
    );
    const ex = await getProjectAdapter("gemini").exportProject(dir);
    expect(ex.bundle.commands.map((c) => c.name)).toEqual(["git/fix"]);
    const { files } = await getProjectAdapter("gemini").planImport(ex.bundle, "/p", {});
    const written = files.find((f) => f.path === ".gemini/commands/git/fix.toml")!;
    const parsed = parseToml(written.content) as { description: string; prompt: string };
    expect(parsed.description).toBe("Fixes an issue.");
    expect(parsed.prompt.trim()).toBe("Fix: {{args}}");
  });

  it("geminiCommandToToml keeps markdown without frontmatter verbatim as prompt", () => {
    const warnings: string[] = [];
    const toml = geminiCommandToToml({ name: "plain", content: "Just a prompt.\n" }, warnings);
    expect((parseToml(toml) as { prompt: string }).prompt).toBe("Just a prompt.\n");
    expect(warnings).toEqual([]);
  });

  it("crush exports both user command roots recursively (XDG wins on conflicts)", async () => {
    const { bundle, warnings } = await crush.exportBundle(path.join(FIXTURES, "crush-home"));
    expect(bundle.commands.map((c) => c.name)).toEqual(["deploy", "git/commit", "review-pr"]);
    const xdgRaw = await fs.readFile(
      path.join(FIXTURES, "crush-home/.config/crush/commands/review-pr.md"),
      "utf8",
    );
    expect(bundle.commands.find((c) => c.name === "review-pr")!.content).toBe(xdgRaw);
    const homeRaw = await fs.readFile(
      path.join(FIXTURES, "crush-home/.crush/commands/deploy.md"),
      "utf8",
    );
    expect(bundle.commands.find((c) => c.name === "deploy")!.content).toBe(homeRaw);
    expect(warnings.some((w) => w.includes("~/.crush/commands/ files exported"))).toBe(true);
  });

  it("crush plans nested commands into ~/.config/crush/commands only", async () => {
    const bundle = emptyBundle();
    bundle.commands = [
      { name: "git/commit", content: "Commit.\n" },
      { name: "review-pr", content: "Review $PR_NUMBER.\n" },
    ];
    const { files, warnings } = await crush.planImport(bundle, "/nonexistent-home", {});
    expect(files.some((f) => f.path === ".config/crush/commands/git/commit.md")).toBe(true);
    const written = files.find((f) => f.path === ".config/crush/commands/review-pr.md")!;
    expect(written.content).toBe("Review $PR_NUMBER.\n");
    expect(files.some((f) => f.path.startsWith(".crush/"))).toBe(false);
    expect(warnings.some((w) => w.includes("$NAME argument placeholders"))).toBe(true);
  });

  it("project scope: crush commands round-trip under .crush/commands", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-crushproj-"));
    await fs.mkdir(path.join(dir, ".crush/commands/git"), { recursive: true });
    await fs.writeFile(path.join(dir, ".crush/commands/git/commit.md"), "Commit.\n");
    const ex = await getProjectAdapter("crush").exportProject(dir);
    expect(ex.bundle.commands.map((c) => c.name)).toEqual(["git/commit"]);
    const { files, warnings } = await getProjectAdapter("crush").planImport(ex.bundle, "/p", {});
    const written = files.find((f) => f.path === ".crush/commands/git/commit.md")!;
    expect(written.content).toBe("Commit.\n");
    expect(warnings.some((w) => w.includes("$NAME argument placeholders"))).toBe(true);
  });

  it("trae exports both user command roots recursively (~/.trae wins on conflicts)", async () => {
    const { bundle, warnings } = await trae.exportBundle(path.join(FIXTURES, "trae-home"));
    expect(bundle.commands.map((c) => c.name)).toEqual([
      "cn-only",
      "module-a/command-a",
      "summarize-pr",
    ]);
    const mainRaw = await fs.readFile(
      path.join(FIXTURES, "trae-home/.trae/commands/summarize-pr.md"),
      "utf8",
    );
    expect(bundle.commands.find((c) => c.name === "summarize-pr")!.content).toBe(mainRaw);
    const cnRaw = await fs.readFile(
      path.join(FIXTURES, "trae-home/.trae-cn/commands/cn-only.md"),
      "utf8",
    );
    expect(bundle.commands.find((c) => c.name === "cn-only")!.content).toBe(cnRaw);
    expect(warnings.some((w) => w.includes("~/.trae-cn/commands/ (CN edition) files exported"))).toBe(
      true,
    );
  });

  it("trae plans nested commands into ~/.trae/commands only, warns beyond 3 levels", async () => {
    const bundle = emptyBundle();
    bundle.commands = [
      { name: "module-a/command-a", content: "Run $1.\n" },
      { name: "a/b/c/d/too-deep", content: "Too deep.\n" },
    ];
    const { files, warnings } = await trae.planImport(bundle, "/nonexistent-home", {});
    const written = files.find((f) => f.path === ".trae/commands/module-a/command-a.md")!;
    expect(written.content).toBe("Run $1.\n");
    expect(files.some((f) => f.path === ".trae/commands/a/b/c/d/too-deep.md")).toBe(true);
    expect(files.some((f) => f.path.startsWith(".trae-cn/"))).toBe(false);
    expect(warnings.some((w) => w.includes("frontmatter (name/description)"))).toBe(true);
    expect(
      warnings.some((w) => w.includes("commands:a/b/c/d/too-deep") && w.includes("3 nested")),
    ).toBe(true);
  });

  it("project scope: trae commands round-trip under .trae/commands", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-traeproj-"));
    await fs.mkdir(path.join(dir, ".trae/commands/module-a"), { recursive: true });
    await fs.writeFile(path.join(dir, ".trae/commands/module-a/command-a.md"), "Run $1.\n");
    const ex = await getProjectAdapter("trae").exportProject(dir);
    expect(ex.bundle.commands.map((c) => c.name)).toEqual(["module-a/command-a"]);
    const { files, warnings } = await getProjectAdapter("trae").planImport(ex.bundle, "/p", {});
    const written = files.find((f) => f.path === ".trae/commands/module-a/command-a.md")!;
    expect(written.content).toBe("Run $1.\n");
    expect(warnings.some((w) => w.includes("frontmatter (name/description)"))).toBe(true);
  });

  it("cortex exports ~/.snowflake/cortex/commands recursively, byte-faithfully", async () => {
    const { bundle } = await cortex.exportBundle(path.join(FIXTURES, "cortex-home"));
    expect(bundle.commands.map((c) => c.name)).toEqual(["summarize-pr", "warehouse/optimize"]);
    const raw = await fs.readFile(
      path.join(FIXTURES, "cortex-home/.snowflake/cortex/commands/warehouse/optimize.md"),
      "utf8",
    );
    expect(bundle.commands.find((c) => c.name === "warehouse/optimize")!.content).toBe(raw);
  });

  it("cortex plans nested commands into ~/.snowflake/cortex/commands with warning", async () => {
    const bundle = emptyBundle();
    bundle.commands = [{ name: "warehouse/optimize", content: "Optimize $1.\n" }];
    const { files, warnings } = await cortex.planImport(bundle, "/nonexistent-home", {});
    const written = files.find(
      (f) => f.path === ".snowflake/cortex/commands/warehouse/optimize.md",
    )!;
    expect(written.content).toBe("Optimize $1.\n");
    expect(warnings.some((w) => w.includes("client-specific and copied as-is"))).toBe(true);
  });

  it("goose exports ~/.config/goose/recipes as converted commands (yaml + json, flat scan)", async () => {
    const { bundle, warnings } = await goose.exportBundle(path.join(FIXTURES, "goose-home"));
    expect(bundle.commands.map((c) => c.name)).toEqual(["daily-report", "lint-fix"]);
    const daily = bundle.commands.find((c) => c.name === "daily-report")!;
    expect(daily.content).toBe(
      '---\ntitle: "Daily Report"\ndescription: "Generate the daily status report"\n---\n' +
        "Summarize yesterday's commits and open PRs for {{ project }}.\n",
    );
    const lint = bundle.commands.find((c) => c.name === "lint-fix")!;
    expect(lint.content).toBe(
      '---\ndescription: "Fix lint errors"\n---\nRun the linter and fix all reported errors.\n',
    );
    expect(
      warnings.some((w) => w.includes('recipe field "parameters" has no portable command equivalent')),
    ).toBe(true);
    expect(warnings.some((w) => w.includes("goose-specific and copied as-is"))).toBe(true);
  });

  it("goose plans commands as recipes (nested flattened) and registers slash_commands", async () => {
    const bundle = emptyBundle();
    bundle.commands = [
      { name: "git/commit", content: "---\ndescription: \"Commit helper\"\n---\nCommit $ARGUMENTS.\n" },
    ];
    const { files, warnings } = await goose.planImport(bundle, "/nonexistent-home", {});
    const recipe = files.find((f) => f.path === ".config/goose/recipes/git-commit.yaml")!;
    const parsed = parseYaml(recipe.content) as Record<string, unknown>;
    expect(parsed.title).toBe("git-commit");
    expect(parsed.description).toBe("Commit helper");
    expect(parsed.prompt).toBe("Commit $ARGUMENTS.\n");
    const config = files.find((f) => f.path === ".config/goose/config.yaml")!;
    const cfg = parseYaml(config.content) as Record<string, unknown>;
    expect(cfg.slash_commands).toEqual([
      {
        command: "git-commit",
        recipe_path: "/nonexistent-home/.config/goose/recipes/git-commit.yaml",
      },
    ]);
    expect(warnings.some((w) => w.includes("only discovers top-level recipe files"))).toBe(true);
    expect(warnings.some((w) => w.includes("converted to the recipe prompt field"))).toBe(true);
  });

  it("goose→goose round-trip is recipe-parse equivalent", async () => {
    const { bundle } = await goose.exportBundle(path.join(FIXTURES, "goose-home"));
    const daily = bundle.commands.find((c) => c.name === "daily-report")!;
    const warnings: string[] = [];
    const back = parseYaml(gooseCommandToRecipe(daily, "daily-report", warnings)) as Record<
      string,
      unknown
    >;
    const original = parseYaml(
      await fs.readFile(
        path.join(FIXTURES, "goose-home/.config/goose/recipes/daily-report.yaml"),
        "utf8",
      ),
    ) as Record<string, unknown>;
    expect(back.title).toBe(original.title);
    expect(back.description).toBe(original.description);
    expect(back.prompt).toBe(original.prompt);
    expect(warnings).toEqual([]);
  });

  it("goose keeps multi-field frontmatter verbatim inside the recipe prompt with warning", () => {
    const warnings: string[] = [];
    const content = "---\ndescription: d\nmodel: gpt-x\n---\nBody.\n";
    const recipe = parseYaml(
      gooseCommandToRecipe({ name: "c", content }, "c", warnings),
    ) as Record<string, unknown>;
    expect(recipe.prompt).toBe(content);
    expect(warnings.some((w) => w.includes("kept verbatim inside prompt"))).toBe(true);
  });

  it("bundle round-trips the commands layer byte-faithfully (nested names)", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-commands-"));
    const bundle = emptyBundle();
    bundle.commands = [
      { name: "deploy", content: "---\ndescription: d\n---\n\nDeploy.\n" },
      { name: "git/commit", content: "Commit.\n" },
    ];
    await writeBundle(bundle, dir);
    const back = await readBundle(dir);
    expect(back.commands).toEqual(bundle.commands);
  });

  it("filterBundle keeps/drops the commands layer via --only semantics", () => {
    const bundle = emptyBundle();
    bundle.commands = [{ name: "c", content: "x" }];
    expect(filterBundle(bundle, ["commands"]).commands).toHaveLength(1);
    expect(filterBundle(bundle, ["mcp"]).commands).toHaveLength(0);
  });

  it("diff reports added/removed/changed commands", () => {
    const a = emptyBundle();
    const b = emptyBundle();
    a.commands = [
      { name: "same", content: "x" },
      { name: "gone", content: "y" },
      { name: "edit", content: "v1" },
    ];
    b.commands = [
      { name: "same", content: "x" },
      { name: "edit", content: "v2" },
      { name: "new", content: "z" },
    ];
    const items = diffBundles(a, b).filter((i) => i.layer === "commands");
    expect(items).toEqual([
      { layer: "commands", kind: "removed", name: "gone" },
      { layer: "commands", kind: "changed", name: "edit" },
      { layer: "commands", kind: "added", name: "new" },
    ]);
  });
});
