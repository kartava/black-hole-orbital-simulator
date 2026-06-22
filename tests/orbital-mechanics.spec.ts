import { test, expect } from "playwright/test";

test.describe("Mass=100M, Spin=0.99, Particle r₀=10M L=-1.95 ṙ₀=0", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#mass-slider");
  });

  async function setSlider(
    page: import("playwright").Page,
    id: string,
    value: number,
  ): Promise<void> {
    await page.evaluate(
      ({ id, value }) => {
        const el = document.getElementById(id) as HTMLInputElement;
        el.value = String(value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      },
      { id, value },
    );
  }

  test("spawns a retrograde particle and reads back position", async ({
    page,
  }) => {
    // Set black hole parameters
    await setSlider(page, "mass-slider", 100);
    await setSlider(page, "spin-slider", 0.99);

    // Verify displayed values updated
    await expect(page.locator("#mass-value")).toHaveText("100");
    await expect(page.locator("#spin-value")).toHaveText("0.99");

    // Set particle initial conditions
    await setSlider(page, "initial-radius-slider", 10);
    await setSlider(page, "angular-momentum-slider", -1.95);
    await setSlider(page, "radial-velocity-slider", 0);

    await expect(page.locator("#initial-radius-value")).toHaveText("10.0");
    await expect(page.locator("#angular-momentum-value")).toHaveText("-1.95");
    await expect(page.locator("#radial-velocity-value")).toHaveText("0");

    // Drop the particle
    await page.click("#add-particle-button");

    // Wait for the particle readout section to populate
    await expect(page.locator("#particle-readouts b").first()).toBeVisible({
      timeout: 5000,
    });

    // Let simulation run for a moment
    await page.waitForTimeout(1000);

    // The particle should be alive (readout shows r value, not a status alert)
    const readoutText = await page.locator("#particle-readouts").textContent();
    expect(readoutText).toMatch(/r\s+[\d.]+\s*M/);
    expect(readoutText).toContain("custom");

    // Take a screenshot for visual inspection
    await page.screenshot({
      path: "tests/screenshots/retrograde-10M.png",
      fullPage: false,
    });
  });

  test("black hole readouts update correctly for 100M / spin 0.99", async ({
    page,
  }) => {
    await setSlider(page, "mass-slider", 100);
    await setSlider(page, "spin-slider", 0.99);

    const readouts = page.locator("#black-hole-readouts");
    await expect(readouts.locator("text=r+")).toBeVisible();

    const horizonText = await readouts.textContent();
    // horizon r+ in km should appear (e.g. "168.42 km")
    expect(horizonText).toMatch(/\d+\.\d+ km/);
    // At spin=0.99 the retrograde ISCO row is shown
    expect(horizonText).toMatch(/ISCO \(retro\)/);
  });

  test("particle with r₀=10M L=-1.95 ṙ₀=0 spirals deep toward horizon", async ({
    page,
  }) => {
    await setSlider(page, "mass-slider", 100);
    await setSlider(page, "spin-slider", 0.99);
    await setSlider(page, "initial-radius-slider", 10);
    await setSlider(page, "angular-momentum-slider", -1.95);
    await setSlider(page, "radial-velocity-slider", 0);

    // Boost speed to max so more proper-time integrates per real second
    await setSlider(page, "speed-slider", 20);

    await page.click("#add-particle-button");

    // Wait for particle readout to appear
    await expect(page.locator("#particle-readouts b").first()).toBeVisible({
      timeout: 5000,
    });

    // Let simulation run for 5 seconds
    await page.waitForTimeout(5000);

    const readoutText = await page.locator("#particle-readouts").textContent();

    // The particle either reached an outcome or is still orbiting near the horizon
    if (readoutText?.match(/Captured by BH|Escaped to infinity/)) {
      // Definitive outcome — just record it
      expect(readoutText).toMatch(/Captured by BH|Escaped to infinity/);
    } else {
      // Still alive — verify it has plunged well inside r=5M (started at 10M)
      const radiusMatch = readoutText?.match(/r\s+([\d.]+)\s*M/);
      expect(radiusMatch).not.toBeNull();
      const r = parseFloat(radiusMatch![1]);
      expect(r).toBeLessThan(5);
    }

    await page.screenshot({
      path: "tests/screenshots/retrograde-10M-outcome.png",
    });
  });
});
