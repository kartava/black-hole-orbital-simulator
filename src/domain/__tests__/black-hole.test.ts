import { describe, it, expect } from "vitest";
import {
  outerEventHorizonRadius,
  equatorialErgosphereRadius,
  innermostStableOrbitRadius,
  photonOrbitRadius,
  blackHoleGeometry,
  hawkingTemperature,
} from "../black-hole";

describe("outerEventHorizonRadius", () => {
  it("returns 2M for Schwarzschild (spin=0)", () => {
    expect(outerEventHorizonRadius(0)).toBe(2);
  });

  it("returns M for extremal Kerr (spin=1)", () => {
    expect(outerEventHorizonRadius(1)).toBeCloseTo(1, 10);
  });

  it("decreases monotonically as spin increases", () => {
    const r0 = outerEventHorizonRadius(0);
    const r05 = outerEventHorizonRadius(0.5);
    const r09 = outerEventHorizonRadius(0.9);
    expect(r0).toBeGreaterThan(r05);
    expect(r05).toBeGreaterThan(r09);
  });
});

describe("equatorialErgosphereRadius", () => {
  it("is always 2M regardless of spin", () => {
    expect(equatorialErgosphereRadius()).toBe(2);
  });
});

describe("innermostStableOrbitRadius", () => {
  it("returns 6M for Schwarzschild prograde", () => {
    expect(innermostStableOrbitRadius({ spin: 0 })).toBeCloseTo(6, 10);
  });

  it("returns 6M for Schwarzschild retrograde", () => {
    expect(
      innermostStableOrbitRadius({ spin: 0, prograde: false }),
    ).toBeCloseTo(6, 10);
  });

  it("prograde ISCO < 6M for spin > 0", () => {
    expect(
      innermostStableOrbitRadius({ spin: 0.5, prograde: true }),
    ).toBeLessThan(6);
  });

  it("retrograde ISCO > 6M for spin > 0", () => {
    expect(
      innermostStableOrbitRadius({ spin: 0.5, prograde: false }),
    ).toBeGreaterThan(6);
  });

  it("near-extremal prograde ISCO approaches M from above", () => {
    const isco = innermostStableOrbitRadius({ spin: 0.999, prograde: true });
    expect(isco).toBeGreaterThan(1);
    expect(isco).toBeLessThan(2);
  });

  it("prograde ISCO < retrograde ISCO for any spin > 0", () => {
    for (const spin of [0.1, 0.5, 0.9, 0.99]) {
      const pro = innermostStableOrbitRadius({ spin, prograde: true });
      const retro = innermostStableOrbitRadius({ spin, prograde: false });
      expect(pro).toBeLessThan(retro);
    }
  });
});

describe("photonOrbitRadius", () => {
  it("returns 3M for Schwarzschild", () => {
    expect(photonOrbitRadius({ spin: 0 })).toBeCloseTo(3, 10);
  });

  it("prograde photon orbit < 3M for spin > 0", () => {
    expect(photonOrbitRadius({ spin: 0.5, prograde: true })).toBeLessThan(3);
  });

  it("retrograde photon orbit > 3M for spin > 0", () => {
    expect(photonOrbitRadius({ spin: 0.5, prograde: false })).toBeGreaterThan(
      3,
    );
  });

  it("photon orbit lies inside prograde ISCO", () => {
    for (const spin of [0, 0.5, 0.9]) {
      const ph = photonOrbitRadius({ spin, prograde: true });
      const isco = innermostStableOrbitRadius({ spin, prograde: true });
      expect(ph).toBeLessThan(isco);
    }
  });
});

describe("blackHoleGeometry", () => {
  it("assembles correct Schwarzschild geometry", () => {
    const g = blackHoleGeometry(0);
    expect(g.horizon).toBeCloseTo(2, 10);
    expect(g.ergosphere).toBe(2);
    expect(g.iscoPrograde).toBeCloseTo(6, 10);
    expect(g.iscoRetrograde).toBeCloseTo(6, 10);
    expect(g.photonSphere).toBeCloseTo(3, 10);
  });

  it("horizon < ergosphere for spin > 0", () => {
    const g = blackHoleGeometry(0.9);
    expect(g.horizon).toBeLessThan(g.ergosphere);
  });

  it("photonSphere < iscoPrograde for all spins", () => {
    for (const spin of [0, 0.5, 0.9]) {
      const g = blackHoleGeometry(spin);
      expect(g.photonSphere).toBeLessThan(g.iscoPrograde);
    }
  });
});

describe("hawkingTemperature", () => {
  it("is positive for any mass and spin", () => {
    expect(hawkingTemperature({ solarMasses: 10, spin: 0 })).toBeGreaterThan(0);
    expect(hawkingTemperature({ solarMasses: 10, spin: 0.9 })).toBeGreaterThan(
      0,
    );
  });

  it("decreases as mass increases (heavier BH is colder)", () => {
    const t1 = hawkingTemperature({ solarMasses: 1 });
    const t10 = hawkingTemperature({ solarMasses: 10 });
    expect(t1).toBeGreaterThan(t10);
  });

  it("decreases as spin increases (frame-dragging reduces emission)", () => {
    const tSlow = hawkingTemperature({ solarMasses: 10, spin: 0 });
    const tFast = hawkingTemperature({ solarMasses: 10, spin: 0.9 });
    expect(tSlow).toBeGreaterThan(tFast);
  });
});
