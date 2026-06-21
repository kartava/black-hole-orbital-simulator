import type { Particle } from "../domain/particle";
import type { Camera, DisplayOptions, SpawnState } from "../types";

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
