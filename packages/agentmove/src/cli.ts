#!/usr/bin/env node
import { readFileSync } from "node:fs";
import os from "node:os";
import { Command } from "commander";
import { ADAPTERS, getAdapter } from "./adapters/index.js";
import { readBundle, stripSecrets, writeBundle } from "./bundle.js";
import { diffBundles, formatDiff } from "./diff.js";
import { formatDoctor, runDoctor } from "./doctor.js";
import { applyPlans, backupPaths } from "./apply.js";
import { Bundle, CliError, ImportOptions } from "./model.js";
import { completionScript } from "./completion.js";

const program = new Command();

program
  .name("agentmove")
  .description(
    "Move your AI agent between clients — config, MCP servers, skills, memory, persona.",
  )
  .version(
    (
      JSON.parse(
        readFileSync(new URL("../package.json", import.meta.url), "utf8"),
      ) as { version: string }
    ).version,
  )
  .option("--home <dir>", "override the home directory (mainly for testing)", os.homedir());

function home(): string {
  return program.opts<{ home: string }>().home;
}

function printWarnings(warnings: string[]): void {
  for (const w of warnings) console.error(`warning: ${w}`);
}

async function exportFrom(
  client: string,
  includeSecrets: boolean,
  collect?: string[],
): Promise<Bundle> {
  const adapter = getAdapter(client);
  const { bundle, warnings } = await adapter.exportBundle(home());
  if (collect) collect.push(...warnings);
  else printWarnings(warnings);
  if (includeSecrets) return bundle;
  const { bundle: clean, redacted } = stripSecrets(bundle);
  for (const r of redacted) {
    const msg = `${r}: likely secret replaced with a \${VAR} placeholder (use --include-secrets to keep)`;
    if (collect) collect.push(msg);
    else console.error(`warning: ${msg}`);
  }
  return clean;
}

function bundleSummary(bundle: Bundle) {
  return {
    mcpServers: bundle.mcpServers.length,
    skills: bundle.skills.length,
    memoryEntries: bundle.memory.length,
    instructions: bundle.instructions !== undefined,
    persona: bundle.persona !== undefined,
  };
}

function summaryLine(bundle: Bundle): string {
  const s = bundleSummary(bundle);
  const extras = [s.instructions ? "instructions" : null, s.persona ? "persona" : null]
    .filter(Boolean)
    .join(", ");
  return (
    `${s.mcpServers} MCP server(s), ${s.skills} skill(s), ${s.memoryEntries} memory entr(ies)` +
    (extras ? `, ${extras}` : "")
  );
}

async function importTo(
  client: string,
  bundle: Bundle,
  apply: boolean,
  importOpts: ImportOptions,
  json: boolean,
  priorWarnings: string[] = [],
): Promise<void> {
  const adapter = getAdapter(client);
  const { files, warnings } = await adapter.planImport(bundle, home(), importOpts);
  const allWarnings = [...priorWarnings, ...warnings];
  if (!json) printWarnings(allWarnings);

  let backupDir: string | undefined;
  if (apply && files.length) {
    backupDir = await backupPaths(files, home());
    await applyPlans(files, home());
  }

  if (json) {
    process.stdout.write(
      JSON.stringify(
        {
          applied: apply && files.length > 0,
          files: files.map((f) => f.path),
          backupDir: backupDir ?? null,
          summary: bundleSummary(bundle),
          warnings: allWarnings,
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }
  if (!files.length) {
    console.log("nothing to import");
    return;
  }
  if (!apply) {
    console.log(`dry-run: would write ${files.length} file(s) under ${home()} (use --apply to write):`);
    for (const f of files) console.log(`  ~/${f.path}`);
    return;
  }
  if (backupDir) console.log(`backed up existing files to ${backupDir}`);
  console.log(`wrote ${files.length} file(s)`);
  console.log(`migrated: ${summaryLine(bundle)}`);
}

program
  .command("export")
  .description("export a client's setup into an agentmove bundle directory")
  .argument("<client>", "source client (openclaw|hermes|claude-code|codex|cursor|gemini)")
  .option("-o, --out <dir>", "bundle output directory", "./agentmove-bundle")
  .option("--include-secrets", "keep likely-secret env/header values instead of redacting", false)
  .option("--json", "machine-readable JSON output", false)
  .action(
    async (client: string, opts: { out: string; includeSecrets: boolean; json: boolean }) => {
      const collected: string[] = [];
      const bundle = await exportFrom(client, opts.includeSecrets, opts.json ? collected : undefined);
      await writeBundle(bundle, opts.out);
      if (opts.json) {
        process.stdout.write(
          JSON.stringify(
            { out: opts.out, summary: bundleSummary(bundle), warnings: collected },
            null,
            2,
          ) + "\n",
        );
        return;
      }
      console.log(`exported ${summaryLine(bundle)} to ${opts.out}`);
    },
  );

program
  .command("import")
  .description("import an agentmove bundle into a client (dry-run by default)")
  .argument("<client>", "target client")
  .option("-i, --in <dir>", "bundle directory", "./agentmove-bundle")
  .option("--apply", "actually write files (default is dry-run preview)", false)
  .option("--replace-mcp", "replace the target's MCP servers instead of merging into them", false)
  .option("--json", "machine-readable JSON output", false)
  .action(
    async (
      client: string,
      opts: { in: string; apply: boolean; replaceMcp: boolean; json: boolean },
    ) => {
      const bundle = await readBundle(opts.in);
      await importTo(client, bundle, opts.apply, { replaceMcp: opts.replaceMcp }, opts.json);
    },
  );

program
  .command("convert")
  .description("migrate directly from one client to another (dry-run by default)")
  .argument("<from>", "source client")
  .argument("<to>", "target client")
  .option("--apply", "actually write files (default is dry-run preview)", false)
  .option("--include-secrets", "keep likely-secret env/header values instead of redacting", false)
  .option("--replace-mcp", "replace the target's MCP servers instead of merging into them", false)
  .option("--json", "machine-readable JSON output", false)
  .action(
    async (
      from: string,
      to: string,
      opts: { apply: boolean; includeSecrets: boolean; replaceMcp: boolean; json: boolean },
    ) => {
      const collected: string[] = [];
      const bundle = await exportFrom(from, opts.includeSecrets, opts.json ? collected : undefined);
      await importTo(to, bundle, opts.apply, { replaceMcp: opts.replaceMcp }, opts.json, collected);
    },
  );

program
  .command("diff")
  .description("show differences between two clients (or a bundle and a client)")
  .argument("<from>", "source client id or bundle directory (path containing manifest.json)")
  .argument("<to>", "target client id or bundle directory")
  .option("--json", "machine-readable JSON output", false)
  .action(async (from: string, to: string, opts: { json: boolean }) => {
    const load = async (ref: string): Promise<Bundle> => {
      try {
        return (await getAdapter(ref).exportBundle(home())).bundle;
      } catch (e) {
        if ((e as Error).message.startsWith("unknown client")) return readBundle(ref);
        throw e;
      }
    };
    const [a, b] = await Promise.all([load(from), load(to)]);
    const items = diffBundles(a, b);
    if (opts.json) process.stdout.write(JSON.stringify(items, null, 2) + "\n");
    else process.stdout.write(formatDiff(items));
  });

program
  .command("clients")
  .description("list supported clients and their default config locations")
  .option("--json", "machine-readable JSON output", false)
  .action((opts: { json: boolean }) => {
    const rows = Object.values(ADAPTERS).map((a) => ({
      id: a.id,
      label: a.label,
      defaultPath: a.defaultPath,
    }));
    if (opts.json) process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
    else {
      for (const r of rows) console.log(`${r.id.padEnd(12)} ${r.label.padEnd(14)} ${r.defaultPath}`);
    }
  });

program
  .command("doctor")
  .description("detect installed clients and inventory what agentmove can migrate")
  .option("--json", "machine-readable JSON output", false)
  .action(async (opts: { json: boolean }) => {
    const reports = await runDoctor(home());
    if (opts.json) process.stdout.write(JSON.stringify(reports, null, 2) + "\n");
    else process.stdout.write(formatDoctor(reports));
  });

program
  .command("completion")
  .description('generate a shell completion script (enable with: eval "$(agentmove completion bash)")')
  .argument("<shell>", "bash or zsh")
  .action((shell: string) => {
    process.stdout.write(completionScript(shell));
  });

// Exit-code contract: 0 success, 1 unexpected error, 2 usage error, 3 bad input data.
program.parseAsync().catch((e: unknown) => {
  const err = e as NodeJS.ErrnoException;
  let message = err.message;
  if (err.code === "EACCES" || err.code === "EPERM") {
    message += " (check file/directory permissions, or rerun with a writable --home)";
  }
  console.error(`error: ${message}`);
  process.exitCode = e instanceof CliError ? e.exitCode : 1;
});
