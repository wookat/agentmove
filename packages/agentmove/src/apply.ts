import { promises as fs } from "node:fs";
import path from "node:path";
import { FilePlan } from "./model.js";
import { exists } from "./fsutil.js";

/**
 * Back up every file a plan would overwrite into
 * `<home>/.agentmove/backups/<timestamp>/`, preserving relative paths.
 * Returns the backup directory, or undefined when nothing needed backing up.
 */
export async function backupPaths(plans: FilePlan[], home: string): Promise<string | undefined> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(home, ".agentmove/backups", stamp);
  let any = false;
  for (const plan of plans) {
    const target = path.join(home, plan.path);
    if (!(await exists(target))) continue;
    const dest = path.join(backupDir, plan.path);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(target, dest);
    any = true;
  }
  return any ? backupDir : undefined;
}

export async function applyPlans(plans: FilePlan[], home: string): Promise<void> {
  for (const plan of plans) {
    const target = path.join(home, plan.path);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, plan.content);
  }
}
