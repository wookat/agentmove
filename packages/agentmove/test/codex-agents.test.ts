import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parse as parseToml } from "smol-toml";
import {
  codex,
  CODEX_AGENTS_EXPORT_WARNING,
  CODEX_AGENTS_IMPORT_WARNING,
  readCodexAgents,
} from "../src/adapters/codex.js";
import { emptyBundle } from "../src/model.js";
import { getProjectAdapter } from "../src/project.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const HOME = path.join(FIXTURES, "codex-home");

describe("codex custom agents", () => {
  it("exports agent role TOML files recursively, ignoring non-TOML decoys", async () => {
    const { bundle, warnings } = await codex.exportBundle(HOME);
    expect(bundle.agents.map((a) => a.name)).toEqual(["reviewer", "deep-scan"]);
    const reviewer = bundle.agents.find((a) => a.name === "reviewer")!;
    expect(reviewer.content).toBe(
      '---\ndescription: "Reviews staged changes for bugs and style problems"\n---\nYou are a code review specialist. Review carefully.\n',
    );
    expect(warnings).toContain(
      'agents:reviewer: codex agent setting "model" has no portable equivalent; dropped',
    );
    expect(warnings).toContain(CODEX_AGENTS_EXPORT_WARNING);
  });

  it("skips malformed role files and duplicate names with warnings", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "codex-agents-"));
    await fs.writeFile(
      path.join(root, "a-first.toml"),
      'name = "dupe"\ndescription = "first"\ndeveloper_instructions = "First wins."\n',
    );
    await fs.writeFile(
      path.join(root, "b-second.toml"),
      'name = "dupe"\ndescription = "second"\ndeveloper_instructions = "Second loses."\n',
    );
    await fs.writeFile(path.join(root, "broken.toml"), "name = [unclosed\n");
    await fs.writeFile(path.join(root, "no-name.toml"), 'description = "d"\ndeveloper_instructions = "x"\n');
    await fs.writeFile(
      path.join(root, "no-desc.toml"),
      'name = "no-desc"\ndeveloper_instructions = "x"\n',
    );
    await fs.writeFile(path.join(root, "no-instr.toml"), 'name = "no-instr"\ndescription = "d"\n');
    const warnings: string[] = [];
    const agents = await readCodexAgents(root, warnings);
    expect(agents.map((a) => a.name)).toEqual(["dupe"]);
    expect(agents[0]!.content).toContain("First wins.");
    expect(warnings).toContain(
      'agents:b-second.toml: duplicate agent role name "dupe"; codex keeps the first file found, so this one was not exported',
    );
    expect(warnings).toContain("agents:broken.toml: invalid TOML; not migrated");
    expect(warnings).toContain(
      'agents:no-name.toml: agent role file must define a non-empty "name"; not migrated',
    );
    expect(warnings).toContain(
      'agents:no-desc.toml: agent role "no-desc" has no description (codex rejects it); not migrated',
    );
    expect(warnings).toContain(
      'agents:no-instr.toml: agent role "no-instr" has no developer_instructions (codex rejects it); not migrated',
    );
  });

  it("imports portable agents as agent role TOML, flattening nested names", async () => {
    const bundle = emptyBundle();
    bundle.agents = [
      {
        name: "backend/sql",
        content: "---\ndescription: SQL helper\n---\nSQL body.\n",
      },
      { name: "bare", content: "Just a prompt.\n" },
    ];
    const { files, warnings } = await codex.planImport(bundle, "/nonexistent-home", {});
    const sql = files.find((f) => f.path === ".codex/agents/backend-sql.toml")!;
    const parsed = parseToml(sql.content) as Record<string, unknown>;
    expect(parsed.name).toBe("backend-sql");
    expect(parsed.description).toBe("SQL helper");
    expect(parsed.developer_instructions).toBe("SQL body.\n");
    expect(warnings).toContain(
      'agents:backend/sql: codex derives the role name from the file\'s "name" field, not its path; imported as backend-sql',
    );
    const bare = files.find((f) => f.path === ".codex/agents/bare.toml")!;
    const bareParsed = parseToml(bare.content) as Record<string, unknown>;
    expect(bareParsed.description).toBe("Imported by agentmove from agent bare");
    expect(bareParsed.developer_instructions).toBe("Just a prompt.\n");
    expect(warnings).toContain(CODEX_AGENTS_IMPORT_WARNING);
  });

  it("keeps multi-field frontmatter verbatim inside developer_instructions", async () => {
    const bundle = emptyBundle();
    bundle.agents = [
      {
        name: "rich",
        content: "---\nname: rich\ndescription: Rich agent\nmodel: sonnet\n---\nBody.\n",
      },
    ];
    const { files, warnings } = await codex.planImport(bundle, "/nonexistent-home", {});
    const rich = files.find((f) => f.path === ".codex/agents/rich.toml")!;
    const parsed = parseToml(rich.content) as Record<string, unknown>;
    expect(parsed.description).toBe("Imported by agentmove from agent rich");
    expect(parsed.developer_instructions).toContain("model: sonnet");
    expect(warnings).toContain(
      "agents:rich: frontmatter has fields beyond description, which codex agent role TOML cannot express; kept verbatim inside developer_instructions",
    );
  });

  it("round-trips codex agents parse-equivalently (codex -> codex)", async () => {
    const { bundle } = await codex.exportBundle(HOME);
    const { files } = await codex.planImport(bundle, "/nonexistent-home", {});
    const reviewer = files.find((f) => f.path === ".codex/agents/reviewer.toml")!;
    const parsed = parseToml(reviewer.content) as Record<string, unknown>;
    expect(parsed.name).toBe("reviewer");
    expect(parsed.description).toBe("Reviews staged changes for bugs and style problems");
    expect(parsed.developer_instructions).toBe(
      "You are a code review specialist. Review carefully.\n",
    );
  });

  it("supports project-scoped .codex/agents", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-proj-agents-"));
    await fs.mkdir(path.join(dir, ".codex/agents"), { recursive: true });
    await fs.writeFile(
      path.join(dir, ".codex/agents/planner.toml"),
      'name = "planner"\ndescription = "Plans work"\ndeveloper_instructions = "Plan carefully."\n',
    );
    const project = getProjectAdapter("codex")!;
    expect(project.supportsAgents).toBe(true);
    const { bundle, warnings } = await project.exportProject(dir);
    expect(bundle.agents.map((a) => a.name)).toEqual(["planner"]);
    expect(warnings).toContain(CODEX_AGENTS_EXPORT_WARNING);

    const { files, warnings: importWarnings } = await project.planImport(bundle, dir, {});
    const planner = files.find((f) => f.path === ".codex/agents/planner.toml")!;
    const parsed = parseToml(planner.content) as Record<string, unknown>;
    expect(parsed.name).toBe("planner");
    expect(parsed.developer_instructions).toBe("Plan carefully.\n");
    expect(importWarnings).toContain(CODEX_AGENTS_IMPORT_WARNING);
  });

  it("advertises supportsAgents on the codex adapter", () => {
    expect(codex.supportsAgents).toBe(true);
  });
});
