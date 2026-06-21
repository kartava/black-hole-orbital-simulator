import { ParticleStatus } from "../../domain/particle";
import type { Particle } from "../../domain/particle";
import { particleX, particleY } from "../../domain/particle";
import { tidalStretchFactor } from "../../domain/orbit";
import { blackHoleGeometry } from "../../domain/black-hole";
import type { Camera, DisplayOptions } from "../../types";
import { drawAccretionDisk, drawOrbitRings } from "./overlays";
import { drawEffectivePotentialPanel, drawTimeDilationPanel } from "./panels";

interface Star {
  x: number;
  y: number;
  radius: number;
  opacity: number;
}

const STAR_COUNT = 220;
let backgroundStars: Star[] = [];

export function initializeBackgroundStars(props: {
  canvasWidth: number;
  canvasHeight: number;
}): void {
  const { canvasWidth, canvasHeight } = props;
  backgroundStars = Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random() * canvasWidth,
    y: Math.random() * canvasHeight,
    radius: Math.random() * 1.4 + 0.3,
    opacity: Math.random() * 0.6 + 0.4,
  }));
}

export function render(props: {
  context: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  particles: readonly Particle[];
  camera: Camera;
  options: DisplayOptions;
  spin: number;
  selectedParticle: Particle | null;
}): void {
  const {
    context,
    canvas,
    particles,
    camera,
    options,
    spin,
    selectedParticle,
  } = props;
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const scale = camera.scale;

  context.fillStyle = "#06071a";
  context.fillRect(0, 0, canvasWidth, canvasHeight);

  backgroundStars.forEach((star) => {
    context.globalAlpha = star.opacity;
    context.fillStyle = "#fff";
    context.beginPath();
    context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    context.fill();
  });
  context.globalAlpha = 1;

  const toScreenCoordinates = (
    worldX: number,
    worldY: number,
  ): [number, number] => [centerX + worldX * scale, centerY - worldY * scale];

  const {
    horizon: horizonRadius,
    ergosphere: ergosphereRadius,
    iscoPrograde: iscoProgradeRadius,
    iscoRetrograde: iscoRetrogradeRadius,
    photonSphere: photonOrbitRadius,
  } = blackHoleGeometry(spin);

  drawAccretionDisk({
    context: context,
    centerX: centerX,
    centerY: centerY,
    scale: scale,
    iscoRadius: iscoProgradeRadius,
  });

  // Glow haze around the horizon — drawn before ergosphere so the ergosphere
  // renders on top of it rather than being buried underneath.
  const eventHorizonScreenRadius = horizonRadius * scale;
  const glowGradient = context.createRadialGradient(
    centerX,
    centerY,
    0,
    centerX,
    centerY,
    eventHorizonScreenRadius * 2.2,
  );
  glowGradient.addColorStop(0, "rgba(0,0,0,1)");
  glowGradient.addColorStop(0.75, "rgba(0,0,0,0.95)");
  glowGradient.addColorStop(1, "rgba(30,10,60,0)");
  context.beginPath();
  context.arc(centerX, centerY, eventHorizonScreenRadius * 2.2, 0, Math.PI * 2);
  context.fillStyle = glowGradient;
  context.fill();

  drawOrbitRings({
    context: context,
    centerX: centerX,
    centerY: centerY,
    scale: scale,
    spin: spin,
    horizonRadius: horizonRadius,
    ergosphereRadius: ergosphereRadius,
    iscoProgradeRadius: iscoProgradeRadius,
    iscoRetrogradeRadius: iscoRetrogradeRadius,
    photonOrbitRadius: photonOrbitRadius,
    showISCO: options.showISCO,
    showPhotonSphere: options.showPhotonSphere,
    toScreenCoordinates: toScreenCoordinates,
  });

  // Solid event horizon disk — covers any ergosphere fill that bled inside r₊.
  context.beginPath();
  context.arc(centerX, centerY, eventHorizonScreenRadius, 0, Math.PI * 2);
  context.fillStyle = "#000";
  context.fill();

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

  let panelBottomEdge = canvasHeight - 12;

  if (options.showEffectivePotential && selectedParticle) {
    const panelHeight = 130;
    panelBottomEdge -= panelHeight;
    drawEffectivePotentialPanel({
      context: context,
      canvasWidth: canvasWidth,
      panelOriginY: panelBottomEdge,
      particle: selectedParticle,
      spin: spin,
      horizonRadius: horizonRadius,
    });
    panelBottomEdge -= 10;
  }

  if (options.showTimeDilationPanel && selectedParticle) {
    const panelHeight = 100;
    panelBottomEdge -= panelHeight;
    drawTimeDilationPanel({
      context: context,
      canvasWidth: canvasWidth,
      panelOriginY: panelBottomEdge,
      particle: selectedParticle,
    });
  }
}
