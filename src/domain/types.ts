export interface BlackHoleGeometry {
  horizon: number;
  ergosphere: number;
  iscoPrograde: number;
  iscoRetrograde: number;
  photonSphere: number;
}

export interface OrbitParameters {
  angularMomentum: number;
  specificEnergy: number;
  radialVelocity: number;
}