import type { PhysicsIntegrator } from "./integrator";
import { coordinateTimeRate } from "../domain/orbit";
import { outerEventHorizonRadius } from "../domain/black-hole";
import { ParticleStatus } from "../domain/particle";
import type { Particle, TrailPoint } from "../domain/particle";
import type { Camera, DisplayOptions, SpawnState } from "../types";
import type { StateVector } from "../domain/types";

export interface SimulationState {
  readonly particles: readonly Particle[];
  readonly selectedParticleId: string | null;
  readonly paused: boolean;
  readonly simulationSpeed: number;
  readonly solarMasses: number;
  readonly spin: number;
  readonly camera: Camera;
  readonly spawn: SpawnState;
  readonly options: DisplayOptions;
}

const PROPER_TIME_STEP = 0.04;
const TRAIL_MAX_LENGTH = 800;
const ESCAPE_RADIUS = 600;

export class SimulationEngine {
  constructor(private readonly integrator: PhysicsIntegrator) {}

  step(props: { state: SimulationState; deltaTime: number }): SimulationState {
    const { state, deltaTime } = props;
    const integrationSteps = Math.max(
      1,
      Math.round(state.simulationSpeed * deltaTime * 60),
    );
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
    const trail: TrailPoint[] = [...particle.trail];

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
          trail: trail,
          properTime: properTime,
          coordinateTime: coordinateTime,
          status: ParticleStatus.CAPTURED,
        };
      }
      if (radius > ESCAPE_RADIUS) {
        return {
          ...particle,
          stateVector: stateVector,
          trail: trail,
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

      trail.push({
        x: radius * Math.cos(azimuthalAngle),
        y: radius * Math.sin(azimuthalAngle),
      });
      if (trail.length > TRAIL_MAX_LENGTH) trail.shift();
    }

    return {
      ...particle,
      stateVector: stateVector,
      trail: trail,
      properTime: properTime,
      coordinateTime: coordinateTime,
    };
  }
}

export function createInitialState(): SimulationState {
  return {
    particles: [],
    selectedParticleId: null,
    paused: false,
    simulationSpeed: 8,
    solarMasses: 10,
    spin: 0,
    camera: { scale: 28 },
    spawn: { initialRadius: 10, angularMomentum: 3.46, radialVelocity: 0 },
    options: {
      showISCO: true,
      showPhotonSphere: true,
      showEffectivePotential: true,
      showTimeDilationPanel: true,
      showTidalStretching: false,
    },
  };
}
