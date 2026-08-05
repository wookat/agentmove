#!/usr/bin/env node
import { readFileSync } from "node:fs";
import os from "node:os";
import { Command } from "commander";
import { ADAPTERS, getAdapter } from "./adapters/index.js";
import { readBundle, stripSecrets, writeBundle } from "./bundle.js";
import { diffBundles, formatDiff } from "./diff.js";
import { formatDoctor, runDoctor } from "./doctor.js";
import { applyPlans, backupPaths } from "./apply.js";
import {
  Bundle,
  CLIENT_IDS,
  CliError,
  ImportOptions,
  emptyBundle,
  filterBundle,
  parseLayers,
} from "./model.js";
import { completionScript } from "./completion.js";
import { getProjectAdapter } from "./project.js";
import { fromMif, toMif } from "./mif.js";
import { decryptBundle, encryptBundle, isPackFile, requirePassphrase } from "./pack.js";
import fs from "node:fs/promises";

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
  .option("--home <dir>", "override the home directory (mainly for testing)", os.homedir())
  .option("--debug", "print a full stack trace on unexpected errors", false);

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
  project?: string,
): Promise<Bundle> {
  const adapter = getAdapter(client);
  const { bundle, warnings } = project
    ? await getProjectAdapter(adapter.id).exportProject(project)
    : await adapter.exportBundle(home());
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
  project?: string,
): Promise<void> {
  const adapter = getAdapter(client);
  const base = project ?? home();
  const { files, warnings } = project
    ? await getProjectAdapter(adapter.id).planImport(bundle, project, importOpts)
    : await adapter.planImport(bundle, home(), importOpts);
  const allWarnings = [...priorWarnings, ...warnings];
  if (!json) printWarnings(allWarnings);

  let backupDir: string | undefined;
  if (apply && files.length) {
    backupDir = await backupPaths(files, base);
    await applyPlans(files, base);
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
    console.log(`dry-run: would write ${files.length} file(s) under ${base} (use --apply to write):`);
    for (const f of files) console.log(`  ${project ? `${project}/` : "~/"}${f.path}`);
    return;
  }
  if (backupDir) console.log(`backed up existing files to ${backupDir}`);
  console.log(`wrote ${files.length} file(s)`);
  console.log(`migrated: ${summaryLine(bundle)}`);
}

program
  .command("export")
  .description("export a client's setup into an agentmove bundle directory")
  .argument("<client>", `source client (${CLIENT_IDS.join("|")})`)
  .option("-o, --out <dir>", "bundle output directory", "./agentmove-bundle")
  .option("--include-secrets", "keep likely-secret env/header values instead of redacting", false)
  .option("--only <layers>", "comma-separated layers to export (mcp,skills,memory,instructions,persona)")
  .option("--project <dir>", "export the client's project-scoped files from a project directory")
  .option("--mif <file>", "also write the memory layer as a MIF v2 document (.mif.json)")
  .option("--json", "machine-readable JSON output", false)
  .action(
    async (
      client: string,
      opts: {
        out: string;
        includeSecrets: boolean;
        only?: string;
        project?: string;
        mif?: string;
        json: boolean;
      },
    ) => {
      const collected: string[] = [];
      let bundle = await exportFrom(
        client,
        opts.includeSecrets,
        opts.json ? collected : undefined,
        opts.project,
      );
      if (opts.only) bundle = filterBundle(bundle, parseLayers(opts.only));
      await writeBundle(bundle, opts.out);
      if (opts.mif) {
        const doc = toMif(bundle.memory, bundle.manifest.exportedAt ?? new Date().toISOString());
        await fs.writeFile(opts.mif, JSON.stringify(doc, null, 2) + "\n");
      }
      if (opts.json) {
        process.stdout.write(
          JSON.stringify(
            {
              out: opts.out,
              mif: opts.mif ?? null,
              summary: bundleSummary(bundle),
              warnings: collected,
            },
            null,
            2,
          ) + "\n",
        );
        return;
      }
      console.log(`exported ${summaryLine(bundle)} to ${opts.out}`);
      if (opts.mif) console.log(`wrote ${bundle.memory.length} memory entr(ies) as MIF to ${opts.mif}`);
    },
  );

program
  .command("import")
  .description("import an agentmove bundle into a client (dry-run by default)")
  .argument("<client>", "target client")
  .option("-i, --in <dir>", "bundle directory", "./agentmove-bundle")
  .option("--apply", "actually write files (default is dry-run preview)", false)
  .option("--replace-mcp", "replace the target's MCP servers instead of merging into them", false)
  .option("--only <layers>", "comma-separated layers to import (mcp,skills,memory,instructions,persona)")
  .option("--project <dir>", "import into the client's project-scoped files in a project directory")
  .option("--mif <file>", "import the memory layer from a MIF v2 document instead of a bundle")
  .option("--json", "machine-readable JSON output", false)
  .action(
    async (
      client: string,
      opts: {
        in: string;
        apply: boolean;
        replaceMcp: boolean;
        only?: string;
        project?: string;
        mif?: string;
        json: boolean;
      },
    ) => {
      const mifWarnings: string[] = [];
      let bundle: Bundle;
      if (opts.mif) {
        bundle = emptyBundle();
        bundle.memory = fromMif(opts.mif, await fs.readFile(opts.mif, "utf8"), mifWarnings);
      } else if (await isPackFile(opts.in)) {
        const passphrase = requirePassphrase(process.env.AGENTMOVE_PASSPHRASE);
        bundle = decryptBundle(await fs.readFile(opts.in), passphrase, opts.in);
      } else {
        bundle = await readBundle(opts.in);
      }
      if (opts.only) bundle = filterBundle(bundle, parseLayers(opts.only));
      await importTo(
        client,
        bundle,
        opts.apply,
        { replaceMcp: opts.replaceMcp },
        opts.json,
        mifWarnings,
        opts.project,
      );
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
  .option("--only <layers>", "comma-separated layers to migrate (mcp,skills,memory,instructions,persona)")
  .option("--project <dir>", "migrate the clients' project-scoped files in a project directory")
  .option("--json", "machine-readable JSON output", false)
  .action(
    async (
      from: string,
      to: string,
      opts: {
        apply: boolean;
        includeSecrets: boolean;
        replaceMcp: boolean;
        only?: string;
        project?: string;
        json: boolean;
      },
    ) => {
      const collected: string[] = [];
      let bundle = await exportFrom(
        from,
        opts.includeSecrets,
        opts.json ? collected : undefined,
        opts.project,
      );
      if (opts.only) bundle = filterBundle(bundle, parseLayers(opts.only));
      await importTo(
        to,
        bundle,
        opts.apply,
        { replaceMcp: opts.replaceMcp },
        opts.json,
        collected,
        opts.project,
      );
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
  .command("pack")
  .description("encrypt a bundle directory into a single portable file (AES-256-GCM)")
  .argument("<bundle>", "bundle directory to pack")
  .option("-o, --out <file>", "output file", "./agent.agentpack")
  .option("--json", "machine-readable JSON output", false)
  .action(async (bundleDir: string, opts: { out: string; json: boolean }) => {
    const passphrase = requirePassphrase(process.env.AGENTMOVE_PASSPHRASE);
    const bundle = await readBundle(bundleDir);
    await fs.writeFile(opts.out, encryptBundle(bundle, passphrase));
    if (opts.json) {
      process.stdout.write(
        JSON.stringify({ out: opts.out, summary: bundleSummary(bundle) }, null, 2) + "\n",
      );
    } else {
      console.log(`packed ${bundleDir} -> ${opts.out} (${summaryLine(bundle)})`);
    }
  });

program
  .command("unpack")
  .description("decrypt an agentpack file back into a bundle directory")
  .argument("<file>", "agentpack file to unpack")
  .option("-o, --out <dir>", "bundle output directory", "./agentmove-bundle")
  .option("--json", "machine-readable JSON output", false)
  .action(async (file: string, opts: { out: string; json: boolean }) => {
    const passphrase = requirePassphrase(process.env.AGENTMOVE_PASSPHRASE);
    const bundle = decryptBundle(await fs.readFile(file), passphrase, file);
    await writeBundle(bundle, opts.out);
    if (opts.json) {
      process.stdout.write(
        JSON.stringify({ out: opts.out, summary: bundleSummary(bundle) }, null, 2) + "\n",
      );
    } else {
      console.log(`unpacked ${file} -> ${opts.out} (${summaryLine(bundle)})`);
    }
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
  .argument("<shell>", "bash, zsh, or fish")
  .action((shell: string) => {
    process.stdout.write(completionScript(shell));
  });

// Exit-code contract: 0 success, 1 unexpected error, 2 usage error, 3 bad input data.
program.parseAsync().catch((e: unknown) => {
  const err = e as NodeJS.ErrnoException;
  const debug = program.opts<{ debug: boolean }>().debug || process.env.AGENTMOVE_DEBUG === "1";
  let message = err.message;
  if (err.code === "EACCES" || err.code === "EPERM") {
    message += " (check file/directory permissions, or rerun with a writable --home)";
  }
  console.error(`error: ${message}`);
  if (debug && err.stack) console.error(err.stack);
  else if (!(e instanceof CliError)) {
    console.error("(rerun with --debug or AGENTMOVE_DEBUG=1 for a stack trace)");
  }
  process.exitCode = e instanceof CliError ? e.exitCode : 1;
});
