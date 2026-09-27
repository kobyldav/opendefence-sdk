import { rm } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
const root = new URL("../", import.meta.url);
await rm(new URL("../dist-tests/", import.meta.url), { recursive: true, force: true });
const packages = new URL("../packages/", import.meta.url);
for (const entry of await readdir(packages, { withFileTypes: true })) {
  if (entry.isDirectory()) {
    await rm(join(packages.pathname, entry.name, "dist"), { recursive: true, force: true });
    await rm(join(packages.pathname, entry.name, "tsconfig.tsbuildinfo"), { force: true });
  }
}
