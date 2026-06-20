import {
  rungeKutta4Step,
  outerEventHorizonRadius,
  coordinateTimeRate,
  effectivePotential,
} from "./physics";

const TRAIL_MAX_LENGTH = 800;
const ESCAPE_RADIUS = 600;

interface TrailPoint {
  x: number;
  y: number;
}

interface ParticleOptions {
  radius: number;
  azimuthalAngle?: number;
  radialVelocity?: number;
  angularMomentum: number;
  specificEnergy: number;
  spin?: number;
  color: string;
  label?: string;
}

export class Particle {
  stateVector: number[];
  readonly angularMomentum: number;
  readonly specificEnergy: number;
  readonly spin: number;
  readonly color: string;
  readonly label: string;
  trail: TrailPoint[];
  alive: boolean;
  captured: boolean;
  escaped: boolean;
  properTime: number;
  coordinateTime: number;

  constructor({
    radius,
    azimuthalAngle = 0,
    radialVelocity = 0,
    angularMomentum,
    specificEnergy,
    spin = 0,
    color,
    label,
  }: ParticleOptions) {
    this.stateVector = [radius, azimuthalAngle, radialVelocity];
    this.angularMomentum = angularMomentum;
    this.specificEnergy = specificEnergy;
    this.spin = spin;
    this.color = color;
    this.label = label ?? "";
    this.trail = [];
    this.alive = true;
    this.captured = false;
    this.escaped = false;
    this.properTime = 0;
    this.coordinateTime = 0;
  }

  step(props: { properTimeDelta: number; integrationSubsteps: number }): void {
    const { properTimeDelta, integrationSubsteps } = props;
    if (!this.alive) return;
    const captureRadius = outerEventHorizonRadius(this.spin) * 1.02;

    for (let stepIndex = 0; stepIndex < integrationSubsteps; stepIndex++) {
      const nextState = rungeKutta4Step({
        stateVector: this.stateVector,
        angularMomentum: this.angularMomentum,
        specificEnergy: this.specificEnergy,
        spin: this.spin,
        timeStep: properTimeDelta,
      });
      const [radius, azimuthalAngle] = nextState;

      if (radius <= captureRadius || !isFinite(radius)) {
        this.alive = false;
        this.captured = true;
        return;
      }
      if (radius > ESCAPE_RADIUS) {
        this.alive = false;
        this.escaped = true;
        return;
      }

      this.stateVector = nextState;
      this.properTime += properTimeDelta;
      this.coordinateTime +=
        coordinateTimeRate({
          radius,
          specificEnergy: this.specificEnergy,
          angularMomentum: this.angularMomentum,
          spin: this.spin,
        }) * properTimeDelta;

      this.trail.push({
        x: radius * Math.cos(azimuthalAngle),
        y: radius * Math.sin(azimuthalAngle),
      });
      if (this.trail.length > TRAIL_MAX_LENGTH) this.trail.shift();
    }
  }

  get radius(): number {
    return this.stateVector[0];
  }

  get azimuthalAngle(): number {
    return this.stateVector[1];
  }

  get x(): number {
    return this.radius * Math.cos(this.azimuthalAngle);
  }

  get y(): number {
    return this.radius * Math.sin(this.azimuthalAngle);
  }

  get effectivePotentialValue(): number {
    return effectivePotential({
      radius: this.radius,
      angularMomentum: this.angularMomentum,
      specificEnergy: this.specificEnergy,
      spin: this.spin,
    });
  }

  get coordinateTimeRate(): number {
    return coordinateTimeRate({
      radius: this.radius,
      specificEnergy: this.specificEnergy,
      angularMomentum: this.angularMomentum,
      spin: this.spin,
    });
  }
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
