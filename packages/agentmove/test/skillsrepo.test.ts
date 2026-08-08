import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isSkillsRepo, readSkillsRepo, stripInstallMetadata, writeSkillsRepo } from "../src/skillsrepo.js";

async function tmp(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "agentmove-skrepo-"));
}

describe("skills repository detection", () => {
  it("detects a skills/ layout", async () => {
    const dir = await tmp();
    await fs.mkdir(path.join(dir, "skills/web-design"), { recursive: true });
    await fs.writeFile(path.join(dir, "skills/web-design/SKILL.md"), "# w");
    expect(await isSkillsRepo(dir)).toBe(true);
  });

  it("detects top-level SKILL.md directories", async () => {
    const dir = await tmp();
    await fs.mkdir(path.join(dir, "review"), { recursive: true });
    await fs.writeFile(path.join(dir, "review/SKILL.md"), "# r");
    expect(await isSkillsRepo(dir)).toBe(true);
  });

  it("detects a single root SKILL.md", async () => {
    const dir = await tmp();
    await fs.writeFile(path.join(dir, "SKILL.md"), "# s");
    expect(await isSkillsRepo(dir)).toBe(true);
  });

  it("does not claim Agent Plugins, bundles, or plain directories", async () => {
    const plugin = await tmp();
    await fs.mkdir(path.join(plugin, "skills/x"), { recursive: true });
    await fs.writeFile(path.join(plugin, "skills/x/SKILL.md"), "# x");
    await fs.writeFile(path.join(plugin, "plugin.json"), "{}");
    expect(await isSkillsRepo(plugin)).toBe(false);

    const bundle = await tmp();
    await fs.mkdir(path.join(bundle, "skills/x"), { recursive: true });
    await fs.writeFile(path.join(bundle, "skills/x/SKILL.md"), "# x");
    await fs.writeFile(path.join(bundle, "manifest.json"), "{}");
    expect(await isSkillsRepo(bundle)).toBe(false);

    const plain = await tmp();
    await fs.writeFile(path.join(plain, "README.md"), "# hi");
    expect(await isSkillsRepo(plain)).toBe(false);
  });
});

describe("readSkillsRepo", () => {
  it("reads skills from a skills/ layout, ignoring non-skill dirs", async () => {
    const dir = await tmp();
    await fs.mkdir(path.join(dir, "skills/a"), { recursive: true });
    await fs.writeFile(path.join(dir, "skills/a/SKILL.md"), "# a");
    await fs.writeFile(path.join(dir, "skills/a/helper.py"), "print(1)");
    await fs.mkdir(path.join(dir, "skills/no-skill"), { recursive: true });
    await fs.writeFile(path.join(dir, "skills/no-skill/notes.md"), "n");
    await fs.mkdir(path.join(dir, "src"), { recursive: true });
    await fs.writeFile(path.join(dir, "src/index.ts"), "export {};");
    const { bundle, warnings } = await readSkillsRepo(dir);
    expect(bundle.skills).toEqual([
      { name: "a", files: { "SKILL.md": "# a", "helper.py": "print(1)" } },
    ]);
    expect(warnings.some((w) => w.includes("skills repository (1 skill(s)"))).toBe(true);
  });

  it("reads namespaced skills/<scope>/<name> layouts, mixed with direct ones", async () => {
    const dir = await tmp();
    await fs.mkdir(path.join(dir, "skills/monalisa/code-review"), { recursive: true });
    await fs.writeFile(path.join(dir, "skills/monalisa/code-review/SKILL.md"), "# cr");
    await fs.writeFile(path.join(dir, "skills/monalisa/code-review/extra.md"), "e");
    await fs.mkdir(path.join(dir, "skills/direct"), { recursive: true });
    await fs.writeFile(path.join(dir, "skills/direct/SKILL.md"), "# d");
    expect(await isSkillsRepo(dir)).toBe(true);
    const { bundle } = await readSkillsRepo(dir);
    expect(bundle.skills).toEqual([
      { name: "direct", files: { "SKILL.md": "# d" } },
      { name: "code-review", files: { "SKILL.md": "# cr", "extra.md": "e" } },
    ]);
  });

  it("disambiguates duplicate names across namespaces with a warning", async () => {
    const dir = await tmp();
    await fs.mkdir(path.join(dir, "skills/alice/review"), { recursive: true });
    await fs.writeFile(path.join(dir, "skills/alice/review/SKILL.md"), "# a");
    await fs.mkdir(path.join(dir, "skills/bob/review"), { recursive: true });
    await fs.writeFile(path.join(dir, "skills/bob/review/SKILL.md"), "# b");
    const { bundle, warnings } = await readSkillsRepo(dir);
    expect(bundle.skills.map((s) => s.name)).toEqual(["review", "bob-review"]);
    expect(warnings.some((w) => w.includes("importing skills/bob/review as bob-review"))).toBe(
      true,
    );
  });

  it("reads top-level skill directories, skipping hidden dirs", async () => {
    const dir = await tmp();
    await fs.mkdir(path.join(dir, "review"), { recursive: true });
    await fs.writeFile(path.join(dir, "review/SKILL.md"), "# r");
    await fs.mkdir(path.join(dir, ".github/todo"), { recursive: true });
    await fs.writeFile(path.join(dir, ".github/todo/SKILL.md"), "# hidden");
    const { bundle } = await readSkillsRepo(dir);
    expect(bundle.skills.map((s) => s.name)).toEqual(["review"]);
  });

  it("reads a root SKILL.md using its frontmatter name", async () => {
    const dir = await tmp();
    await fs.writeFile(
      path.join(dir, "SKILL.md"),
      "---\nname: convex-best-practices\ndescription: d\n---\n# body",
    );
    await fs.writeFile(path.join(dir, "reference.md"), "ref");
    const { bundle } = await readSkillsRepo(dir);
    expect(bundle.skills).toHaveLength(1);
    expect(bundle.skills[0]!.name).toBe("convex-best-practices");
    expect(bundle.skills[0]!.files["reference.md"]).toBe("ref");
  });

  it("falls back to the directory basename without frontmatter", async () => {
    const dir = await tmp();
    await fs.writeFile(path.join(dir, "SKILL.md"), "# no frontmatter");
    const { bundle } = await readSkillsRepo(dir);
    expect(bundle.skills[0]!.name).toBe(path.basename(dir));
  });
});

describe("writeSkillsRepo", () => {
  it("writes the nested layout and round-trips through readSkillsRepo", async () => {
    const dir = await tmp();
    await writeSkillsRepo(
      [
        { name: "rev", files: { "SKILL.md": "# rev\n", "extra/notes.md": "n\n" } },
        { name: "web", files: { "SKILL.md": "# web\n" } },
      ],
      dir,
    );
    expect(await fs.readFile(path.join(dir, "skills/rev/SKILL.md"), "utf8")).toBe("# rev\n");
    expect(await fs.readFile(path.join(dir, "skills/rev/extra/notes.md"), "utf8")).toBe("n\n");
    expect(await isSkillsRepo(dir)).toBe(true);
    const { bundle } = await readSkillsRepo(dir);
    expect(bundle.skills.map((s) => s.name)).toEqual(["rev", "web"]);
  });

  it("fails with a data error when there are no skills", async () => {
    const dir = await tmp();
    await expect(writeSkillsRepo([], dir)).rejects.toThrow(/no skills to export/);
  });

  it("strips gh install-tracking metadata from SKILL.md with a warning", async () => {
    const dir = await tmp();
    const installed = [
      "---",
      "name: rev",
      "description: d",
      "metadata:",
      "  github-repo: https://github.com/acme/skills",
      "  github-ref: refs/heads/main",
      "  github-tree-sha: abc123",
      "  github-path: skills/rev",
      "---",
      "# rev",
      "",
    ].join("\n");
    const warnings = await writeSkillsRepo(
      [{ name: "rev", files: { "SKILL.md": installed, "helper.md": installed } }],
      dir,
    );
    expect(warnings).toEqual([
      expect.stringContaining("skill:rev: stripped gh install-tracking metadata"),
    ]);
    expect(await fs.readFile(path.join(dir, "skills/rev/SKILL.md"), "utf8")).toBe(
      "---\nname: rev\ndescription: d\n---\n# rev\n",
    );
    // only the SKILL.md itself is rewritten
    expect(await fs.readFile(path.join(dir, "skills/rev/helper.md"), "utf8")).toBe(installed);
  });
});

describe("stripInstallMetadata", () => {
  it("keeps other metadata keys and only drops github-* ones", () => {
    const content =
      "---\nname: s\nmetadata:\n  author: me\n  github-repo: https://github.com/a/b\n---\nbody\n";
    const res = stripInstallMetadata(content);
    expect(res.stripped).toBe(true);
    expect(res.content).toBe("---\nname: s\nmetadata:\n  author: me\n---\nbody\n");
  });

  it("leaves files without install metadata byte-identical", () => {
    const clean = "---\nname: s\ndescription: d\nmetadata:\n  author: me\n---\nbody\n";
    expect(stripInstallMetadata(clean)).toEqual({ content: clean, stripped: false });
    const noFm = "# just markdown\ngithub-repo: not frontmatter\n";
    expect(stripInstallMetadata(noFm)).toEqual({ content: noFm, stripped: false });
  });

  it("does not touch github-* keys outside the metadata map", () => {
    const content = "---\nname: s\ngithub-repo: top-level, not install metadata\n---\nbody\n";
    expect(stripInstallMetadata(content).stripped).toBe(false);
  });
});
