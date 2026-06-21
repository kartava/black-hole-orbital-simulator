export interface IntegrateProps {
  stateVector: readonly [number, number, number];
  angularMomentum: number;
  specificEnergy: number;
  spin: number;
  deltaTime: number;
}

export interface PhysicsIntegrator {
  integrate(props: IntegrateProps): [number, number, number];
}
