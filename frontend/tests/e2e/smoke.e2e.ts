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

  test("fog layer is present, covers the viewport and is visibly opaque", async ({ page }) => {
    await page.goto("/");
    const fog = page.getByTestId("fog");
    await expect(fog).toBeAttached();

    const box = await fog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(1000);
    expect(box!.height).toBeGreaterThan(600);

    // The fog's gradient layers must be meaningfully opaque (not the faint
    // near-invisible version that shipped earlier).
    const maxOpacity = await page.evaluate(() => {
      const fogEl = document.querySelector('[data-testid="fog"]');
      if (!fogEl) return 0;
      const kids = Array.from(fogEl.children) as HTMLElement[];
      const opacities = kids.map((k) => parseFloat(getComputedStyle(k).opacity || "0"));
      return opacities.length ? Math.max(...opacities) : 0;
    });
    expect(maxOpacity).toBeGreaterThan(0.3);

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
