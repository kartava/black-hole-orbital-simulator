import type { StateVector } from "@domain/types";
import type { Particle, TrailPoint } from "@domain/particle";
import type { PhysicsIntegrator } from "@application/integrator";

import { ParticleStatus } from "@domain/particle";
import { coordinateTimeRate } from "@domain/orbit";
import { outerEventHorizonRadius } from "@domain/black-hole";

// Physics/session state only. Presentation concerns (camera, display toggles,
// the particle-spawn form) live in ViewState — see src/types.ts — so the
// application layer never imports UI types.
export interface SimulationState {
  readonly particles: readonly Particle[];
  readonly selectedParticleId: string | null;
  readonly paused: boolean;
  readonly simulationSpeed: number;
  readonly solarMasses: number;
  readonly spin: number;
}

const PROPER_TIME_STEP = 0.04;
const TRAIL_MAX_LENGTH = 800;
const ESCAPE_RADIUS = 600;

export class SimulationEngine {
  // Carries the fractional substep left over between frames so simulated time
  // advances at a rate independent of the display's frame rate — no rounding
  // drift, no forced minimum of one substep per frame.
  private substepAccumulator = 0;

  constructor(private readonly integrator: PhysicsIntegrator) {}

  step(props: { state: SimulationState; deltaTime: number }): SimulationState {
    const { state, deltaTime } = props;
    this.substepAccumulator += state.simulationSpeed * deltaTime * 60;
    const integrationSteps = Math.floor(this.substepAccumulator);
    this.substepAccumulator -= integrationSteps;
    if (integrationSteps === 0) return state;

    const particles = state.particles.map((particle) =>
      this.stepParticle({
        particle: particle,
        integrationSubsteps: integrationSteps,
      }),
    );
    return { ...state, particles: particles };
  }

  private stepParticle(props: {
    particle: Particle;
    integrationSubsteps: number;
  }): Particle {
    const { particle, integrationSubsteps } = props;
    if (particle.status !== ParticleStatus.ALIVE) return particle;

    const captureRadius = outerEventHorizonRadius(particle.spin) * 1.02;
    let stateVector: StateVector = [...particle.stateVector] as StateVector;
    let properTime = particle.properTime;
    let coordinateTime = particle.coordinateTime;
    const newTrailPoints: TrailPoint[] = [];

    // Rebuild the trail once per frame (O(n)) rather than shift()-ing each
    // substep (O(n) per substep). Returns the original array untouched when no
    // new points were produced.
    const buildTrail = (): readonly TrailPoint[] => {
      if (newTrailPoints.length === 0) return particle.trail;
      const combined = [...particle.trail, ...newTrailPoints];
      return combined.length > TRAIL_MAX_LENGTH
        ? combined.slice(combined.length - TRAIL_MAX_LENGTH)
        : combined;
    };

    for (let step = 0; step < integrationSubsteps; step++) {
      const nextState = this.integrator.integrate({
        stateVector: stateVector,
        angularMomentum: particle.angularMomentum,
        specificEnergy: particle.specificEnergy,
        spin: particle.spin,
        deltaTime: PROPER_TIME_STEP,
      });
      const [radius, azimuthalAngle] = nextState;

      if (radius <= captureRadius || !isFinite(radius)) {
        return {
          ...particle,
          stateVector: stateVector,
          trail: buildTrail(),
          properTime: properTime,
          coordinateTime: coordinateTime,
          status: ParticleStatus.CAPTURED,
        };
      }
      if (radius > ESCAPE_RADIUS) {
        return {
          ...particle,
          stateVector: stateVector,
          trail: buildTrail(),
          properTime: properTime,
          coordinateTime: coordinateTime,
          status: ParticleStatus.ESCAPED,
        };
      }

      stateVector = nextState;
      properTime += PROPER_TIME_STEP;
      coordinateTime +=
        coordinateTimeRate({
          radius: radius,
          specificEnergy: particle.specificEnergy,
          angularMomentum: particle.angularMomentum,
          spin: particle.spin,
        }) * PROPER_TIME_STEP;

      newTrailPoints.push({
        x: radius * Math.cos(azimuthalAngle),
        y: radius * Math.sin(azimuthalAngle),
      });
    }

    return {
      ...particle,
      stateVector: stateVector,
      trail: buildTrail(),
      properTime: properTime,
      coordinateTime: coordinateTime,
    };
  }
}

export function createInitialSimulationState(): SimulationState {
  return {
    particles: [],
    selectedParticleId: null,
    paused: false,
    simulationSpeed: 8,
    solarMasses: 10,
    spin: 0,
  };
}
