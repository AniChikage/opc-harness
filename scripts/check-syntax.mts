import { fileURLToPath } from 'node:url';
import { spawnSync } from "node:child_process";
import path from "node:path";
import { filesIn } from "../src/core.mjs";
const root=fileURLToPath(new URL('../',import.meta.url));
for (const dir of ["bin", "src", "templates", "scripts"])
  for (const file of await filesIn(path.join(root,dir))) {
    if (!/\.(mjs|js)$/.test(file)) continue;
    const r = spawnSync(process.execPath, ["--check", path.join(root,dir, file)], {
      stdio: "inherit",
    });
    if (r.status !== 0) process.exit(1);
  }
console.log("All JavaScript syntax checks passed.");
