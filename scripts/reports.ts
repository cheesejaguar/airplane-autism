/**
 * User reports of mislabeled photos / inaccurate data.
 *   pnpm reports export [--status open] [--out .cache/reports/open-reports.md] [--json]
 *   pnpm reports resolve <id...> --status fixed|dismissed [--note "what was done"]
 *   pnpm reports list
 * Reads DATABASE_URL from .env.local. The markdown brief is what Claude works from (/fix-reports).
 */
import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { desc, eq, inArray, sql } from "drizzle-orm";

config({ path: path.resolve(import.meta.dirname, "../.env.local"), quiet: true });

const { db } = await import("../src/db");
const { report } = await import("../src/db/schema");
const { groupReports, reportsBrief } = await import("../src/lib/reports/brief");

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name: string) => (rest.includes(`--${name}`) ? rest[rest.indexOf(`--${name}`) + 1] : undefined);

try {
  if (cmd === "export") {
    const status = flag("status") ?? "open";
    const rows = await db.select().from(report).where(eq(report.status, status)).orderBy(desc(report.createdAt));
    if (rest.includes("--json")) {
      console.log(JSON.stringify(groupReports(rows), null, 2));
    } else {
      const out = flag("out") ?? path.join(".cache", "reports", `${status}-reports.md`);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, reportsBrief(rows) + "\n");
      console.log(`${rows.length} ${status} reports across ${groupReports(rows).length} items → ${out}`);
    }
  } else if (cmd === "resolve") {
    const ids = rest.filter((a, i) => !a.startsWith("--") && !rest[i - 1]?.startsWith("--"));
    const status = flag("status");
    if (!ids.length || !["fixed", "dismissed", "open"].includes(status ?? "")) {
      throw new Error('usage: pnpm reports resolve <id...> --status fixed|dismissed [--note "…"]');
    }
    const updated = await db
      .update(report)
      .set({ status: status!, resolution: flag("note") ?? null, resolvedAt: status === "open" ? null : new Date() })
      .where(inArray(report.id, ids))
      .returning({ id: report.id });
    console.log(`marked ${updated.length}/${ids.length} reports ${status}`);
  } else if (cmd === "list") {
    const rows = await db.select({ status: report.status, n: sql<number>`count(*)::int` }).from(report).groupBy(report.status);
    console.log(rows.map((r) => `${r.status}: ${r.n}`).join("\n") || "no reports");
  } else {
    console.log("usage: pnpm reports export|resolve|list");
    process.exitCode = 1;
  }
} finally {
  await db.$client.end();
}
