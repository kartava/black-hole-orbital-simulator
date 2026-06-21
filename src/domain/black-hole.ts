// Geometric units: G = c = 1, mass scale M = 1
// All distances in units of M, time in units of M/c = M (with c=1).

import type { BlackHoleGeometry } from "./types";

export const UNIT_MASS = 1;
// SI physical constants.
const REDUCED_PLANCK_CONSTANT = 1.054571817e-34; // J·s
const SPEED_OF_LIGHT = 2.99792458e8; // m/s
const GRAVITATIONAL_CONSTANT = 6.6743e-11; // m³/(kg·s²)
const BOLTZMANN_CONSTANT = 1.380649e-23; // J/K
const SOLAR_MASS_KG = 1.98892e30; // kg

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

export function blackHoleGeometry(spin: number): BlackHoleGeometry {
  return {
    horizon: outerEventHorizonRadius(spin),
    ergosphere: equatorialErgosphereRadius(),
    iscoPrograde: innermostStableOrbitRadius({ spin: spin, prograde: true }),
    iscoRetrograde: innermostStableOrbitRadius({ spin: spin, prograde: false }),
    photonSphere: photonOrbitRadius({ spin: spin, prograde: true }),
  };
}

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
