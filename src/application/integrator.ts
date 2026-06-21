export interface IntegrateProps {
  stateVector: number[];
  angularMomentum: number;
  specificEnergy: number;
  spin: number;
  deltaTime: number;
}

export interface PhysicsIntegrator {
  integrate(props: IntegrateProps): number[];
}
