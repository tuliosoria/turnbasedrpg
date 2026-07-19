import { test, expect } from "@playwright/test";

test.describe("Ravenloft smoke", () => {
  test("landing renders heading and the three CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Inverno dos Mortos/i }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^Criar conta$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Entrar$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Entrar como Admin/i })).toBeVisible();
    await page.screenshot({ path: "test-results/landing.png" });
  });

  test("fog particle canvas fills the viewport and is painting", async ({ page }) => {
    await page.goto("/");
    const fog = page.getByTestId("fog");
    await expect(fog).toBeAttached();

    const box = await fog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(1000);
    expect(box!.height).toBeGreaterThan(600);

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
  });

  test("create-account wizard opens on its first step", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^Criar conta$/i }).click();
    await expect(page.getByRole("heading", { name: /^Criar conta$/i })).toBeVisible();
    await expect(page.getByLabel(/Nome de exibição/i)).toBeVisible();
    await page.screenshot({ path: "test-results/criar.png" });
  });

  test("full create flow reaches the game screen (mock API)", async ({ page }) => {
    await page.goto("/criar");
    // Step 1: Conta
    await page.getByLabel(/Nome de exibição/i).fill("Ana");
    await page.getByRole("button", { name: /Próximo/i }).click();
    // Step 2: Identidade
    await page.getByLabel(/Nome da Casa/i).fill("Casa Teste");
    await page.getByLabel(/Lema/i).fill("Resistir");
    await page.getByLabel(/Líder/i).fill("Lorde A");
    await page.getByLabel(/Herdeiro/i).fill("Sera A");
    await page.getByLabel(/Castelo/i).fill("Forte");
    await page.getByLabel(/Terras e vilas/i).fill("Vilas do norte");
    await page.getByLabel(/História/i).fill("Uma casa antiga.");
    await page.getByLabel(/Especialidade/i).fill("Defesa");
    await page.getByLabel(/Fraqueza/i).fill("Poucos alimentos");
    await page.getByRole("button", { name: /Próximo/i }).click();
    // Step 3: Atributos — default distribution already sums to 10 (valid)
    await expect(page.getByText(/Pontos restantes: 0/i)).toBeVisible();
    await page.getByRole("button", { name: /Próximo/i }).click();
    // Step 4: Revisão → Fundar
    await page.getByRole("button", { name: /Fundar a Casa/i }).click();
    await expect(page.getByText(/Guarde este código/i)).toBeVisible();
    await page.getByRole("button", { name: /Entrar no jogo/i }).click();
    await expect(page.getByRole("heading", { name: /Sua Casa/i })).toBeVisible();
    await page.screenshot({ path: "test-results/game.png" });
  });

  test("login and admin pages render their forms", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /entrar com seu código/i })).toBeVisible();
    await expect(page.getByLabel(/código do jogador/i)).toBeVisible();

    await page.goto("/admin");
    await expect(page.getByLabel(/código de admin/i)).toBeVisible();
    await page.screenshot({ path: "test-results/admin.png" });
  });
});
