import type { Particle } from "./particles";
import {
  effectivePotential,
  tidalStretchFactor,
  blackHoleGeometry,
} from "./physics";
import type { Camera, DisplayOptions } from "./types";
import {
  PANEL_BG,
  PANEL_BORDER,
  TEXT_SECONDARY,
  COLOR_ERGOSPHERE,
  COLOR_ISCO_PROGRADE,
  COLOR_ISCO_RETROGRADE,
  COLOR_PHOTON_SPHERE,
} from "./colors";

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
  particles: Particle[];
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
    ergosphere: ergosphereRadiusValue,
    iscoPrograde: iscoProgradeRadius,
    iscoRetrograde: iscoRetrogradeRadius,
    photonSphere: photonOrbitRadiusValue,
  } = blackHoleGeometry(spin);

  drawAccretionDisk({
    context,
    centerX,
    centerY,
    scale,
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

  // Ergosphere shaded region — on top of glow, inside r₊ will be
  // covered by the solid horizon disk drawn immediately after.
  if (spin > 0.01) {
    const ergosphereGradient = context.createRadialGradient(
      centerX,
      centerY,
      horizonRadius * scale,
      centerX,
      centerY,
      ergosphereRadiusValue * scale,
    );
    ergosphereGradient.addColorStop(0, "rgba(120,50,200,0.35)");
    ergosphereGradient.addColorStop(1, "rgba(120,50,200,0)");
    context.beginPath();
    context.arc(
      centerX,
      centerY,
      ergosphereRadiusValue * scale,
      0,
      Math.PI * 2,
    );
    context.fillStyle = ergosphereGradient;
    context.fill();
    drawCircleRing({
      context,
      centerX,
      centerY,
      ringRadius: ergosphereRadiusValue * scale,
      ringColor: COLOR_ERGOSPHERE,
      opacity: 0.45,
      dashPattern: [3, 5],
    });
    const [ergosphereLabelX, ergosphereLabelY] = toScreenCoordinates(
      0,
      ergosphereRadiusValue,
    );
    drawLabel({
      context,
      posX: ergosphereLabelX + 5,
      posY: ergosphereLabelY - 4,
      labelText: "Ergosphere  2M",
      labelColor: COLOR_ERGOSPHERE,
    });
  }

  // Solid event horizon disk — covers any ergosphere fill that bled inside r₊.
  context.beginPath();
  context.arc(centerX, centerY, eventHorizonScreenRadius, 0, Math.PI * 2);
  context.fillStyle = "#000";
  context.fill();

  if (options.showISCO) {
    drawCircleRing({
      context,
      centerX,
      centerY,
      ringRadius: iscoProgradeRadius * scale,
      ringColor: COLOR_ISCO_PROGRADE,
      opacity: 0.45,
      dashPattern: [8, 6],
    });
    if (spin > 0.01)
      drawCircleRing({
        context,
        centerX,
        centerY,
        ringRadius: iscoRetrogradeRadius * scale,
        ringColor: COLOR_ISCO_RETROGRADE,
        opacity: 0.3,
        dashPattern: [4, 8],
      });
  }
  if (options.showPhotonSphere)
    drawCircleRing({
      context,
      centerX,
      centerY,
      ringRadius: photonOrbitRadiusValue * scale,
      ringColor: COLOR_PHOTON_SPHERE,
      opacity: 0.55,
      dashPattern: [4, 4],
    });

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

    if (particle.alive) {
      const [screenX, screenY] = toScreenCoordinates(particle.x, particle.y);

      if (options.showTidalStretching) {
        const tidalMagnitude = tidalStretchFactor(particle.radius);
        const stretch = Math.min(tidalMagnitude * 40, 3.5);
        const radialDirection = particle.azimuthalAngle;
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

  if (options.showISCO) {
    const [iscoLabelX, iscoLabelY] = toScreenCoordinates(0, iscoProgradeRadius);
    drawLabel({
      context,
      posX: iscoLabelX + 5,
      posY: iscoLabelY - 4,
      labelText: `ISCO  ${iscoProgradeRadius.toFixed(1)}M`,
      labelColor: COLOR_ISCO_PROGRADE,
    });
    if (spin > 0.01) {
      const [retrogradeLabelX, retrogradeLabelY] = toScreenCoordinates(
        0,
        iscoRetrogradeRadius,
      );
      drawLabel({
        context,
        posX: retrogradeLabelX + 5,
        posY: retrogradeLabelY - 4,
        labelText: `ISCO⁻  ${iscoRetrogradeRadius.toFixed(1)}M`,
        labelColor: COLOR_ISCO_RETROGRADE,
      });
    }
  }
  if (options.showPhotonSphere) {
    const [photonLabelX, photonLabelY] = toScreenCoordinates(
      0,
      photonOrbitRadiusValue,
    );
    drawLabel({
      context,
      posX: photonLabelX + 5,
      posY: photonLabelY - 4,
      labelText: `Photon sphere  ${photonOrbitRadiusValue.toFixed(1)}M`,
      labelColor: COLOR_PHOTON_SPHERE,
    });
  }
  const [horizonLabelX, horizonLabelY] = toScreenCoordinates(0, horizonRadius);
  drawLabel({
    context,
    posX: horizonLabelX + 5,
    posY: horizonLabelY - 4,
    labelText: `r₊  ${horizonRadius.toFixed(2)}M`,
    labelColor: TEXT_SECONDARY,
  });

  // Stack info panels from bottom edge upward
  let panelBottomEdge = canvasHeight - 12;

  if (options.showEffectivePotential && selectedParticle) {
    const panelHeight = 130;
    panelBottomEdge -= panelHeight;
    drawEffectivePotentialPanel({
      context,
      canvasWidth,
      panelOriginY: panelBottomEdge,
      particle: selectedParticle,
      spin,
      horizonRadius,
    });
    panelBottomEdge -= 10;
  }

  if (options.showTimeDilationPanel && selectedParticle) {
    const panelHeight = 100;
    panelBottomEdge -= panelHeight;
    drawTimeDilationPanel({
      context,
      canvasWidth,
      panelOriginY: panelBottomEdge,
      particle: selectedParticle,
    });
  }
}

function drawAccretionDisk(props: {
  context: CanvasRenderingContext2D;
  centerX: number;
  centerY: number;
  scale: number;
  iscoRadius: number;
}): void {
  const { context, centerX, centerY, scale, iscoRadius } = props;
  const innerScreenRadius = iscoRadius * scale;
  const outerScreenRadius = 22 * scale;
  if (innerScreenRadius >= outerScreenRadius) return;

  // Novikov-Thorne profile: zero emission at ISCO, peak just outside, power-law falloff.
  // Color stops are fractions of (outerScreenRadius − innerScreenRadius).
  const disk = context.createRadialGradient(
    centerX,
    centerY,
    innerScreenRadius,
    centerX,
    centerY,
    outerScreenRadius,
  );
  disk.addColorStop(0.0, "rgba(255, 190,  50, 0.00)");
  disk.addColorStop(0.03, "rgba(255, 190,  50, 0.75)");
  disk.addColorStop(0.1, "rgba(255, 130,  20, 0.60)");
  disk.addColorStop(0.22, "rgba(230,  80,  10, 0.38)");
  disk.addColorStop(0.4, "rgba(180,  40,   0, 0.20)");
  disk.addColorStop(0.65, "rgba(120,  20,   0, 0.08)");
  disk.addColorStop(1.0, "rgba( 80,  10,   0, 0.00)");

  context.beginPath();
  context.arc(centerX, centerY, outerScreenRadius, 0, Math.PI * 2);
  context.fillStyle = disk;
  context.fill();
}

function drawCircleRing(props: {
  context: CanvasRenderingContext2D;
  centerX: number;
  centerY: number;
  ringRadius: number;
  ringColor: string;
  opacity: number;
  dashPattern: number[];
}): void {
  const {
    context,
    centerX,
    centerY,
    ringRadius,
    ringColor,
    opacity,
    dashPattern,
  } = props;
  context.beginPath();
  context.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
  context.setLineDash(dashPattern);
  context.strokeStyle = ringColor;
  context.lineWidth = 1.2;
  context.globalAlpha = opacity;
  context.stroke();
  context.setLineDash([]);
  context.globalAlpha = 1;
}

function drawLabel(props: {
  context: CanvasRenderingContext2D;
  posX: number;
  posY: number;
  labelText: string;
  labelColor: string;
}): void {
  const { context, posX, posY, labelText, labelColor } = props;
  context.font = "11px monospace";
  context.fillStyle = labelColor;
  context.globalAlpha = 0.8;
  context.fillText(labelText, posX, posY);
  context.globalAlpha = 1;
}

function drawEffectivePotentialPanel(props: {
  context: CanvasRenderingContext2D;
  canvasWidth: number;
  panelOriginY: number;
  particle: Particle;
  spin: number;
  horizonRadius: number;
}): void {
  const { context, canvasWidth, panelOriginY, particle, spin, horizonRadius } =
    props;
  const panelWidth = 220;
  const panelHeight = 130;
  const panelOriginX = canvasWidth - panelWidth - 12;

  const angularMomentum = particle.angularMomentum;
  const specificEnergy = particle.specificEnergy;
  const energySquared = specificEnergy * specificEnergy;
  const plotRadiusMin = horizonRadius * 1.05;
  const plotRadiusMax = 25;
  const potentialMin = 0;
  const potentialMax = 1.8;

  context.fillStyle = PANEL_BG;
  context.strokeStyle = PANEL_BORDER;
  context.lineWidth = 1;
  context.beginPath();
  context.roundRect(panelOriginX, panelOriginY, panelWidth, panelHeight, 6);
  context.fill();
  context.stroke();

  const toPlotCoordinates = (
    plotRadius: number,
    potentialValue: number,
  ): [number, number] => [
    panelOriginX +
      ((plotRadius - plotRadiusMin) / (plotRadiusMax - plotRadiusMin)) *
        (panelWidth - 30) +
      20,
    panelOriginY +
      panelHeight -
      16 -
      ((potentialValue - potentialMin) / (potentialMax - potentialMin)) *
        (panelHeight - 28),
  ];

  if (energySquared < potentialMax) {
    const [energyLineStartX, energyLineY] = toPlotCoordinates(
      plotRadiusMin,
      energySquared,
    );
    const [energyLineEndX] = toPlotCoordinates(plotRadiusMax, energySquared);
    context.beginPath();
    context.moveTo(energyLineStartX, energyLineY);
    context.lineTo(energyLineEndX, energyLineY);
    context.setLineDash([4, 3]);
    context.strokeStyle = particle.color;
    context.lineWidth = 1.2;
    context.globalAlpha = 0.7;
    context.stroke();
    context.setLineDash([]);
    context.globalAlpha = 1;
    context.font = "10px monospace";
    context.fillStyle = particle.color;
    context.fillText("E²", energyLineEndX - 20, energyLineY - 3);
  }

  context.beginPath();
  let isFirstCurvePoint = true;
  for (
    let sampleRadius = plotRadiusMin;
    sampleRadius <= plotRadiusMax;
    sampleRadius += 0.12
  ) {
    const potentialValue = effectivePotential({
      radius: sampleRadius,
      angularMomentum,
      specificEnergy,
      spin,
    });
    if (
      !isFinite(potentialValue) ||
      potentialValue > potentialMax ||
      potentialValue < potentialMin
    ) {
      isFirstCurvePoint = true;
      continue;
    }
    const [curvePointX, curvePointY] = toPlotCoordinates(
      sampleRadius,
      potentialValue,
    );
    if (isFirstCurvePoint) {
      context.moveTo(curvePointX, curvePointY);
      isFirstCurvePoint = false;
    } else {
      context.lineTo(curvePointX, curvePointY);
    }
  }
  context.strokeStyle = "#a78bfa";
  context.lineWidth = 1.8;
  context.stroke();

  if (particle.radius >= plotRadiusMin && particle.radius <= plotRadiusMax) {
    const currentPotentialValue = effectivePotential({
      radius: particle.radius,
      angularMomentum,
      specificEnergy,
      spin,
    });
    if (
      isFinite(currentPotentialValue) &&
      currentPotentialValue >= potentialMin &&
      currentPotentialValue <= potentialMax
    ) {
      const [dotX, dotY] = toPlotCoordinates(
        particle.radius,
        currentPotentialValue,
      );
      context.beginPath();
      context.arc(dotX, dotY, 4, 0, Math.PI * 2);
      context.fillStyle = particle.color;
      context.fill();
    }
  }

  context.font = "10px monospace";
  context.fillStyle = TEXT_SECONDARY;
  context.fillText("V²(r)", panelOriginX + 8, panelOriginY + 12);
  context.fillText(
    "r/M →",
    panelOriginX + panelWidth - 38,
    panelOriginY + panelHeight - 6,
  );
}

function drawTimeDilationPanel(props: {
  context: CanvasRenderingContext2D;
  canvasWidth: number;
  panelOriginY: number;
  particle: Particle;
}): void {
  const { context, canvasWidth, panelOriginY, particle } = props;
  const panelWidth = 220;
  const panelHeight = 100;
  const panelOriginX = canvasWidth - panelWidth - 12;

  context.fillStyle = PANEL_BG;
  context.strokeStyle = PANEL_BORDER;
  context.lineWidth = 1;
  context.beginPath();
  context.roundRect(panelOriginX, panelOriginY, panelWidth, panelHeight, 6);
  context.fill();
  context.stroke();

  context.font = "10px monospace";
  context.fillStyle = TEXT_SECONDARY;
  context.fillText("TIME DILATION", panelOriginX + 8, panelOriginY + 14);

  const coordinateTimeValue = particle.coordinateTime;
  const properTimeValue = particle.properTime;
  const properToCoordTimeRatio =
    coordinateTimeValue > 0 ? properTimeValue / coordinateTimeValue : 1;
  const currentCoordinateTimeRate = particle.alive
    ? particle.coordinateTimeRate
    : 1;

  const barWidth = panelWidth - 60;
  const barHeight = 10;
  const barStartX = panelOriginX + 8;
  const observerBarY = panelOriginY + 28;
  const particleBarY = panelOriginY + 58;
  const timeRatioFraction = Math.min(properToCoordTimeRatio, 1);

  context.fillStyle = "#6366f1";
  context.fillRect(barStartX, observerBarY, barWidth, barHeight);

  // Particle (proper time) bar — length proportional to τ/t
  context.fillStyle = "#1e293b";
  context.fillRect(barStartX, particleBarY, barWidth, barHeight);
  context.fillStyle = particle.color;
  context.fillRect(
    barStartX,
    particleBarY,
    barWidth * timeRatioFraction,
    barHeight,
  );

  context.font = "10px monospace";
  context.fillStyle = TEXT_SECONDARY;
  context.fillText("Observer  t", barStartX, observerBarY - 3);
  context.fillText(
    `Particle  τ  (dτ/dt = ${properToCoordTimeRatio.toFixed(3)})`,
    barStartX,
    particleBarY - 3,
  );

  context.fillStyle = "#e2e8f0";
  context.font = "11px monospace";
  context.fillText(
    `dτ/dt now: ${(1 / currentCoordinateTimeRate).toFixed(4)}`,
    panelOriginX + 8,
    panelOriginY + 86,
  );
}
