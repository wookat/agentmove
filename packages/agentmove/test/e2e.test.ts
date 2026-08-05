import { beforeAll, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Real-environment e2e: runs the *built* CLI (dist/cli.js) in a child process
 * against copies of the fixture home directories, exercising the full
 * doctor -> export -> import --apply (with backup) -> re-export round trip.
 */
const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CLI = path.join(PKG, "dist/cli.js");
const FIXTURES = path.join(PKG, "test/fixtures");

function run(args: string[], cwd: string): string {
  return execFileSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8" });
}

function runFail(args: string[], cwd: string): { status: number; stderr: string } {
  const res = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8" });
  return { status: res.status ?? -1, stderr: res.stderr };
}

async function cloneFixture(name: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-e2e-"));
  await fs.cp(path.join(FIXTURES, name), dir, { recursive: true });
  return dir;
}

describe("e2e (built CLI, child process)", () => {
  beforeAll(async () => {
    await fs.access(CLI); // fails loudly if `pnpm build` was not run first
  });

  it("doctor inventories a real openclaw home", async () => {
    const home = await cloneFixture("openclaw-home");
    const out = run(["--home", home, "doctor"], home);
    expect(out).toContain("✓ OpenClaw (openclaw)");
    expect(out).toContain("2 MCP server(s)");
  });

  it("convert --apply writes hermes files, backs up, and survives re-export", async () => {
    const home = await cloneFixture("openclaw-home");
    await fs.mkdir(path.join(home, ".hermes"), { recursive: true });
    await fs.writeFile(path.join(home, ".hermes/SOUL.md"), "old soul\n");

    const dry = run(["--home", home, "convert", "openclaw", "hermes"], home);
    expect(dry).toContain("dry-run");
    await expect(fs.readFile(path.join(home, ".hermes/config.yaml"), "utf8")).rejects.toThrow();

    const out = run(["--home", home, "convert", "openclaw", "hermes", "--apply"], home);
    expect(out).toContain("backed up existing files to");
    expect(out).toContain("wrote");

    const soul = await fs.readFile(path.join(home, ".hermes/SOUL.md"), "utf8");
    expect(soul).toContain("Clawd");
    const backups = await fs.readdir(path.join(home, ".agentmove/backups"));
    expect(backups).toHaveLength(1);
    const backedUp = await fs.readFile(
      path.join(home, ".agentmove/backups", backups[0]!, ".hermes/SOUL.md"),
      "utf8",
    );
    expect(backedUp).toBe("old soul\n");

    // the migrated hermes home must itself be exportable, and match the source
    const work = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-e2e-"));
    run(["--home", home, "export", "hermes", "-o", path.join(work, "b")], work);
    const memory = await fs.readFile(path.join(work, "b/memory/memory.json"), "utf8");
    expect(memory).toContain("Prefers dark mode.");
    // diff surfaces the honest lossy edges: headers dropped on `remote`,
    // skills namespaced under agentmove-imports/ in hermes
    const diff = run(["--home", home, "diff", "openclaw", "hermes"], home);
    expect(diff).toContain("~ [mcp] remote");
    expect(diff).toContain("+ [skills] agentmove-imports");
  });

  it("export redacts secrets by default and --include-secrets keeps them", async () => {
    const home = await cloneFixture("claude-home");
    const work = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-e2e-"));
    run(["--home", home, "export", "claude-code", "-o", path.join(work, "redacted")], work);
    const redacted = await fs.readFile(path.join(work, "redacted/mcp-servers.json"), "utf8");
    expect(redacted).toContain("${NOTION_TOKEN}");
    expect(redacted).not.toContain("secret-token-value");

    run(
      ["--home", home, "export", "claude-code", "-o", path.join(work, "full"), "--include-secrets"],
      work,
    );
    const full = await fs.readFile(path.join(work, "full/mcp-servers.json"), "utf8");
    expect(full).toContain("secret-token-value");
  });

  it("bundle round-trips through import into codex", async () => {
    const claudeHome = await cloneFixture("claude-home");
    const codexHome = await cloneFixture("codex-home");
    const work = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-e2e-"));
    const bundle = path.join(work, "bundle");
    run(["--home", claudeHome, "export", "claude-code", "-o", bundle], work);
    const out = run(["--home", codexHome, "import", "codex", "-i", bundle, "--apply"], work);
    expect(out).toContain("wrote");
    const toml = await fs.readFile(path.join(codexHome, ".codex/config.toml"), "utf8");
    expect(toml).toContain("notion");
    const skill = await fs.readFile(
      path.join(codexHome, ".agents/skills/review/SKILL.md"),
      "utf8",
    );
    expect(skill).toContain("review");
  });

  it("fails with a clean error for unknown clients", async () => {
    const home = await cloneFixture("openclaw-home");
    expect(() => run(["--home", home, "export", "nope"], home)).toThrow(/unknown client/);
  });

  it("honors the exit-code contract (2 usage, 3 bad data) with file-path context", async () => {
    const home = await cloneFixture("openclaw-home");
    expect(runFail(["--home", home, "export", "nope"], home).status).toBe(2);
    expect(runFail(["--home", home, "import", "codex", "-i", "/nonexistent"], home).status).toBe(3);

    await fs.writeFile(path.join(home, ".claude.json"), "{ broken");
    const r = runFail(["--home", home, "export", "claude-code"], home);
    expect(r.status).toBe(3);
    expect(r.stderr).toContain(".claude.json");
  });

  it("merges into the target's existing MCP servers instead of replacing them", async () => {
    const claudeHome = await cloneFixture("claude-home");
    const codexHome = await cloneFixture("codex-home");
    const work = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-e2e-"));
    const bundle = path.join(work, "bundle");
    run(["--home", claudeHome, "export", "claude-code", "-o", bundle], work);
    run(["--home", codexHome, "import", "codex", "-i", bundle, "--apply"], work);
    const toml = await fs.readFile(path.join(codexHome, ".codex/config.toml"), "utf8");
    // codex-home's own servers survive alongside the imported ones
    expect(toml).toContain("linear");
    expect(toml).toContain("notion");
  });
});
