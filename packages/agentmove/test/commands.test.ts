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
import { codebuddy } from "../src/adapters/codebuddy.js";
import { droid } from "../src/adapters/droid.js";
import { qoder } from "../src/adapters/qoder.js";
import { roo } from "../src/adapters/roo.js";
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
