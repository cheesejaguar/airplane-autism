/**
 * Validates family JSON files: schema, ids, cross references.
 *   pnpm tsx scripts/pipeline/validate-families.ts [--group A] [--commons]
 * --commons additionally checks that each commonsCategories entry exists on Wikimedia Commons.
 */
import { fetchJson, loadFamilies, readPlan } from "./lib";

const args = process.argv.slice(2);
const group = args.includes("--group") ? args[args.indexOf("--group") + 1] : undefined;
const checkCommons = args.includes("--commons");

const plan = readPlan();
const planIds = new Set(plan.map((p) => p.id));
const { families, errors } = loadFamilies();
const byId = new Map(families.map((f) => [f.id, f]));
const warnings: string[] = [];

const scope = group ? families.filter((f) => plan.find((p) => p.id === f.id)?.group === group) : families;

for (const f of scope) {
  if (!planIds.has(f.id)) warnings.push(`${f.id}: not in catalog-plan.json (ok if intentionally added — add it to the plan)`);
  for (const c of f.confusedWith) {
    if (c.id === f.id) errors.push(`${f.id}: confusedWith references itself`);
    if (!planIds.has(c.id) && !byId.has(c.id)) errors.push(`${f.id}: confusedWith unknown id "${c.id}"`);
  }
  const lower = f.tellTales.join(" ").toLowerCase();
  for (const n of [f.shortName, f.name].filter(Boolean) as string[]) {
    if (lower.includes(n.toLowerCase())) errors.push(`${f.id}: tellTales must not name the aircraft ("${n}")`);
  }
}

if (group) {
  const missing = plan.filter((p) => p.group === group && !byId.has(p.id)).map((p) => p.id);
  if (missing.length) warnings.push(`group ${group} missing files: ${missing.join(", ")}`);
}

if (checkCommons) {
  for (const f of scope) {
    for (const cat of f.commonsCategories) {
      const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=categoryinfo&titles=${encodeURIComponent("Category:" + cat)}`;
      const data = await fetchJson<{ query: { pages: Record<string, { missing?: string; categoryinfo?: { files: number; size: number } }> } }>(url);
      const page = Object.values(data.query.pages)[0];
      if (page.missing !== undefined) errors.push(`${f.id}: Commons category not found: "${cat}"`);
      else if ((page.categoryinfo?.size ?? 0) === 0) errors.push(`${f.id}: Commons category is empty (likely a redirect): "${cat}"`);
      else if ((page.categoryinfo?.files ?? 0) < 3) warnings.push(`${f.id}: Commons category "${cat}" has only ${page.categoryinfo?.files ?? 0} direct files (subcategories are crawled, so this may be fine)`);
    }
  }
}

for (const w of warnings) console.warn("WARN ", w);
for (const e of errors) console.error("ERROR", e);
console.log(`\n${scope.length} families checked, ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
