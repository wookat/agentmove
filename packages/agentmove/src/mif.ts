import { randomUUID } from "node:crypto";
import { CliError, EXIT_DATA, isRecord, MemoryEntry, MemoryKind, parseFile } from "./model.js";

/**
 * Memory Interchange Format (MIF) v2 — a vendor-neutral JSON envelope for
 * exchanging AI agent memories (https://github.com/varun29ankuS/mif-spec).
 * Required fields per memory: id (UUID), content, created_at (ISO 8601).
 */

const MIF_VERSION = "2.0";

interface MifMemory {
  id: string;
  content: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface MifDocument {
  mif_version: string;
  memories: MifMemory[];
}

export function toMif(entries: MemoryEntry[], exportedAt: string): MifDocument {
  return {
    mif_version: MIF_VERSION,
    memories: entries.map((e) => ({
      id: randomUUID(),
      content: e.content,
      created_at: e.date ? `${e.date}T00:00:00Z` : exportedAt,
      metadata: { source: e.source, kind: e.kind, content_type: "text/markdown" },
    })),
  };
}

const KINDS: MemoryKind[] = ["long-term", "daily", "user-profile"];

export function fromMif(file: string, raw: string, warnings: string[]): MemoryEntry[] {
  const doc = parseFile<unknown>(file, raw, JSON.parse);
  if (!isRecord(doc) || typeof doc.mif_version !== "string" || !Array.isArray(doc.memories)) {
    throw new CliError(`${file}: not a MIF document (expected mif_version + memories[])`, EXIT_DATA);
  }
  if (!doc.mif_version.startsWith("2")) {
    warnings.push(`mif: document version ${doc.mif_version}; agentmove implements MIF v2`);
  }
  const entries: MemoryEntry[] = [];
  for (const [i, m] of doc.memories.entries()) {
    if (!isRecord(m) || typeof m.content !== "string") {
      warnings.push(`mif: memories[${i}] has no string content; skipped`);
      continue;
    }
    const meta = isRecord(m.metadata) ? m.metadata : {};
    const kind = KINDS.includes(meta.kind as MemoryKind) ? (meta.kind as MemoryKind) : "long-term";
    const created = typeof m.created_at === "string" ? m.created_at : undefined;
    entries.push({
      content: m.content,
      source: typeof meta.source === "string" ? meta.source : file,
      kind,
      date: kind === "daily" && created ? created.slice(0, 10) : undefined,
    });
    const extra = Object.keys(m).filter(
      (k) => !["id", "content", "created_at", "updated_at", "metadata", "memory_type"].includes(k),
    );
    if (extra.length) {
      warnings.push(`mif: memories[${i}]: fields not portable to agentmove dropped: ${extra.join(", ")}`);
    }
  }
  return entries;
}
