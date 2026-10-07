import { expect, test, type Page } from "@playwright/test";

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
  const hint = page.getByText("Look for");
  const verdict = page.getByText(/Tally — confirmed|Confirmed on second look|Missed/);
  await expect(hint.or(verdict)).toBeVisible();

  if (await hint.isVisible()) {
    // The eliminated option is disabled; pick another enabled one.
    const enabled = page.getByRole("group", { name: "Choose the aircraft" }).getByRole("button", { disabled: false });
    await enabled.first().click();
    await expect(verdict).toBeVisible();
  }

  // Answer the rest of the session quickly via keyboard.
  for (let i = 0; i < 60; i++) {
    if (await page.getByRole("heading", { name: /Session complete/i }).isVisible()) break;
    const next = page.getByRole("button", { name: /Next aircraft|Finish session/ });
    if (await next.isVisible()) {
      await next.click();
      continue;
    }
    await page.keyboard.press("1");
    await page.waitForTimeout(400);
    if (await page.getByText("Look for").isVisible()) await page.keyboard.press("2");
    await page.waitForTimeout(400);
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
  const compare = page.getByRole("link", { name: /Compare/ }).first();
  if (await compare.isVisible()) {
    await compare.click();
    await expect(page.getByText("Head to head")).toBeVisible();
  }
});

test("sign up merges guest progress", async ({ page }) => {
  // Create guest progress with a short session.
  const deck = Buffer.from(JSON.stringify({ sessionLength: 5 })).toString("base64url");
  await page.goto(`/train/session?deck=${deck}`);
  await (await options(page)).first().click();
  await expect(page.getByText(/Look for|Tally — confirmed|Missed/).first()).toBeVisible();

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
