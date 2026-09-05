/**
 * Kører alle enhedstests. Ingen testframework — bare Node.
 *   npm test
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const filer = readdirSync(here).filter((f) => f.endsWith(".test.mjs")).sort();

let fejlede = 0;
for (const fil of filer) {
  console.log(`\n\x1b[1m── ${fil} ──\x1b[0m`);
  const r = spawnSync(process.execPath, [join(here, fil)], { stdio: "inherit" });
  if (r.status !== 0) fejlede++;
}

console.log(
  fejlede === 0
    ? `\n\x1b[32mAlle ${filer.length} testfiler bestået\x1b[0m\n`
    : `\n\x1b[31m${fejlede} af ${filer.length} testfiler fejlede\x1b[0m\n`
);
process.exit(fejlede ? 1 : 0);
