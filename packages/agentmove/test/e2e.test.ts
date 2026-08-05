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

  it("emits machine-readable --json for doctor, diff, and convert", async () => {
    const home = await cloneFixture("openclaw-home");

    const doctor = JSON.parse(run(["--home", home, "doctor", "--json"], home)) as {
      id: string;
      detected: boolean;
    }[];
    expect(doctor.find((r) => r.id === "openclaw")?.detected).toBe(true);

    const convert = JSON.parse(
      run(["--home", home, "convert", "openclaw", "hermes", "--json"], home),
    ) as { applied: boolean; files: string[]; warnings: string[]; summary: { mcpServers: number } };
    expect(convert.applied).toBe(false);
    expect(convert.files).toContain(".hermes/config.yaml");
    expect(convert.summary.mcpServers).toBe(2);
    expect(convert.warnings.length).toBeGreaterThan(0);

    const diff = JSON.parse(run(["--home", home, "diff", "openclaw", "hermes", "--json"], home)) as {
      layer: string;
    }[];
    expect(Array.isArray(diff)).toBe(true);
  });

  it("emits --json for export and lists clients", async () => {
    const home = await cloneFixture("openclaw-home");
    const work = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-e2e-"));
    const out = JSON.parse(
      run(["--home", home, "export", "openclaw", "-o", path.join(work, "b"), "--json"], work),
    ) as { out: string; summary: { mcpServers: number }; warnings: string[] };
    expect(out.summary.mcpServers).toBe(2);

    const clients = JSON.parse(run(["clients", "--json"], work)) as { id: string }[];
    expect(clients.map((c) => c.id)).toContain("gemini");
    expect(run(["clients"], work)).toContain("openclaw");
  });

  // chmod-based read-only dirs are not enforced on Windows
  it.skipIf(process.platform === "win32")(
    "gives permission guidance on EACCES instead of a stack trace",
    async () => {
    const home = await cloneFixture("openclaw-home");
    await fs.chmod(home, 0o555);
    const r = runFail(["--home", home, "convert", "openclaw", "hermes", "--apply"], home);
    await fs.chmod(home, 0o755);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("check file/directory permissions");
    expect(r.stderr).not.toContain("    at ");
    },
  );

  it("generates working bash completion and rejects unknown shells with exit 2", async () => {
    const work = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-e2e-"));
    const script = run(["completion", "bash"], work);
    expect(script).toContain("complete -F _agentmove agentmove");
    const probe = spawnSync(
      "bash",
      [
        "-c",
        `${script}\nCOMP_WORDS=(agentmove convert ge); COMP_CWORD=2; _agentmove; echo "\${COMPREPLY[@]}"`,
      ],
      { encoding: "utf8" },
    );
    expect(probe.stdout.trim()).toBe("gemini");
    expect(run(["completion", "zsh"], work)).toContain("bashcompinit");
    expect(run(["completion", "fish"], work)).toContain("__fish_seen_subcommand_from convert");
    expect(runFail(["completion", "powershell"], work).status).toBe(2);
  });

  it("reports the package.json version", async () => {
    const work = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-e2e-"));
    const pkg = JSON.parse(
      await fs.readFile(path.join(PKG, "package.json"), "utf8"),
    ) as { version: string };
    expect(run(["--version"], work).trim()).toBe(pkg.version);
  });

  it.skipIf(process.platform === "win32")(
    "hides stack traces by default and prints them with --debug",
    async () => {
    const home = await cloneFixture("openclaw-home");
    await fs.chmod(home, 0o555);
    const plain = runFail(["--home", home, "convert", "openclaw", "hermes", "--apply"], home);
    const debug = runFail(
      ["--home", home, "--debug", "convert", "openclaw", "hermes", "--apply"],
      home,
    );
    await fs.chmod(home, 0o755);
    expect(plain.stderr).toContain("rerun with --debug");
    expect(plain.stderr).not.toContain("    at ");
    expect(debug.stderr).toContain("    at ");
    },
  );

  it("ships a man page wired into package.json", async () => {
    const pkg = JSON.parse(await fs.readFile(path.join(PKG, "package.json"), "utf8")) as {
      man: string[];
      files: string[];
    };
    // npm only links man pages whose basename matches the package name,
    // and (empirically, npm 11) only when "man" is an array
    expect(pkg.man).toEqual(["./man/agentmove-cli.1"]);
    expect(pkg.files).toContain("man");
    const page = await fs.readFile(path.join(PKG, "man/agentmove-cli.1"), "utf8");
    expect(page).toContain(".TH AGENTMOVE 1");
    for (const cmd of ["export", "import", "convert", "diff", "doctor", "clients", "completion"]) {
      expect(page).toContain(cmd);
    }
  });

  it("prints a migration summary after --apply", async () => {
    const home = await cloneFixture("openclaw-home");
    const out = run(["--home", home, "convert", "openclaw", "hermes", "--apply"], home);
    expect(out).toMatch(/migrated: \d+ MCP server\(s\), \d+ skill\(s\), \d+ memory entr\(ies\)/);
  });

  it("supports partial migration with --only and rejects unknown layers", async () => {
    const home = await cloneFixture("openclaw-home");
    const work = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-e2e-"));

    const out = JSON.parse(
      run(
        ["--home", home, "export", "openclaw", "-o", path.join(work, "b"), "--only", "mcp", "--json"],
        work,
      ),
    ) as { summary: { mcpServers: number; skills: number; memoryEntries: number } };
    expect(out.summary.mcpServers).toBe(2);
    expect(out.summary.skills).toBe(0);
    expect(out.summary.memoryEntries).toBe(0);

    const convert = JSON.parse(
      run(
        ["--home", home, "convert", "openclaw", "hermes", "--only", "skills,persona", "--json"],
        home,
      ),
    ) as { files: string[]; summary: { mcpServers: number; skills: number } };
    expect(convert.summary.mcpServers).toBe(0);
    expect(convert.summary.skills).toBeGreaterThan(0);
    expect(convert.files.some((f) => f.includes("SKILL.md"))).toBe(true);

    const bad = runFail(["--home", home, "export", "openclaw", "--only", "mcp,nope"], home);
    expect(bad.status).toBe(2);
    expect(bad.stderr).toContain('unknown layer "nope"');
  });

  it("converts every source→target pair (full 6×6 matrix) without errors", async () => {
    const clients = ["openclaw", "hermes", "claude-code", "codex", "cursor", "gemini"];
    const fixtures: Record<string, string> = {
      openclaw: "openclaw-home",
      hermes: "hermes-home",
      "claude-code": "claude-home",
      codex: "codex-home",
      cursor: "cursor-home",
      gemini: "gemini-home",
    };
    for (const src of clients) {
      const home = await cloneFixture(fixtures[src]!);
      for (const dst of clients) {
        if (src === dst) continue;
        const out = JSON.parse(run(["--home", home, "convert", src, dst, "--json"], home)) as {
          files: string[];
          summary: { mcpServers: number };
        };
        expect(out.summary.mcpServers, `${src}→${dst}`).toBeGreaterThan(0);
        expect(out.files.length, `${src}→${dst}`).toBeGreaterThan(0);
      }
    }
  }, 60_000);

  it("applies a full round trip into every target and re-exports it", async () => {
    const targets = ["openclaw", "hermes", "claude-code", "codex", "cursor", "gemini"];
    for (const dst of targets) {
      const home = await cloneFixture("openclaw-home");
      run(["--home", home, "convert", "openclaw", dst, "--apply"], home);
      const work = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-e2e-"));
      const out = JSON.parse(
        run(["--home", home, "export", dst, "-o", path.join(work, "b"), "--json"], work),
      ) as { summary: { mcpServers: number } };
      expect(out.summary.mcpServers, `round trip via ${dst}`).toBeGreaterThan(0);
    }
  }, 60_000);

  it("re-export into the same directory leaves no stale layer files", async () => {
    const home = await cloneFixture("openclaw-home");
    const work = await fs.mkdtemp(path.join(os.tmpdir(), "agentmove-e2e-"));
    const bundle = path.join(work, "b");
    run(["--home", home, "export", "openclaw", "-o", bundle], work);
    await fs.access(path.join(bundle, "persona.md"));
    await fs.access(path.join(bundle, "skills"));
    await fs.writeFile(path.join(work, "b/NOTES.txt"), "user file\n");

    run(["--home", home, "export", "openclaw", "-o", bundle, "--only", "mcp"], work);
    await expect(fs.access(path.join(bundle, "persona.md"))).rejects.toThrow();
    await expect(fs.access(path.join(bundle, "instructions.md"))).rejects.toThrow();
    const skills = await fs.readdir(path.join(bundle, "skills")).catch(() => []);
    expect(skills).toHaveLength(0);
    // files agentmove does not own are untouched
    expect(await fs.readFile(path.join(bundle, "NOTES.txt"), "utf8")).toBe("user file\n");
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
