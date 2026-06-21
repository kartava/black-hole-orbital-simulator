import { coordinateTimeRate } from "./orbit";

export interface TrailPoint {
  readonly x: number;
  readonly y: number;
}

export interface Particle {
  readonly id: string;
  readonly stateVector: readonly number[];
  readonly angularMomentum: number;
  readonly specificEnergy: number;
  readonly spin: number;
  readonly color: string;
  readonly label: string;
  readonly trail: readonly TrailPoint[];
  readonly alive: boolean;
  readonly captured: boolean;
  readonly escaped: boolean;
  readonly properTime: number;
  readonly coordinateTime: number;
}

interface CreateParticleProps {
  radius: number;
  azimuthalAngle?: number;
  radialVelocity?: number;
  angularMomentum: number;
  specificEnergy: number;
  spin?: number;
  color: string;
  label?: string;
}

let nextParticleId = 0;

export function createParticle(props: CreateParticleProps): Particle {
  const {
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
    id: String(nextParticleId++),
    stateVector: [radius, azimuthalAngle, radialVelocity],
    angularMomentum,
    specificEnergy,
    spin,
    color,
    label,
    trail: [],
    alive: true,
    captured: false,
    escaped: false,
    properTime: 0,
    coordinateTime: 0,
  };
}

export function particleRadius(p: Particle): number {
  return p.stateVector[0];
}

export function particleX(p: Particle): number {
  return p.stateVector[0] * Math.cos(p.stateVector[1]);
}

export function particleY(p: Particle): number {
  return p.stateVector[0] * Math.sin(p.stateVector[1]);
}

export function getCoordinateTimeRate(p: Particle): number {
  return coordinateTimeRate({
    radius: p.stateVector[0],
    specificEnergy: p.specificEnergy,
    angularMomentum: p.angularMomentum,
    spin: p.spin,
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
