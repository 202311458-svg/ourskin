import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();

async function requirePatterns(relativePath, patterns) {
  const source = await readFile(resolve(root, relativePath), "utf8");
  const missing = patterns.filter((pattern) => !source.includes(pattern));

  if (missing.length > 0) {
    throw new Error(
      `${relativePath} is missing accessibility guard(s): ${missing.join(", ")}`
    );
  }
}

await requirePatterns("src/app/components/AuthModal.tsx", [
  'role="dialog"',
  'aria-modal="true"',
  "aria-labelledby={titleId}",
  "aria-describedby={descriptionId}",
  'aria-label={showPassword ? "Hide password" : "Show password"}',
  'autoComplete="email"',
  'autoComplete="current-password"',
]);

await requirePatterns("src/app/components/portal/PortalFrame.tsx", [
  'className={styles.skipLink}',
  'href="#portal-content"',
  'id="portal-content"',
  'aria-current={active ? "page" : undefined}',
]);

await requirePatterns("src/app/components/ProfileContent.tsx", [
  'autoComplete="current-password"',
  'autoComplete="new-password"',
  'aria-expanded={showPasswordForm}',
  'aria-controls="password-change-form"',
]);

await requirePatterns("src/app/pages/patient/home/page.tsx", [
  'redirect("/pages/patient/dashboard")',
]);

await requirePatterns("src/app/components/portal/navigation.tsx", [
  'admin: "/pages/admin/profile"',
]);

console.log("Shared accessibility smoke checks passed.");
