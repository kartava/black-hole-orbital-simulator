import type {
  IntegrateProps,
  PhysicsIntegrator,
} from "../application/integrator";
import type { StateVector } from "../domain/types";
import { geodesicDerivative } from "../domain/orbit";

// Classical 4th-order Runge-Kutta march of the geodesic ODE. The physics (the
// derivative) lives in the domain; this adapter owns only the numerical scheme,
// so swapping integrators (Verlet, symplectic, …) means writing a new adapter
// behind the PhysicsIntegrator port — not touching the domain.
export class Rk4Integrator implements PhysicsIntegrator {
  integrate(props: IntegrateProps): StateVector {
    const { stateVector, angularMomentum, specificEnergy, spin, deltaTime } =
      props;
    const computeDerivatives = (currentState: StateVector) =>
      geodesicDerivative({
        stateVector: currentState,
        angularMomentum: angularMomentum,
        specificEnergy: specificEnergy,
        spin: spin,
      });
    const advance = (slope: StateVector, fraction: number): StateVector => [
      stateVector[0] + fraction * deltaTime * slope[0],
      stateVector[1] + fraction * deltaTime * slope[1],
      stateVector[2] + fraction * deltaTime * slope[2],
    ];

    const slope1 = computeDerivatives(stateVector);
    const slope2 = computeDerivatives(advance(slope1, 0.5));
    const slope3 = computeDerivatives(advance(slope2, 0.5));
    const slope4 = computeDerivatives(advance(slope3, 1));

    const sixth = deltaTime / 6;
    return [
      stateVector[0] +
        sixth * (slope1[0] + 2 * slope2[0] + 2 * slope3[0] + slope4[0]),
      stateVector[1] +
        sixth * (slope1[1] + 2 * slope2[1] + 2 * slope3[1] + slope4[1]),
      stateVector[2] +
        sixth * (slope1[2] + 2 * slope2[2] + 2 * slope3[2] + slope4[2]),
    ];
  }
}
