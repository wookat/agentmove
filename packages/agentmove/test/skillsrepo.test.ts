import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isSkillsRepo, readSkillsRepo, writeSkillsRepo } from "../src/skillsrepo.js";

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
});
