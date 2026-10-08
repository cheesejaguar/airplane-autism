import { expect, test, type Page } from "@playwright/test";

// Deterministic drills: no auto-advance racing the test's clicks.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("tally:auto-advance", "off"));
});

/** Answers the current question wrong first (if possible), returning the option labels. */
async function options(page: Page) {
  const group = page.getByRole("group", { name: "Choose the aircraft" });
  await expect(group).toBeVisible();
  return group.getByRole("button");
}

test("guest drill: wrong answer shows a hint, second miss reveals, session summary, stats", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Start training" }).first().click();
  await expect(page).toHaveURL(/\/train$/);
  await page.getByRole("button", { name: /Start drill/ }).click();
  await expect(page).toHaveURL(/\/train\/session/);

  // First question: pick options until we get either a retry hint or a correct reveal.
  const opts = await options(page);
  await opts.first().click();
  // Next keeps previously visited pages mounted (hidden), so scope to the live hint panel.
  const hint = page.getByRole("status").filter({ hasText: "Look for" });
  const verdict = page.getByText(/Tally — confirmed|Confirmed on second look|Missed/);
  await expect(hint.or(verdict)).toBeVisible();

  if (await hint.isVisible()) {
    // The eliminated option is disabled; pick another enabled one.
    const enabled = page.getByRole("group", { name: "Choose the aircraft" }).getByRole("button", { disabled: false });
    await enabled.first().click();
    await expect(verdict).toBeVisible();
  }

  // Answer the rest of the session with the keyboard shortcuts (1–4 answer, Enter = next).
  const done = page.getByRole("heading", { name: /Session complete/i });
  for (let i = 0; i < 80 && !(await done.isVisible()); i++) {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    await page.keyboard.press("1");
    await page.waitForTimeout(500);
    await page.keyboard.press("2");
    await page.waitForTimeout(500);
  }
  await expect(page.getByRole("heading", { name: /Session complete/i })).toBeVisible();

  await page.getByRole("link", { name: "See your stats" }).click();
  await expect(page.getByText("Current rank")).toBeVisible();
  await expect(page.getByText("You're training as a guest")).toBeVisible();
});

test("deck filter: rotorcraft-only deck only asks about rotorcraft", async ({ page }) => {
  await page.goto("/train");
  await page.getByRole("button", { name: /^Rotorcraft/ }).first().click();
  const ready = page.locator("aside").getByText("aircraft ready");
  await expect(ready).toBeVisible();
  await page.getByRole("button", { name: /Start drill/ }).click();
  await expect(page).toHaveURL(/deck=/);
  const url = new URL(page.url());
  const deck = JSON.parse(Buffer.from(url.searchParams.get("deck")!, "base64url").toString());
  expect(deck.categories).toEqual(expect.arrayContaining(["rotorcraft"]));
});

test("exposure 1s hides the photo", async ({ page }) => {
  const deck = Buffer.from(JSON.stringify({ exposure: "1s", sessionLength: 5 })).toString("base64url");
  await page.goto(`/train/session?deck=${deck}`);
  await expect(page.getByText("Contact lost")).toBeVisible({ timeout: 20_000 });
});

test("study page and compare page render", async ({ page }) => {
  await page.goto("/study");
  const first = page.locator("ul a[href^='/study/']").first();
  await first.click();
  await expect(page.getByRole("heading", { name: "WEFT breakdown" })).toBeVisible();
  const href = await page.locator("a[href^='/compare/']").first().getAttribute("href");
  if (href) {
    await page.goto(href);
    await expect(page.getByText("Head to head")).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
  }
});

test("sign up merges guest progress", async ({ page }) => {
  // Create guest progress with a short session.
  const deck = Buffer.from(JSON.stringify({ sessionLength: 5 })).toString("base64url");
  await page.goto(`/train/session?deck=${deck}`);
  await (await options(page)).first().click();
  await expect(page.getByRole("status").filter({ hasText: /Look for|Tally — confirmed|Missed/ }).first()).toBeVisible();

  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("E2E Pilot");
  await page.getByLabel("Email").fill(`e2e+${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/stats/);
  await expect(page.getByText("Current rank")).toBeVisible();
  await expect(page.getByText("You're training as a guest")).toHaveCount(0);
  await expect(page.getByText("Your logbook is empty")).toHaveCount(0);
});

test("report a mislabeled photo from a study page; admin page is hidden from non-admins", async ({ page }) => {
  await page.goto("/study/c172");
  await page.getByRole("button", { name: "Report this photo" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: /different aircraft/ }).click();
  await dialog.getByRole("button", { name: /Pick the correct aircraft/ }).click();
  await page.getByPlaceholder("Search aircraft…").fill("182");
  await page.getByRole("option", { name: /182/ }).first().click();
  await dialog.getByLabel(/Details/).fill("E2E test report — cowling looks like a 182");
  await dialog.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByText("Report sent")).toBeVisible();

  const res = await page.goto("/admin/reports");
  expect(res?.status()).toBe(404);
});

test("admin triages reports and copies the Claude brief", async ({ page, context }) => {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  test.skip(!email || !password, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set (see .env.development.local)");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  // Sign in, or create the admin account on first run.
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  if (!(await page.waitForURL(/\/stats/, { timeout: 5000 }).then(() => true).catch(() => false))) {
    await page.goto("/sign-up");
    await page.getByLabel("Name").fill("Tally Admin");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/stats/);
  }

  // File a report so there is something to triage.
  await page.goto("/study/b737ng");
  await page.getByRole("button", { name: "Report this photo" }).click();
  await page.getByRole("dialog").getByRole("radio", { name: /viewing angle/ }).click();
  await page.getByRole("dialog").getByLabel(/Details/).fill("E2E test report — admin flow");
  await page.getByRole("dialog").getByRole("button", { name: "Send report" }).click();
  await expect(page.getByText("Report sent")).toBeVisible();

  await page.goto("/admin/reports");
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  await page.getByRole("button", { name: "Copy for Claude" }).click();
  await expect(page.getByText("Brief copied")).toBeVisible();
  const brief = await page.evaluate(() => navigator.clipboard.readText());
  expect(brief).toContain("# Tally — open aircraft reports");
  expect(brief).toContain("b737ng");

  // Dismiss only the reports E2E runs created — the database may hold real user reports.
  const e2eItems = page.locator("li").filter({ hasText: "E2E test report" });
  // (Desktop and mobile runs may be dismissing the same items concurrently.)
  for (let i = 0; i < 10 && (await e2eItems.count()); i++) {
    await e2eItems.first().getByRole("button", { name: "Dismiss" }).click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);
  }
  await page.reload();
  await expect(e2eItems).toHaveCount(0);
});
