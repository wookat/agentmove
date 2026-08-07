import { ClientAdapter, ClientId, CliError, EXIT_USAGE } from "../model.js";
import { openclaw } from "./openclaw.js";
import { hermes } from "./hermes.js";
import { claudeCode } from "./claude-code.js";
import { codex } from "./codex.js";
import { cursor } from "./cursor.js";
import { gemini } from "./gemini.js";
import { windsurf } from "./windsurf.js";
import { cline } from "./cline.js";
import { zed } from "./zed.js";
import { openhands } from "./openhands.js";
import { copilot } from "./copilot.js";
import { opencode } from "./opencode.js";
import { qwen } from "./qwen.js";
import { amp } from "./amp.js";
import { claudeDesktop } from "./claude-desktop.js";
import { vscode } from "./vscode.js";
import { kiro } from "./kiro.js";
import { roo } from "./roo.js";
import { continueAdapter } from "./continue.js";
import { crush } from "./crush.js";
import { goose } from "./goose.js";
import { antigravity } from "./antigravity.js";
import { droid } from "./droid.js";
import { amazonq } from "./amazonq.js";
import { warp } from "./warp.js";
import { junie } from "./junie.js";
import { lmstudio } from "./lmstudio.js";
import { trae } from "./trae.js";
import { codebuddy } from "./codebuddy.js";

export const ADAPTERS: Record<ClientId, ClientAdapter> = {
  openclaw,
  hermes,
  "claude-code": claudeCode,
  "claude-desktop": claudeDesktop,
  codex,
  cursor,
  gemini,
  windsurf,
  cline,
  zed,
  openhands,
  copilot,
  opencode,
  qwen,
  amp,
  vscode,
  kiro,
  roo,
  continue: continueAdapter,
  crush,
  goose,
  antigravity,
  droid,
  amazonq,
  warp,
  junie,
  lmstudio,
  trae,
  codebuddy,
};

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length)]);
  for (let j = 0; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length]![b.length]!;
}

export function getAdapter(id: string): ClientAdapter {
  const adapter = (ADAPTERS as Record<string, ClientAdapter>)[id];
  if (!adapter) {
    const ids = Object.keys(ADAPTERS);
    const nearest = ids
      .map((c) => ({ c, d: editDistance(id.toLowerCase(), c) }))
      .sort((x, y) => x.d - y.d)[0];
    const hint = nearest && nearest.d <= 3 ? `; did you mean "${nearest.c}"?` : "";
    throw new CliError(
      `unknown client "${id}" (expected one of: ${ids.join(", ")})${hint}`,
      EXIT_USAGE,
    );
  }
  return adapter;
}

export { openclaw, hermes, claudeCode, codex, cursor, gemini, windsurf, cline, zed, openhands, copilot, opencode, qwen, goose, amp, claudeDesktop, vscode, kiro, roo, continueAdapter, crush, antigravity, droid, amazonq, warp, junie, lmstudio, trae, codebuddy };
