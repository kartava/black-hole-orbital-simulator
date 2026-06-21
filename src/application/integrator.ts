import type { StateVector } from "../domain/types";

export interface IntegrateProps {
  stateVector: StateVector;
  angularMomentum: number;
  specificEnergy: number;
  spin: number;
  deltaTime: number;
}

export interface PhysicsIntegrator {
  integrate(props: IntegrateProps): StateVector;
}
