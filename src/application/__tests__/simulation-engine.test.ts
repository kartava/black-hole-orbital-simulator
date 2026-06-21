import { describe, it, expect } from "vitest";
import { SimulationEngine, type SimulationState } from "../simulation-engine";
import type { IntegrateProps, PhysicsIntegrator } from "../integrator";
import { createParticle, ParticleStatus } from "../../domain/particle";
import type { Particle } from "../../domain/particle";
import type { StateVector } from "../../domain/types";

// Fake integrator that advances radius by a fixed amount each substep, so the
// engine's capture/escape orchestration can be tested without any GR math.
class LinearRadiusIntegrator implements PhysicsIntegrator {
  constructor(private readonly radiusDelta: number) {}
  integrate(props: IntegrateProps): StateVector {
    const [radius, azimuthalAngle, radialVelocity] = props.stateVector;
    return [radius + this.radiusDelta, azimuthalAngle + 0.1, radialVelocity];
  }
}

function makeParticle(radius: number): Particle {
  return createParticle({
    id: "test",
    radius: radius,
    angularMomentum: 3,
    specificEnergy: 0.95,
    spin: 0,
    color: "#fff",
  });
}

function makeState(props: {
  particle: Particle;
  simulationSpeed?: number;
}): SimulationState {
  const { particle, simulationSpeed = 1 } = props;
  return {
    particles: [particle],
    selectedParticleId: null,
    paused: false,
    simulationSpeed: simulationSpeed,
    solarMasses: 10,
    spin: 0,
  };
}

// simulationSpeed * deltaTime * 60 → substeps; speed=1, dt=1 gives exactly 60.
const ONE_FRAME = { simulationSpeed: 1, deltaTime: 1, substeps: 60 };

describe("SimulationEngine capture/escape", () => {
  it("marks a particle CAPTURED once it crosses the capture radius", () => {
    const engine = new SimulationEngine(new LinearRadiusIntegrator(-1));
    const state = makeState({ particle: makeParticle(10) });
    const next = engine.step({ state: state, deltaTime: ONE_FRAME.deltaTime });
    expect(next.particles[0].status).toBe(ParticleStatus.CAPTURED);
  });

  it("marks a particle ESCAPED once it passes the escape radius", () => {
    const engine = new SimulationEngine(new LinearRadiusIntegrator(60));
    const state = makeState({ particle: makeParticle(10) });
    const next = engine.step({ state: state, deltaTime: ONE_FRAME.deltaTime });
    expect(next.particles[0].status).toBe(ParticleStatus.ESCAPED);
  });

  it("leaves a stationary particle ALIVE and accrues proper time", () => {
    const engine = new SimulationEngine(new LinearRadiusIntegrator(0));
    const state = makeState({ particle: makeParticle(10) });
    const next = engine.step({ state: state, deltaTime: ONE_FRAME.deltaTime });
    const particle = next.particles[0];
    expect(particle.status).toBe(ParticleStatus.ALIVE);
    // 60 substeps × PROPER_TIME_STEP (0.04).
    expect(particle.properTime).toBeCloseTo(ONE_FRAME.substeps * 0.04, 6);
    expect(particle.trail.length).toBe(ONE_FRAME.substeps);
  });

  it("does not re-integrate a non-alive particle", () => {
    const engine = new SimulationEngine(new LinearRadiusIntegrator(-1));
    const captured = engine.step({
      state: makeState({ particle: makeParticle(10) }),
      deltaTime: ONE_FRAME.deltaTime,
    }).particles[0];
    const again = engine.step({
      state: makeState({ particle: captured }),
      deltaTime: ONE_FRAME.deltaTime,
    });
    expect(again.particles[0]).toBe(captured);
  });

  it("caps the trail at its maximum length", () => {
    const engine = new SimulationEngine(new LinearRadiusIntegrator(0));
    // speed=20, dt=1 → 1200 substeps, well over the 800-point cap.
    const state = makeState({
      particle: makeParticle(10),
      simulationSpeed: 20,
    });
    const next = engine.step({ state: state, deltaTime: 1 });
    expect(next.particles[0].trail.length).toBe(800);
  });
});

describe("SimulationEngine frame-rate independence", () => {
  it("accumulates fractional substeps across frames instead of rounding", () => {
    const engine = new SimulationEngine(new LinearRadiusIntegrator(0));
    const state = makeState({ particle: makeParticle(10) });

    // speed=1, dt=0.01 → product 0.6 substeps: below 1, so no integration yet
    // and the same state object is returned unchanged.
    const afterFirst = engine.step({ state: state, deltaTime: 0.01 });
    expect(afterFirst).toBe(state);

    // Second frame accumulates to 1.2 → exactly one substep fires.
    const afterSecond = engine.step({ state: afterFirst, deltaTime: 0.01 });
    expect(afterSecond.particles[0].properTime).toBeCloseTo(0.04, 6);
  });
});
