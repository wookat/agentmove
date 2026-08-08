import { ADAPTERS } from "./adapters/index.js";
import { Bundle } from "./model.js";

export interface DoctorClientReport {
  id: string;
  label: string;
  defaultPath: string;
  detected: boolean;
  inventory?: {
    mcpServers: number;
    skills: number;
    agents: number;
    memoryEntries: number;
    hasInstructions: boolean;
    hasPersona: boolean;
  };
  warnings: string[];
  error?: string;
}

export async function runDoctor(home: string): Promise<DoctorClientReport[]> {
  const reports: DoctorClientReport[] = [];
  for (const adapter of Object.values(ADAPTERS)) {
    const report: DoctorClientReport = {
      id: adapter.id,
      label: adapter.label,
      defaultPath: adapter.defaultPath,
      detected: false,
      warnings: [],
    };
    try {
      report.detected = await adapter.detect(home);
      if (report.detected) {
        const { bundle, warnings } = await adapter.exportBundle(home);
        report.warnings = warnings;
        report.inventory = inventory(bundle);
      }
    } catch (e) {
      report.error = (e as Error).message;
    }
    reports.push(report);
  }
  return reports;
}

function inventory(bundle: Bundle) {
  return {
    mcpServers: bundle.mcpServers.length,
    skills: bundle.skills.length,
    agents: bundle.agents.length,
    memoryEntries: bundle.memory.length,
    hasInstructions: bundle.instructions !== undefined,
    hasPersona: bundle.persona !== undefined,
  };
}

export function formatDoctor(reports: DoctorClientReport[]): string {
  const lines: string[] = [];
  for (const r of reports) {
    if (r.error) {
      lines.push(`✗ ${r.label} (${r.id}) — error: ${r.error}`);
      continue;
    }
    if (!r.detected) {
      lines.push(`- ${r.label} (${r.id}) — not detected (${r.defaultPath})`);
      continue;
    }
    const inv = r.inventory!;
    lines.push(
      `✓ ${r.label} (${r.id}) — ${inv.mcpServers} MCP server(s), ${inv.skills} skill(s), ` +
        `${inv.agents} agent(s), ` +
        `${inv.memoryEntries} memory entr(ies), instructions: ${inv.hasInstructions ? "yes" : "no"}, ` +
        `persona: ${inv.hasPersona ? "yes" : "no"}`,
    );
    for (const w of r.warnings) lines.push(`    ! ${w}`);
  }
  return lines.join("\n") + "\n";
}
