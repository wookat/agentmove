import { ClientAdapter, ClientId } from "../model.js";
import { openclaw } from "./openclaw.js";
import { hermes } from "./hermes.js";
import { claudeCode } from "./claude-code.js";
import { codex } from "./codex.js";
import { cursor } from "./cursor.js";
import { gemini } from "./gemini.js";

export const ADAPTERS: Record<ClientId, ClientAdapter> = {
  openclaw,
  hermes,
  "claude-code": claudeCode,
  codex,
  cursor,
  gemini,
};

export function getAdapter(id: string): ClientAdapter {
  const adapter = (ADAPTERS as Record<string, ClientAdapter>)[id];
  if (!adapter) {
    throw new Error(`unknown client "${id}" (expected one of: ${Object.keys(ADAPTERS).join(", ")})`);
  }
  return adapter;
}

export { openclaw, hermes, claudeCode, codex, cursor, gemini };
