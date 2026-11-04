import { expect, test } from "@playwright/test";

test.describe("customer: join and ticket", () => {
  test("empty form shows what is missing, without leaving the page", async ({ page }) => {
    await page.goto("/demo/join");
    await page.getByRole("button", { name: "احجز دوري" }).click();
    await expect(page.locator("[aria-invalid=true]")).toHaveCount(3); // name, phone, code
    await expect(page.getByRole("alert").filter({ hasText: "اختار الخدمة" })).toBeVisible();
    await expect(page).toHaveURL(/\/demo\/join$/);
  });

  test("wrong code is explained; right code opens the ticket", async ({ page }) => {
    await page.goto("/demo/join");
    await page.getByLabel("اسمك").fill("أحمد");
    await page.getByLabel("رقم الموبايل").fill("٠١٠٩٩٩٩٨٨٨٧"); // Arabic digits on purpose
    await page.getByRole("radio", { name: /قصة \+ دقن/ }).click();
    await page.getByRole("button", { name: "فوطة سخنة" }).click();
    await expect(page.getByText(/حوالي 40 دقيقة/)).toBeVisible();

    await page.getByLabel("كود المحل").fill("1111");
    await page.getByRole("button", { name: "احجز دوري" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "الكود غلط" })).toBeVisible();

    await page.getByLabel("كود المحل").fill("4827");
    await page.getByRole("button", { name: "احجز دوري" }).click();
    await expect(page).toHaveURL(/\/demo\/status$/);
    await expect(page.getByText("رقمك", { exact: true })).toBeVisible();
  });

  test("kids tab switches the service list", async ({ page }) => {
    await page.goto("/demo/join");
    await page.getByRole("button", { name: "أطفال" }).click();
    await expect(page.getByRole("radio", { name: /أول قصة/ })).toBeVisible();
    await expect(page.getByRole("radio", { name: /حلاقة زيرو/ })).toHaveCount(0);
  });

  test("leaving the queue asks first, then confirms", async ({ page }) => {
    await page.goto("/demo/status");
    await page.getByRole("button", { name: "اخرج من الدور" }).click();
    await page.getByRole("button", { name: "لأ، خليني" }).click();
    await expect(page.getByText("قدامك", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "اخرج من الدور" }).click();
    await page.getByRole("button", { name: "أيوه، اخرج" }).click();
    await expect(page.getByText("خرجت من الدور")).toBeVisible();
  });

  test("delete my data shows a confirmation that survives the page change", async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await page.goto("/demo/status");
    await page.getByRole("button", { name: "امسح بياناتي" }).click();
    await expect(page.getByText("اتمسح اسمك ورقمك")).toBeVisible();
  });

  test("when called, the customer sees the shop's limit to come back", async ({ page }) => {
    await page.goto("/demo/status");
    await page.getByRole("button", { name: "تجربة: اتنده عليا" }).click();
    await expect(page.getByText("دورك دلوقتي!")).toBeVisible();
    await expect(page.getByText("ارجع خلال 10 دقايق")).toBeVisible();
    await expect(page.getByRole("button", { name: "اخرج من الدور" })).toHaveCount(0);
  });
});
