// Copia os ícones (.svg/.png) de nodes/ e credentials/ para dist/ preservando
// a estrutura de pastas. O tsc só compila .ts, então os assets precisam ser
// copiados manualmente para o n8n encontrar o ícone do node.
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sources = ["nodes", "credentials"];
const exts = new Set([".svg", ".png"]);

function walk(dir, onFile) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, onFile);
    else if (exts.has(path.extname(entry.name).toLowerCase())) onFile(full);
  }
}

let copied = 0;
for (const src of sources) {
  const base = path.join(root, src);
  walk(base, (file) => {
    const rel = path.relative(root, file);
    const dest = path.join(root, "dist", rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(file, dest);
    copied += 1;
  });
}

console.log(`[copy-icons] ${copied} asset(s) copiado(s) para dist/`);
