// Writes TIC_DEMO_5X.json: a backup with the fictitious class 5ºX, ready to
// import ("Restaurar / importar" → "Importar como novas turmas").
import fs from "node:fs";
import { packageBackup } from "../src/backup.js";
import { buildDemoWorkspace } from "./demo-data.js";

const file = "TIC_DEMO_5X.json";
fs.writeFileSync(
  file,
  JSON.stringify(packageBackup(buildDemoWorkspace()), null, 2),
);
console.log("Turma de demonstração criada em " + file + " (dados fictícios).");
