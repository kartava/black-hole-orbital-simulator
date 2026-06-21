import type {
  IntegrateProps,
  PhysicsIntegrator,
} from "../application/integrator";
import { rungeKutta4Step } from "../domain/orbit";

export class Rk4Integrator implements PhysicsIntegrator {
  integrate(props: IntegrateProps): [number, number, number] {
    const { stateVector, angularMomentum, specificEnergy, spin, deltaTime } = props;
    return rungeKutta4Step({
      stateVector: stateVector,
      angularMomentum: angularMomentum,
      specificEnergy: specificEnergy,
      spin: spin,
      timeStep: deltaTime,
    });
  }
}
