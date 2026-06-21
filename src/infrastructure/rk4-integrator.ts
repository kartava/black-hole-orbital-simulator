import type { IntegrateProps, PhysicsIntegrator } from "../application/integrator";
import { rungeKutta4Step } from "../domain/orbit";

export class Rk4Integrator implements PhysicsIntegrator {
  integrate(props: IntegrateProps): number[] {
    return rungeKutta4Step({
      stateVector: props.stateVector,
      angularMomentum: props.angularMomentum,
      specificEnergy: props.specificEnergy,
      spin: props.spin,
      timeStep: props.deltaTime,
    });
  }
}
