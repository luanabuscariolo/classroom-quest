import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destination = path.resolve(root, "dist");
// Only this generated directory can be replaced; never copy the whole repository.
if (
  path.dirname(destination) !== root ||
  path.basename(destination) !== "dist"
) {
  throw Error("Diretório de publicação inválido.");
}
await fs.rm(destination, { recursive: true, force: true });
await fs.mkdir(destination);
for (const name of ["index.html", ".nojekyll", "assets", "src"]) {
  await fs.cp(path.join(root, name), path.join(destination, name), {
    recursive: true,
  });
}
console.log(
  "Site estático preparado em dist/ (sem backups, testes ou dependências).",
);
