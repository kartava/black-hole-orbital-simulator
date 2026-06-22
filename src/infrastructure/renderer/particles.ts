import type { Particle } from "@domain/particle";
import type { DisplayOptions } from "@src/types";

import { tidalStretchFactor } from "@domain/orbit";
import { ParticleStatus, particleX, particleY } from "@domain/particle";

export function drawParticles(props: {
  context: CanvasRenderingContext2D;
  particles: readonly Particle[];
  options: DisplayOptions;
  scale: number;
  toScreenCoordinates: (
    worldX: number,
    worldY: number,
  ) => readonly [number, number];
}): void {
  const { context, particles, options, scale, toScreenCoordinates } = props;

  particles.forEach((particle) => {
    if (particle.trail.length >= 2) {
      context.beginPath();
      context.moveTo(
        ...toScreenCoordinates(particle.trail[0].x, particle.trail[0].y),
      );
      for (
        let trailIndex = 1;
        trailIndex < particle.trail.length;
        trailIndex++
      ) {
        context.lineTo(
          ...toScreenCoordinates(
            particle.trail[trailIndex].x,
            particle.trail[trailIndex].y,
          ),
        );
      }
      context.strokeStyle = particle.color;
      context.lineWidth = 1.5;
      context.globalAlpha = 0.55;
      context.stroke();
      context.globalAlpha = 1;
    }

    if (particle.status === ParticleStatus.ALIVE) {
      const [screenX, screenY] = toScreenCoordinates(
        particleX(particle),
        particleY(particle),
      );

      if (options.showTidalStretching) {
        const tidalMagnitude = tidalStretchFactor(particle.stateVector[0]);
        const stretch = Math.min(tidalMagnitude * 40, 3.5);
        const radialDirection = particle.stateVector[1];
        const ellipseRadiusX = (4.5 + stretch) * (scale / 25);
        const ellipseRadiusY = Math.max(
          2,
          (4.5 - stretch * 0.5) * (scale / 25),
        );
        context.save();
        context.translate(screenX, screenY);
        context.rotate(-radialDirection);
        context.beginPath();
        context.ellipse(
          0,
          0,
          ellipseRadiusX,
          ellipseRadiusY,
          0,
          0,
          Math.PI * 2,
        );
        context.fillStyle = particle.color;
        context.globalAlpha = 0.85;
        context.fill();
        context.globalAlpha = 1;
        context.restore();
      } else {
        context.beginPath();
        context.arc(screenX, screenY, 4.5, 0, Math.PI * 2);
        context.fillStyle = particle.color;
        context.fill();
      }

      context.beginPath();
      context.arc(screenX, screenY, 7.5, 0, Math.PI * 2);
      context.strokeStyle = particle.color;
      context.lineWidth = 1;
      context.globalAlpha = 0.3;
      context.stroke();
      context.globalAlpha = 1;
    }
  });
}
