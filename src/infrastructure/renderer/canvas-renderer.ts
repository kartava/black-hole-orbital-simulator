import type { Particle } from "@domain/particle";

import { worldToScreen } from "@src/camera";
import type { Camera, DisplayOptions } from "@src/types";

import type { Star } from "@infrastructure/renderer/backdrop";

import {
  drawAccretionDisk,
  drawHorizonGlow,
  drawOrbitRings,
  drawEventHorizonDisk,
} from "@infrastructure/renderer/overlays";
import {
  drawEffectivePotentialPanel,
  drawTimeDilationPanel,
} from "@infrastructure/renderer/panels";
import {
  generateStars,
  drawSpaceBackdrop,
} from "@infrastructure/renderer/backdrop";
import { drawParticles } from "@infrastructure/renderer/particles";

import { blackHoleGeometry } from "@domain/black-hole";

export interface RenderProps {
  context: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  particles: readonly Particle[];
  camera: Camera;
  options: DisplayOptions;
  spin: number;
  selectedParticle: Particle | null;
}

export interface Renderer {
  render(props: RenderProps): void;
  resize(props: { canvasWidth: number; canvasHeight: number }): void;
}

export function createRenderer(): Renderer {
  let backgroundStars: Star[] = [];
  return {
    resize: (props) => {
      backgroundStars = generateStars(props);
    },
    render: (props) =>
      renderScene({ ...props, backgroundStars: backgroundStars }),
  };
}

// Composition root for a frame. Owns only the draw order — each layer's drawing
// lives in its own module (backdrop, overlays, particles, panels).
function renderScene(
  props: RenderProps & { backgroundStars: readonly Star[] },
): void {
  const {
    context,
    canvas,
    particles,
    camera,
    options,
    spin,
    selectedParticle,
    backgroundStars,
  } = props;
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const scale = camera.scale;

  const toScreenCoordinates = (
    worldX: number,
    worldY: number,
  ): readonly [number, number] =>
    worldToScreen({
      worldX: worldX,
      worldY: worldY,
      canvasWidth: canvasWidth,
      canvasHeight: canvasHeight,
      scale: scale,
    });

  drawSpaceBackdrop({
    context: context,
    canvasWidth: canvasWidth,
    canvasHeight: canvasHeight,
    stars: backgroundStars,
  });

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
  drawHorizonGlow({
    context: context,
    centerX: centerX,
    centerY: centerY,
    horizonRadius: horizonRadius,
    scale: scale,
  });
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
  drawEventHorizonDisk({
    context: context,
    centerX: centerX,
    centerY: centerY,
    horizonRadius: horizonRadius,
    scale: scale,
  });

  drawParticles({
    context: context,
    particles: particles,
    options: options,
    scale: scale,
    toScreenCoordinates: toScreenCoordinates,
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
