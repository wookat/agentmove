import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ADAPTERS } from "../src/adapters/index.js";
import { CLIENT_IDS } from "../src/model.js";

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const DOCS = path.join(REPO_ROOT, "website", "src", "content", "docs", "docs");

const readDoc = (name: string) => readFileSync(path.join(DOCS, name), "utf8");

// Accepted shorter forms used in prose/tables for some labels.
const ALIASES: Partial<Record<string, string[]>> = {
  "OpenAI Codex CLI": ["Codex CLI"],
};

function expectMentions(text: string, label: string, where: string): void {
  const candidates = [label, ...(ALIASES[label] ?? [])];
  expect(
    candidates.some((c) => text.includes(c)),
    `${where} missing client "${label}"`,
  ).toBe(true);
}

const COUNT_WORDS: Record<number, string> = {
  22: "twenty-two",
  23: "twenty-three",
  24: "twenty-four",
  25: "twenty-five",
  26: "twenty-six",
  27: "twenty-seven",
  28: "twenty-eight",
  29: "twenty-nine",
  30: "thirty",
};

describe("website docs stay in sync with adapters", () => {
  it("introduction.md lists every client label and the right count word", () => {
    const intro = readDoc("introduction.md");
    for (const id of CLIENT_IDS) {
      expectMentions(intro, ADAPTERS[id].label, "introduction.md");
    }
    const word = COUNT_WORDS[CLIENT_IDS.length];
    expect(word, `add ${CLIENT_IDS.length} to COUNT_WORDS`).toBeDefined();
    expect(intro).toContain(`${word} clients`);
  });

  it("clients.md documents every client label", () => {
    const clients = readDoc("clients.md");
    for (const id of CLIENT_IDS) {
      expectMentions(clients, ADAPTERS[id].label, "clients.md");
    }
  });

  it("README lists every client label", () => {
    const readme = readFileSync(path.join(REPO_ROOT, "README.md"), "utf8");
    for (const id of CLIENT_IDS) {
      expectMentions(readme, ADAPTERS[id].label, "README.md");
    }
  });
});
