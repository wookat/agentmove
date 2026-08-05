#!/usr/bin/env node
import os from "node:os";
import { Command } from "commander";
import { getAdapter } from "./adapters/index.js";
import { readBundle, stripSecrets, writeBundle } from "./bundle.js";
import { diffBundles, formatDiff } from "./diff.js";
import { formatDoctor, runDoctor } from "./doctor.js";
import { applyPlans, backupPaths } from "./apply.js";
import { Bundle, CliError, ImportOptions } from "./model.js";

const program = new Command();

program
  .name("agentmove")
  .description(
    "Move your AI agent between clients — config, MCP servers, skills, memory, persona.",
  )
  .version("0.1.0")
  .option("--home <dir>", "override the home directory (mainly for testing)", os.homedir());

function home(): string {
  return program.opts<{ home: string }>().home;
}

function printWarnings(warnings: string[]): void {
  for (const w of warnings) console.error(`warning: ${w}`);
}

async function exportFrom(client: string, includeSecrets: boolean): Promise<Bundle> {
  const adapter = getAdapter(client);
  const { bundle, warnings } = await adapter.exportBundle(home());
  printWarnings(warnings);
  if (includeSecrets) return bundle;
  const { bundle: clean, redacted } = stripSecrets(bundle);
  for (const r of redacted) {
    console.error(`warning: ${r}: likely secret replaced with a \${VAR} placeholder (use --include-secrets to keep)`);
  }
  return clean;
}

async function importTo(
  client: string,
  bundle: Bundle,
  apply: boolean,
  importOpts: ImportOptions,
): Promise<void> {
  const adapter = getAdapter(client);
  const { files, warnings } = await adapter.planImport(bundle, home(), importOpts);
  printWarnings(warnings);
  if (!files.length) {
    console.log("nothing to import");
    return;
  }
  if (!apply) {
    console.log(`dry-run: would write ${files.length} file(s) under ${home()} (use --apply to write):`);
    for (const f of files) console.log(`  ~/${f.path}`);
    return;
  }
  const backupDir = await backupPaths(files, home());
  if (backupDir) console.log(`backed up existing files to ${backupDir}`);
  await applyPlans(files, home());
  console.log(`wrote ${files.length} file(s)`);
}

program
  .command("export")
  .description("export a client's setup into an agentmove bundle directory")
  .argument("<client>", "source client (openclaw|hermes|claude-code|codex|cursor|gemini)")
  .option("-o, --out <dir>", "bundle output directory", "./agentmove-bundle")
  .option("--include-secrets", "keep likely-secret env/header values instead of redacting", false)
  .action(async (client: string, opts: { out: string; includeSecrets: boolean }) => {
    const bundle = await exportFrom(client, opts.includeSecrets);
    await writeBundle(bundle, opts.out);
    console.log(
      `exported ${bundle.mcpServers.length} MCP server(s), ${bundle.skills.length} skill(s), ` +
        `${bundle.memory.length} memory entr(ies) to ${opts.out}`,
    );
  });

program
  .command("import")
  .description("import an agentmove bundle into a client (dry-run by default)")
  .argument("<client>", "target client")
  .option("-i, --in <dir>", "bundle directory", "./agentmove-bundle")
  .option("--apply", "actually write files (default is dry-run preview)", false)
  .option("--replace-mcp", "replace the target's MCP servers instead of merging into them", false)
  .action(async (client: string, opts: { in: string; apply: boolean; replaceMcp: boolean }) => {
    const bundle = await readBundle(opts.in);
    await importTo(client, bundle, opts.apply, { replaceMcp: opts.replaceMcp });
  });

program
  .command("convert")
  .description("migrate directly from one client to another (dry-run by default)")
  .argument("<from>", "source client")
  .argument("<to>", "target client")
  .option("--apply", "actually write files (default is dry-run preview)", false)
  .option("--include-secrets", "keep likely-secret env/header values instead of redacting", false)
  .option("--replace-mcp", "replace the target's MCP servers instead of merging into them", false)
  .action(
    async (
      from: string,
      to: string,
      opts: { apply: boolean; includeSecrets: boolean; replaceMcp: boolean },
    ) => {
      const bundle = await exportFrom(from, opts.includeSecrets);
      await importTo(to, bundle, opts.apply, { replaceMcp: opts.replaceMcp });
    },
  );

program
  .command("diff")
  .description("show differences between two clients (or a bundle and a client)")
  .argument("<from>", "source client id or bundle directory (path containing manifest.json)")
  .argument("<to>", "target client id or bundle directory")
  .action(async (from: string, to: string) => {
    const load = async (ref: string): Promise<Bundle> => {
      try {
        return (await getAdapter(ref).exportBundle(home())).bundle;
      } catch (e) {
        if ((e as Error).message.startsWith("unknown client")) return readBundle(ref);
        throw e;
      }
    };
    const [a, b] = await Promise.all([load(from), load(to)]);
    process.stdout.write(formatDiff(diffBundles(a, b)));
  });

program
  .command("doctor")
  .description("detect installed clients and inventory what agentmove can migrate")
  .action(async () => {
    const reports = await runDoctor(home());
    process.stdout.write(formatDoctor(reports));
  });

// Exit-code contract: 0 success, 1 unexpected error, 2 usage error, 3 bad input data.
program.parseAsync().catch((e: unknown) => {
  console.error(`error: ${(e as Error).message}`);
  process.exitCode = e instanceof CliError ? e.exitCode : 1;
});
