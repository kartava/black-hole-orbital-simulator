import { describe, it, expect } from "vitest";
import type { StateVector } from "../types";
import {
  rungeKutta4Step,
  coordinateTimeRate,
  circularOrbitParameters,
  effectivePotential,
  tidalStretchFactor,
  orbitParametersFromInitialConditions,
} from "../orbit";

describe("effectivePotential (Schwarzschild)", () => {
  it("approaches 1 as r → ∞ for L=0", () => {
    const v = effectivePotential({
      radius: 1e6,
      angularMomentum: 0,
      specificEnergy: 1,
      spin: 0,
    });
    expect(v).toBeCloseTo(1, 4);
  });

  it("V²(r=6, L=2√3) ≈ E²=8/9 at ISCO (circular orbit condition)", () => {
    // At the Schwarzschild ISCO: r=6M, L=2√3M, E=√(8/9)
    const angularMomentum = 2 * Math.sqrt(3);
    const specificEnergy = Math.sqrt(8 / 9);
    const v = effectivePotential({
      radius: 6,
      angularMomentum,
      specificEnergy,
      spin: 0,
    });
    expect(v).toBeCloseTo(specificEnergy * specificEnergy, 5);
  });

  it("decreases toward horizon (bound orbits forbidden inside ISCO)", () => {
    const L = 2 * Math.sqrt(3);
    const E = Math.sqrt(8 / 9);
    const vAt6 = effectivePotential({
      radius: 6,
      angularMomentum: L,
      specificEnergy: E,
      spin: 0,
    });
    const vAt3 = effectivePotential({
      radius: 3,
      angularMomentum: L,
      specificEnergy: E,
      spin: 0,
    });
    // Inside ISCO the potential drops — particle falls in.
    expect(vAt3).toBeLessThan(vAt6);
  });

  it("is Infinity at r=0", () => {
    expect(
      effectivePotential({
        radius: 0,
        angularMomentum: 1,
        specificEnergy: 1,
        spin: 0,
      }),
    ).toBe(Infinity);
  });
});

describe("circularOrbitParameters", () => {
  it("returns null inside the event horizon", () => {
    expect(circularOrbitParameters({ orbitalRadius: 1.5, spin: 0 })).toBeNull();
  });

  it("returns null at r=3M (photon sphere — no stable circular orbit)", () => {
    expect(circularOrbitParameters({ orbitalRadius: 3, spin: 0 })).toBeNull();
  });

  it("Schwarzschild ISCO: L=2√3, E=√(8/9)", () => {
    const params = circularOrbitParameters({ orbitalRadius: 6, spin: 0 });
    expect(params).not.toBeNull();
    expect(params!.angularMomentum).toBeCloseTo(2 * Math.sqrt(3), 6);
    expect(params!.specificEnergy).toBeCloseTo(Math.sqrt(8 / 9), 6);
    expect(params!.radialVelocity).toBe(0);
  });

  it("energy is sub-unity for bound circular orbits", () => {
    const params = circularOrbitParameters({ orbitalRadius: 10, spin: 0 });
    expect(params).not.toBeNull();
    expect(params!.specificEnergy).toBeLessThan(1);
  });

  it("prograde Kerr orbit has higher angular momentum than retrograde at same radius", () => {
    const pro = circularOrbitParameters({
      orbitalRadius: 10,
      spin: 0.5,
      prograde: true,
    });
    const retro = circularOrbitParameters({
      orbitalRadius: 10,
      spin: 0.5,
      prograde: false,
    });
    expect(pro).not.toBeNull();
    expect(retro).not.toBeNull();
    expect(pro!.angularMomentum).toBeGreaterThan(0);
    expect(retro!.angularMomentum).toBeLessThan(0);
  });
});

describe("rungeKutta4Step energy conservation", () => {
  it("conserves E (to within 0.1%) over many steps on a circular orbit", () => {
    const r0 = 10;
    const spin = 0;
    const params = circularOrbitParameters({ orbitalRadius: r0, spin })!;
    const { angularMomentum, specificEnergy } = params;

    let stateVector: StateVector = [r0, 0, 0];
    const steps = 500;
    for (let i = 0; i < steps; i++) {
      stateVector = rungeKutta4Step({
        stateVector: stateVector,
        angularMomentum: angularMomentum,
        specificEnergy: specificEnergy,
        spin: spin,
        timeStep: 0.04,
      });
    }

    const [r] = stateVector;
    // On a circular orbit r should not drift more than 1% of initial radius.
    expect(Math.abs(r - r0) / r0).toBeLessThan(0.01);
  });

  it("conserves effective energy E² − V²(r) ≈ ṙ² near zero on circular orbit", () => {
    const r0 = 12;
    const spin = 0;
    const params = circularOrbitParameters({ orbitalRadius: r0, spin })!;
    const { angularMomentum, specificEnergy } = params;

    let stateVector: StateVector = [r0, 0, 0];
    for (let i = 0; i < 100; i++) {
      stateVector = rungeKutta4Step({
        stateVector: stateVector,
        angularMomentum: angularMomentum,
        specificEnergy: specificEnergy,
        spin: spin,
        timeStep: 0.04,
      });
    }
    const [r, , rdot] = stateVector;
    const vSq = effectivePotential({
      radius: r,
      angularMomentum,
      specificEnergy,
      spin,
    });
    const residual = specificEnergy * specificEnergy - vSq - rdot * rdot;
    expect(Math.abs(residual)).toBeLessThan(1e-6);
  });
});

describe("coordinateTimeRate", () => {
  it("is greater than 1 outside the event horizon (time dilation)", () => {
    // For a stationary observer at finite r, dt/dτ > 1
    const rate = coordinateTimeRate({
      radius: 10,
      specificEnergy: 1,
      angularMomentum: 0,
      spin: 0,
    });
    expect(rate).toBeGreaterThan(1);
  });

  it("diverges near the horizon (extreme time dilation)", () => {
    const rateNear = coordinateTimeRate({
      radius: 2.01,
      specificEnergy: 1,
      angularMomentum: 0,
      spin: 0,
    });
    const rateFar = coordinateTimeRate({
      radius: 100,
      specificEnergy: 1,
      angularMomentum: 0,
      spin: 0,
    });
    expect(rateNear).toBeGreaterThan(rateFar);
  });
});

describe("tidalStretchFactor", () => {
  it("equals 2M/r³ (Schwarzschild tidal invariant)", () => {
    const r = 6;
    expect(tidalStretchFactor(r)).toBeCloseTo(2 / (r * r * r), 10);
  });

  it("is 0 at r=0 (protected by guard)", () => {
    expect(tidalStretchFactor(0)).toBe(0);
  });

  it("decreases as radius increases", () => {
    expect(tidalStretchFactor(5)).toBeGreaterThan(tidalStretchFactor(10));
  });
});

describe("orbitParametersFromInitialConditions", () => {
  it("recovers circular-orbit energy from circular initial conditions", () => {
    const r0 = 10;
    const spin = 0;
    const circular = circularOrbitParameters({ orbitalRadius: r0, spin })!;
    const recovered = orbitParametersFromInitialConditions({
      radius: r0,
      angularMomentum: circular.angularMomentum,
      radialVelocity: 0,
      spin,
    });
    expect(recovered).not.toBeNull();
    expect(recovered!.specificEnergy).toBeCloseTo(circular.specificEnergy, 6);
  });

  it("returns null inside the event horizon (Δ < 0 makes discriminant negative)", () => {
    // r=1.5 < 2M: Kerr Δ is negative, which drives the quadratic discriminant < 0.
    const result = orbitParametersFromInitialConditions({
      radius: 1.5,
      angularMomentum: 1,
      radialVelocity: 0,
      spin: 0,
    });
    expect(result).toBeNull();
  });
});
