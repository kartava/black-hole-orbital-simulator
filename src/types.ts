export interface Camera {
  readonly scale: number;
}

export interface DisplayOptions {
  readonly showISCO: boolean;
  readonly showPhotonSphere: boolean;
  readonly showEffectivePotential: boolean;
  readonly showTimeDilationPanel: boolean;
  readonly showTidalStretching: boolean;
}

export interface SpawnState {
  readonly initialRadius: number;
  readonly angularMomentum: number;
  readonly radialVelocity: number;
}

// Presentation/interaction state, held alongside SimulationState by the
// composition root. Kept out of the application layer so the engine never
// depends on rendering or UI-form concerns.
export interface ViewState {
  readonly camera: Camera;
  readonly options: DisplayOptions;
  readonly spawn: SpawnState;
}

export function createInitialViewState(): ViewState {
  return {
    camera: { scale: 28 },
    options: {
      showISCO: true,
      showPhotonSphere: true,
      showEffectivePotential: true,
      showTimeDilationPanel: true,
      showTidalStretching: false,
    },
    spawn: { initialRadius: 10, angularMomentum: 3.46, radialVelocity: 0 },
  };
}
