import { describe, it, expect } from "vitest";
import { Rk4Integrator } from "../rk4-integrator";
import {
  circularOrbitParameters,
  effectivePotential,
} from "../../domain/orbit";
import type { StateVector } from "../../domain/types";

// Energy conservation exercises the geodesic derivative (domain) and the RK4
// march (this adapter) together, so the test lives alongside the integrator.
describe("Rk4Integrator energy conservation", () => {
  const integrator = new Rk4Integrator();

  const march = (props: {
    initialRadius: number;
    spin: number;
    steps: number;
  }): StateVector => {
    const { initialRadius, spin, steps } = props;
    const params = circularOrbitParameters({
      orbitalRadius: initialRadius,
      spin: spin,
    })!;
    const { angularMomentum, specificEnergy } = params;
    let stateVector: StateVector = [initialRadius, 0, 0];
    for (let step = 0; step < steps; step++) {
      stateVector = integrator.integrate({
        stateVector: stateVector,
        angularMomentum: angularMomentum,
        specificEnergy: specificEnergy,
        spin: spin,
        deltaTime: 0.04,
      });
    }
    return stateVector;
  };

  it("conserves E (radius drifts < 1%) over many steps on a circular orbit", () => {
    const initialRadius = 10;
    const [radius] = march({
      initialRadius: initialRadius,
      spin: 0,
      steps: 500,
    });
    expect(Math.abs(radius - initialRadius) / initialRadius).toBeLessThan(0.01);
  });

  it("keeps E² − V²(r) ≈ ṙ² near zero on a circular orbit", () => {
    const initialRadius = 12;
    const spin = 0;
    const params = circularOrbitParameters({
      orbitalRadius: initialRadius,
      spin: spin,
    })!;
    const { angularMomentum, specificEnergy } = params;
    const [radius, , radialVelocity] = march({
      initialRadius: initialRadius,
      spin: spin,
      steps: 100,
    });
    const potentialSquared = effectivePotential({
      radius: radius,
      angularMomentum: angularMomentum,
      specificEnergy: specificEnergy,
      spin: spin,
    });
    const residual =
      specificEnergy * specificEnergy -
      potentialSquared -
      radialVelocity * radialVelocity;
    expect(Math.abs(residual)).toBeLessThan(1e-6);
  });
});
