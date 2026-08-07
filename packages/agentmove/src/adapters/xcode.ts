import { ClientAdapter } from "../model.js";
import { makeClaudeStyleAdapter } from "./claude-code.js";
import { makeCodexStyleAdapter } from "./codex.js";
import { makeGeminiStyleAdapter } from "./gemini.js";

/**
 * Xcode 26 coding intelligence bundles Claude Agent, Codex, and Gemini as
 * built-in agents with isolated config roots under
 * ~/Library/Developer/Xcode/CodingAssistant (macOS only), separate from each
 * CLI's own home config. Apple documents the per-agent subfolders; the file
 * formats match the standalone CLIs.
 */
const BASE = "Library/Developer/Xcode/CodingAssistant";

export const xcodeClaude: ClientAdapter = makeClaudeStyleAdapter({
  id: "xcode-claude",
  label: "Xcode Claude Agent",
  defaultPath: `~/${BASE}/ClaudeAgentConfig (macOS)`,
  root: `${BASE}/ClaudeAgentConfig`,
});

export const xcodeCodex: ClientAdapter = makeCodexStyleAdapter({
  id: "xcode-codex",
  label: "Xcode Codex",
  defaultPath: `~/${BASE}/codex (macOS)`,
  configDir: `${BASE}/codex`,
});

export const xcodeGemini: ClientAdapter = makeGeminiStyleAdapter({
  id: "xcode-gemini",
  label: "Xcode Gemini",
  defaultPath: `~/${BASE}/gemini (macOS)`,
  configDir: `${BASE}/gemini`,
});
