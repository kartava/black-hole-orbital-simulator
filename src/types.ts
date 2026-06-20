import type { Particle } from "./particles";

export interface Camera {
  scale: number;
}

export interface DisplayOptions {
  showISCO: boolean;
  showPhotonSphere: boolean;
  showEffectivePotential: boolean;
  showTimeDilationPanel: boolean;
  showTidalStretching: boolean;
}

export interface SpawnState {
  initialRadius: number;
  angularMomentum: number;
  radialVelocity: number;
}

export interface SimulationState {
  particles: Particle[];
  selectedParticle: Particle | null;
  paused: boolean;
  simulationSpeed: number;
  solarMasses: number;
  spin: number;
  camera: Camera;
  spawn: SpawnState;
  options: DisplayOptions;
}
