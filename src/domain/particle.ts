import type { StateVector } from "@domain/types";

import { coordinateTimeRate } from "@domain/orbit";

export const ParticleStatus = {
  ALIVE: "alive",
  CAPTURED: "captured",
  ESCAPED: "escaped",
} as const;

export type ParticleStatus =
  (typeof ParticleStatus)[keyof typeof ParticleStatus];

export interface TrailPoint {
  readonly x: number;
  readonly y: number;
}

export interface Particle {
  readonly id: string;
  readonly stateVector: StateVector;
  readonly angularMomentum: number;
  readonly specificEnergy: number;
  readonly spin: number;
  readonly color: string;
  readonly label: string;
  readonly trail: readonly TrailPoint[];
  readonly status: ParticleStatus;
  readonly properTime: number;
  readonly coordinateTime: number;
}

interface CreateParticleProps {
  id: string;
  radius: number;
  azimuthalAngle?: number;
  radialVelocity?: number;
  angularMomentum: number;
  specificEnergy: number;
  spin?: number;
  color: string;
  label?: string;
}

export function createParticleIdSequence(): () => string {
  let nextParticleId = 0;
  return () => String(nextParticleId++);
}

export function createParticle(props: CreateParticleProps): Particle {
  const {
    id,
    radius,
    azimuthalAngle = 0,
    radialVelocity = 0,
    angularMomentum,
    specificEnergy,
    spin = 0,
    color,
    label = "",
  } = props;

  return {
    id: id,
    stateVector: [radius, azimuthalAngle, radialVelocity] as StateVector,
    angularMomentum: angularMomentum,
    specificEnergy: specificEnergy,
    spin: spin,
    color: color,
    label: label,
    trail: [],
    status: ParticleStatus.ALIVE,
    properTime: 0,
    coordinateTime: 0,
  };
}

export function particleRadius(particle: Particle): number {
  return particle.stateVector[0];
}

export function particleX(particle: Particle): number {
  return particle.stateVector[0] * Math.cos(particle.stateVector[1]);
}

export function particleY(particle: Particle): number {
  return particle.stateVector[0] * Math.sin(particle.stateVector[1]);
}

export function getCoordinateTimeRate(particle: Particle): number {
  return coordinateTimeRate({
    radius: particle.stateVector[0],
    specificEnergy: particle.specificEnergy,
    angularMomentum: particle.angularMomentum,
    spin: particle.spin,
  });
}

const COLORS = [
  "#00e5ff",
  "#ff6d00",
  "#76ff03",
  "#e040fb",
  "#ffea00",
  "#ff1744",
  "#69f0ae",
  "#ff9100",
];

export function createColorCycler(): () => string {
  let index = 0;
  return () => COLORS[index++ % COLORS.length];
}
