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
