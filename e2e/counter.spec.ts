import { expect, test } from "@playwright/test";

test.describe("counter screen", () => {
  test("Next seats the right customer and skips one who asked for another barber", async ({ page }) => {
    await page.goto("/demo/counter");
    const mohamed = page.locator("section[aria-label='الحلاقين'] > *").filter({ hasText: "محمد" });
    await mohamed.getByRole("button", { name: "خلص، التالي" }).click();
    await expect(mohamed.getByText("كريم")).toBeVisible(); // ticket 13 in the chair
    await expect(mohamed.getByText("اللي عليه: 15 عمر")).toBeVisible(); // 14 asked for Karim
  });

  test("reorder, walk-in and duty toggle", async ({ page }) => {
    await page.goto("/demo/counter");
    const list = page.getByRole("complementary", { name: "المستنيين" });
    await list.getByRole("button", { name: "طلّع مصطفى لفوق" }).click();
    await expect(list.locator("li").first()).toContainText("مصطفى");

    await page.getByRole("button", { name: "+ زبون من غير موبايل" }).click();
    await page.getByLabel("اسم الزبون").fill("عم سيد");
    await page.getByRole("button", { name: "أضف" }).click();
    await expect(list.locator("li").last()).toContainText("عم سيد");

    const karim = page.locator("section[aria-label='الحلاقين'] > *").filter({ hasText: "كريم" }).first();
    await karim.getByRole("button", { name: "شغال النهارده" }).click();
    await expect(karim.getByRole("button", { name: /التالي/ })).toBeDisabled();
  });

  test("TV shows chairs, next numbers and the code, and no customer names", async ({ page }) => {
    await page.goto("/demo/tv");
    await expect(page.getByText("4827")).toBeVisible();
    await expect(page.locator("ol li")).toHaveText(["13", "14", "15", "16", "17"]);
    await expect(page.locator("body")).not.toContainText("مصطفى");
  });

  test("tapping the code shows it full screen for the customer, and back closes it", async ({ page }) => {
    await page.goto("/demo/counter");
    await page.getByRole("button", { name: /كود الدخول 4827/ }).click();
    const dialog = page.getByRole("dialog", { name: "كود الدخول" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("4827")).toBeVisible();
    await dialog.getByRole("button", { name: "رجوع" }).click();
    await expect(dialog).toHaveCount(0);
  });
});
