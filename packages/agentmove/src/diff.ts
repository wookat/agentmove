import { Bundle, McpServer } from "./model.js";

export interface DiffItem {
  layer: "config" | "mcp" | "instructions" | "persona" | "memory" | "skills";
  kind: "added" | "removed" | "changed";
  name: string;
  detail?: string;
}

function mcpKey(s: McpServer): string {
  return JSON.stringify([s.transport, s.command, s.args, s.env, s.cwd, s.url, s.headers, s.enabled]);
}

/** Structural diff between two bundles (a = source/left, b = target/right). */
export function diffBundles(a: Bundle, b: Bundle): DiffItem[] {
  const items: DiffItem[] = [];

  if ((a.config.model ?? "") !== (b.config.model ?? "")) {
    items.push({
      layer: "config",
      kind: "changed",
      name: "model",
      detail: `${a.config.model ?? "(unset)"} -> ${b.config.model ?? "(unset)"}`,
    });
  }

  const bServers = new Map(b.mcpServers.map((s) => [s.name, s]));
  for (const s of a.mcpServers) {
    const other = bServers.get(s.name);
    if (!other) items.push({ layer: "mcp", kind: "removed", name: s.name });
    else if (mcpKey(s) !== mcpKey(other)) items.push({ layer: "mcp", kind: "changed", name: s.name });
    bServers.delete(s.name);
  }
  for (const name of bServers.keys()) items.push({ layer: "mcp", kind: "added", name });

  for (const [layer, av, bv] of [
    ["instructions", a.instructions, b.instructions],
    ["persona", a.persona, b.persona],
  ] as const) {
    if ((av ?? "") === (bv ?? "")) continue;
    const kind = !av ? "added" : !bv ? "removed" : "changed";
    items.push({ layer, kind, name: layer });
  }

  const aMem = new Set(a.memory.map((e) => e.content.trim()));
  const bMem = new Set(b.memory.map((e) => e.content.trim()));
  for (const m of aMem) {
    if (!bMem.has(m)) {
      items.push({ layer: "memory", kind: "removed", name: m.slice(0, 60) });
    }
  }
  for (const m of bMem) {
    if (!aMem.has(m)) items.push({ layer: "memory", kind: "added", name: m.slice(0, 60) });
  }

  const bSkills = new Map(b.skills.map((s) => [s.name, s]));
  for (const s of a.skills) {
    const other = bSkills.get(s.name);
    if (!other) items.push({ layer: "skills", kind: "removed", name: s.name });
    else if (JSON.stringify(s.files) !== JSON.stringify(other.files)) {
      items.push({ layer: "skills", kind: "changed", name: s.name });
    }
    bSkills.delete(s.name);
  }
  for (const name of bSkills.keys()) items.push({ layer: "skills", kind: "added", name });

  return items;
}

export function formatDiff(items: DiffItem[]): string {
  if (!items.length) return "no differences\n";
  const symbol = { added: "+", removed: "-", changed: "~" } as const;
  return (
    items
      .map((i) => `${symbol[i.kind]} [${i.layer}] ${i.name}${i.detail ? ` (${i.detail})` : ""}`)
      .join("\n") + "\n"
  );
}
