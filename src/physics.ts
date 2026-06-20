// Geometric units: G = c = 1, mass scale M = 1
// All distances in units of M, time in units of M/c = M (with c=1).

export const UNIT_MASS = 1;

export interface OrbitParameters {
  angularMomentum: number;
  specificEnergy: number;
  radialVelocity: number;
}

export interface BlackHoleGeometry {
  horizon: number;
  ergosphere: number;
  iscoPrograde: number;
  iscoRetrograde: number;
  photonSphere: number;
}

export function outerEventHorizonRadius(spin: number): number {
  return UNIT_MASS + Math.sqrt(UNIT_MASS * UNIT_MASS - spin * spin);
}

// Equatorial ergosphere boundary (θ=π/2): always at r = 2M regardless of spin.
export function equatorialErgosphereRadius(): number {
  return 2 * UNIT_MASS;
}

// Bardeen-Press-Teukolsky formula; prograde=true → co-rotating (smaller ISCO).
export function innermostStableOrbitRadius(props: {
  spin: number;
  prograde?: boolean;
}): number {
  const { spin, prograde = true } = props;
  if (spin === 0) return 6 * UNIT_MASS;
  const iscoBranchSign = prograde ? -1 : 1;
  const iscoAuxiliary1 =
    1 +
    Math.cbrt(1 - spin * spin) * (Math.cbrt(1 + spin) + Math.cbrt(1 - spin));
  const iscoAuxiliary2 = Math.sqrt(
    3 * spin * spin + iscoAuxiliary1 * iscoAuxiliary1,
  );
  return (
    UNIT_MASS *
    (3 +
      iscoAuxiliary2 +
      iscoBranchSign *
        Math.sqrt(
          (3 - iscoAuxiliary1) * (3 + iscoAuxiliary1 + 2 * iscoAuxiliary2),
        ))
  );
}

// r_ph = 2M(1 + cos(2/3 · arccos(∓a/M))), minus for prograde, plus for retrograde.
export function photonOrbitRadius(props: {
  spin: number;
  prograde?: boolean;
}): number {
  const { spin, prograde = true } = props;
  if (spin === 0) return 3 * UNIT_MASS;
  const photonBranchSign = prograde ? -1 : 1;
  return (
    2 *
    UNIT_MASS *
    (1 + Math.cos((2 / 3) * Math.acos((photonBranchSign * spin) / UNIT_MASS)))
  );
}

// State vector: [radius, azimuthalAngle, radialVelocity] = [r, φ, dr/dτ]
// Returns [dr/dτ, dφ/dτ, d²r/dτ²].
// Derived from Boyer-Lindquist metric: (dr/dτ)² = R/r⁴,
// where R = P² − Δ(Q²+r²), P = (r²+a²)E − aL, Q = L − aE, Δ = r²−2Mr+a².
function kerrDerivatives(props: {
  stateVector: number[];
  angularMomentum: number;
  specificEnergy: number;
  spin: number;
}): number[] {
  const { stateVector, angularMomentum, specificEnergy, spin } = props;
  const [radius, , radialVelocity] = stateVector;
  if (radius <= 0) return [0, 0, 0];

  const spinSquared = spin * spin;
  const radiusSquared = radius * radius;
  const kerrDelta = radiusSquared - 2 * UNIT_MASS * radius + spinSquared;

  const kerrPotentialP =
    (radiusSquared + spinSquared) * specificEnergy - spin * angularMomentum;
  const kerrPotentialQ = angularMomentum - spin * specificEnergy;
  const radialPotentialR =
    kerrPotentialP * kerrPotentialP -
    kerrDelta * (kerrPotentialQ * kerrPotentialQ + radiusSquared);

  // dφ/dτ = [2aME + L(r−2M)] / (r·Δ) — derived from Boyer-Lindquist Killing vectors
  const angularVelocity =
    (2 * spin * UNIT_MASS * specificEnergy +
      angularMomentum * (radius - 2 * UNIT_MASS)) /
    (radius * kerrDelta);

  // d²r/dτ² = (R′·r − 4R) / (2r⁵), from differentiating (ṙ)² = R/r⁴
  const potentialPDerivative = 2 * radius * specificEnergy;
  const radialPotentialDerivative =
    2 * kerrPotentialP * potentialPDerivative -
    (2 * radius - 2 * UNIT_MASS) *
      (kerrPotentialQ * kerrPotentialQ + radiusSquared) -
    2 * radius * kerrDelta;
  const radialAcceleration =
    (radialPotentialDerivative * radius - 4 * radialPotentialR) /
    (2 * radiusSquared * radiusSquared * radius);

  return [radialVelocity, angularVelocity, radialAcceleration];
}

export function rungeKutta4Step(props: {
  stateVector: number[];
  angularMomentum: number;
  specificEnergy: number;
  spin: number;
  timeStep: number;
}): number[] {
  const { stateVector, angularMomentum, specificEnergy, spin, timeStep } =
    props;
  const computeDerivatives = (currentState: number[]) =>
    kerrDerivatives({
      stateVector: currentState,
      angularMomentum,
      specificEnergy,
      spin,
    });
  const slope1 = computeDerivatives(stateVector);
  const firstMidpoint = stateVector.map(
    (component, index) => component + 0.5 * timeStep * slope1[index],
  );
  const slope2 = computeDerivatives(firstMidpoint);
  const secondMidpoint = stateVector.map(
    (component, index) => component + 0.5 * timeStep * slope2[index],
  );
  const slope3 = computeDerivatives(secondMidpoint);
  const endpointEstimate = stateVector.map(
    (component, index) => component + timeStep * slope3[index],
  );
  const slope4 = computeDerivatives(endpointEstimate);
  return stateVector.map(
    (component, index) =>
      component +
      (timeStep / 6) *
        (slope1[index] + 2 * slope2[index] + 2 * slope3[index] + slope4[index]),
  );
}

// ṫ = [(r²+a²+2Ma²/r)·E − (2Ma/r)·L] / Δ — equatorial Kerr (Boyer-Lindquist).
export function coordinateTimeRate(props: {
  radius: number;
  specificEnergy: number;
  angularMomentum: number;
  spin: number;
}): number {
  const { radius, specificEnergy, angularMomentum, spin } = props;
  const radiusSquared = radius * radius;
  const spinSquared = spin * spin;
  const kerrDelta = radiusSquared - 2 * UNIT_MASS * radius + spinSquared;
  if (kerrDelta <= 0) return 1e6;
  const metricTimeCoefficient =
    radiusSquared + spinSquared + (2 * UNIT_MASS * spinSquared) / radius;
  const metricCrossTermCoefficient = (2 * UNIT_MASS * spin) / radius;
  return (
    (metricTimeCoefficient * specificEnergy -
      metricCrossTermCoefficient * angularMomentum) /
    kerrDelta
  );
}

// prograde=false: retrograde orbit — substitutes effectiveSpin = −a (Bardeen 1972).
export function circularOrbitParameters(props: {
  orbitalRadius: number;
  spin?: number;
  prograde?: boolean;
}): OrbitParameters | null {
  const { orbitalRadius, spin = 0, prograde = true } = props;
  const horizonRadius = outerEventHorizonRadius(spin);
  if (orbitalRadius <= horizonRadius + 0.01) return null;

  const radius = orbitalRadius;
  const radiusSquared = radius * radius;
  const sqrtMassTimesRadius = Math.sqrt(UNIT_MASS * radius);

  if (spin === 0) {
    const orbitalDenominator = radius - 3 * UNIT_MASS;
    if (orbitalDenominator <= 0) return null;
    const angularMomentum = Math.sqrt(
      (UNIT_MASS * radiusSquared) / orbitalDenominator,
    );
    const energySquared =
      Math.pow(1 - (2 * UNIT_MASS) / radius, 2) /
      (1 - (3 * UNIT_MASS) / radius);
    if (energySquared <= 0) return null;
    return {
      angularMomentum: prograde ? angularMomentum : -angularMomentum,
      specificEnergy: Math.sqrt(energySquared),
      radialVelocity: 0,
    };
  }

  const effectiveSpin = prograde ? spin : -spin;
  const orbitalDiscriminant =
    radiusSquared -
    3 * UNIT_MASS * radius +
    2 * effectiveSpin * sqrtMassTimesRadius;
  if (orbitalDiscriminant <= 0) return null;
  const sqrtDiscriminant = Math.sqrt(orbitalDiscriminant);
  const specificEnergyNumerator =
    radiusSquared -
    2 * UNIT_MASS * radius +
    effectiveSpin * sqrtMassTimesRadius;
  if (specificEnergyNumerator <= 0) return null;
  const specificEnergy = specificEnergyNumerator / (radius * sqrtDiscriminant);
  const angularMomentumMagnitude =
    (Math.sqrt(UNIT_MASS) *
      (radiusSquared -
        2 * effectiveSpin * sqrtMassTimesRadius +
        effectiveSpin * effectiveSpin)) /
    (Math.sqrt(radius) * sqrtDiscriminant);
  const angularMomentum = prograde
    ? angularMomentumMagnitude
    : -angularMomentumMagnitude;

  return { angularMomentum, specificEnergy, radialVelocity: 0 };
}

// Schwarzschild: V²(r) = (1−2M/r)(1+L²/r²), independent of E.
// Kerr: V²(r) = E² − R/r⁴ = [E²r⁴ − R]/r⁴ — where R = P²−Δ(Q²+r²).
// In both cases: (dr/dτ)² = E² − V²(r), so V²(r) ≤ E² is the allowed region.
export function effectivePotential(props: {
  radius: number;
  angularMomentum: number;
  specificEnergy: number;
  spin?: number;
}): number {
  const { radius, angularMomentum, specificEnergy, spin = 0 } = props;
  if (radius <= 0) return Infinity;
  if (spin === 0) {
    return (
      (1 - (2 * UNIT_MASS) / radius) *
      (1 + (angularMomentum * angularMomentum) / (radius * radius))
    );
  }
  const spinSquared = spin * spin;
  const radiusSquared = radius * radius;
  const kerrDelta = radiusSquared - 2 * UNIT_MASS * radius + spinSquared;
  const kerrPotentialP =
    (radiusSquared + spinSquared) * specificEnergy - spin * angularMomentum;
  const kerrPotentialQ = angularMomentum - spin * specificEnergy;
  return (
    (specificEnergy * specificEnergy * radiusSquared * radiusSquared -
      (kerrPotentialP * kerrPotentialP -
        kerrDelta * (kerrPotentialQ * kerrPotentialQ + radiusSquared))) /
    (radiusSquared * radiusSquared)
  );
}

// Magnitude of the radial Riemann curvature component |R^r_trt| = 2M/r³.

export function tidalStretchFactor(radius: number): number {
  if (radius <= 0) return 0;
  return (2 * UNIT_MASS) / (radius * radius * radius);
}

// SI physical constants, CODATA 2018.
const REDUCED_PLANCK_CONSTANT = 1.054571817e-34; // J·s
const SPEED_OF_LIGHT = 2.99792458e8; // m/s
const GRAVITATIONAL_CONSTANT = 6.6743e-11; // m³/(kg·s²)
const BOLTZMANN_CONSTANT = 1.380649e-23; // J/K
const SOLAR_MASS_KG = 1.98892e30; // kg

// Kerr Hawking temperature: T = ℏc³√(1−a²) / (4πGM k_B (1+√(1−a²)))
// At spin=0 this reduces to the Schwarzschild value ℏc³/(8πGMk_B).
export function hawkingTemperature(props: {
  solarMasses: number;
  spin?: number;
}): number {
  const { solarMasses, spin = 0 } = props;
  const sqrtOneMinusSpinSquared = Math.sqrt(Math.max(1 - spin * spin, 0));
  const physicalMassKg = solarMasses * SOLAR_MASS_KG;
  return (
    (REDUCED_PLANCK_CONSTANT *
      SPEED_OF_LIGHT *
      SPEED_OF_LIGHT *
      SPEED_OF_LIGHT *
      sqrtOneMinusSpinSquared) /
    (4 *
      Math.PI *
      GRAVITATIONAL_CONSTANT *
      physicalMassKg *
      BOLTZMANN_CONSTANT *
      (1 + sqrtOneMinusSpinSquared))
  );
}

export function schwarzschildRadiusInKilometers(solarMasses: number): number {
  return (
    (2 * GRAVITATIONAL_CONSTANT * solarMasses * SOLAR_MASS_KG) /
    (SPEED_OF_LIGHT * SPEED_OF_LIGHT) /
    1000
  );
}

// Derived from R/r⁴ = ṙ²: quadratic in E → returns null if unphysical.
export function orbitParametersFromInitialConditions(props: {
  radius: number;
  angularMomentum: number;
  radialVelocity: number;
  spin: number;
}): OrbitParameters | null {
  const { radius, angularMomentum, radialVelocity, spin } = props;
  const radiusSquared = radius * radius;
  const spinSquared = spin * spin;
  const kerrDelta = radiusSquared - 2 * UNIT_MASS * radius + spinSquared;

  const quadraticCoeffA =
    (radiusSquared + spinSquared) * (radiusSquared + spinSquared) -
    spinSquared * kerrDelta;
  const quadraticCoeffB = -4 * spin * angularMomentum * radius;
  const quadraticCoeffC =
    spinSquared * angularMomentum * angularMomentum -
    kerrDelta * (angularMomentum * angularMomentum + radiusSquared) -
    radialVelocity * radialVelocity * radiusSquared * radiusSquared;

  const discriminant =
    quadraticCoeffB * quadraticCoeffB - 4 * quadraticCoeffA * quadraticCoeffC;
  if (discriminant < 0) return null;
  const specificEnergy =
    (-quadraticCoeffB + Math.sqrt(discriminant)) / (2 * quadraticCoeffA);
  if (specificEnergy <= 0) return null;

  return { angularMomentum, specificEnergy, radialVelocity };
}

export function blackHoleGeometry(spin: number): BlackHoleGeometry {
  return {
    horizon: outerEventHorizonRadius(spin),
    ergosphere: equatorialErgosphereRadius(),
    iscoPrograde: innermostStableOrbitRadius({ spin, prograde: true }),
    iscoRetrograde: innermostStableOrbitRadius({ spin, prograde: false }),
    photonSphere: photonOrbitRadius({ spin, prograde: true }),
  };
}
