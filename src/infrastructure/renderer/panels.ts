import { ParticleStatus } from "@domain/particle";
import type { Particle } from "@domain/particle";

import { effectivePotential } from "@domain/orbit";
import { PANEL_BG, PANEL_BORDER, TEXT_SECONDARY } from "@src/colors";
import { particleRadius, getCoordinateTimeRate } from "@domain/particle";

export function drawEffectivePotentialPanel(props: {
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
      angularMomentum: angularMomentum,
      specificEnergy: specificEnergy,
      spin: spin,
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

  const currentRadius = particleRadius(particle);
  if (currentRadius >= plotRadiusMin && currentRadius <= plotRadiusMax) {
    const currentPotentialValue = effectivePotential({
      radius: currentRadius,
      angularMomentum: angularMomentum,
      specificEnergy: specificEnergy,
      spin: spin,
    });
    if (
      isFinite(currentPotentialValue) &&
      currentPotentialValue >= potentialMin &&
      currentPotentialValue <= potentialMax
    ) {
      const [dotX, dotY] = toPlotCoordinates(
        currentRadius,
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

export function drawTimeDilationPanel(props: {
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
  const currentCoordinateTimeRate =
    particle.status === ParticleStatus.ALIVE
      ? getCoordinateTimeRate(particle)
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
