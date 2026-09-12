import { readdir, readFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";

const root = process.cwd();
const adminRoot = resolve(root, "src/app/pages/admin");

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else if (entry.isFile() && entry.name.endsWith(".tsx")) files.push(fullPath);
  }
  return files;
}

const forbidden = [
  ["localStorage session state", /\blocalStorage\b/],
  ["sessionStorage session state", /\bsessionStorage\b/],
  ["browser alert dialog", /\balert\s*\(/],
  ["browser confirm dialog", /\bconfirm\s*\(/],
  ["legacy PortalShell wrapper", /\bPortalShell\b/],
  ["legacy staffLayout wrapper", /\bstaffLayout\b/],
  ["manual Authorization header", /\bAuthorization\s*:/],
];

const files = await walk(adminRoot);
const failures = [];

for (const file of files) {
  const source = await readFile(file, "utf8");
  const displayPath = relative(root, file);
  for (const [label, pattern] of forbidden) {
    if (pattern.test(source)) failures.push(`${displayPath}: ${label}`);
  }

  if (basename(file) === "page.tsx" && !source.includes("PageShell")) {
    failures.push(`${displayPath}: Admin route is missing PageShell`);
  }
}

if (failures.length > 0) {
  throw new Error(`Admin quality checks failed:\n- ${failures.join("\n- ")}`);
}

console.log(`Admin quality checks passed across ${files.length} TSX files.`);
