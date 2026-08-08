import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { claudeCode } from "../src/adapters/claude-code.js";
import { cursor } from "../src/adapters/cursor.js";
import { codex } from "../src/adapters/codex.js";
import { copilot } from "../src/adapters/copilot.js";
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
