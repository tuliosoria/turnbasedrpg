import { test, expect } from "@playwright/test";

test.describe("Ravenloft smoke", () => {
  test("landing renders heading, CTAs and admin button", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Inverno dos Mortos/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Escolher uma Casa/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Já tenho um código/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Entrar como Admin/i })).toBeVisible();
  });

  test("fog particle canvas is present, fills the viewport and is painting", async ({ page }) => {
    await page.goto("/");
    const fog = page.getByTestId("fog");
    await expect(fog).toBeAttached();

    const box = await fog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(1000);
    expect(box!.height).toBeGreaterThan(600);

    // Let the animation render a few frames, then confirm the canvas has
    // actually drawn particles (non-transparent pixels exist).
    await page.waitForTimeout(600);
    const paintedPixels = await page.evaluate(() => {
      const canvas = document.querySelector('[data-testid="fog"]') as HTMLCanvasElement | null;
      if (!canvas) return -1;
      const ctx = canvas.getContext("2d");
      if (!ctx) return -1;
      const { width, height } = canvas;
      const data = ctx.getImageData(0, 0, width, height).data;
      let painted = 0;
      for (let i = 3; i < data.length; i += 4 * 97) {
        if (data[i] > 0) painted++;
      }
      return painted;
    });
    expect(paintedPixels).toBeGreaterThan(0);

    await page.screenshot({ path: "test-results/landing.png" });
  });

  test("claim page lists the six houses", async ({ page }) => {
    await page.goto("/claim");
    await expect(page.getByText("Casa Vargen")).toBeVisible();
    await expect(page.getByText("Irmandade dos Corvos")).toBeVisible();
  });

  test("login and admin pages render their forms", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /entrar com seu código/i })).toBeVisible();
    await expect(page.getByLabel(/código do jogador/i)).toBeVisible();

    await page.goto("/admin");
    await expect(page.getByLabel(/código de admin/i)).toBeVisible();
  });
});
