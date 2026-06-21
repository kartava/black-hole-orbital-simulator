import {
  COLOR_ERGOSPHERE,
  COLOR_ISCO_PROGRADE,
  COLOR_ISCO_RETROGRADE,
  COLOR_PHOTON_SPHERE,
  TEXT_SECONDARY,
} from "../../colors";

export function drawAccretionDisk(props: {
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

export function drawCircleRing(props: {
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

export function drawLabel(props: {
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

export function drawOrbitRings(props: {
  context: CanvasRenderingContext2D;
  centerX: number;
  centerY: number;
  scale: number;
  spin: number;
  horizonRadius: number;
  ergosphereRadius: number;
  iscoProgradeRadius: number;
  iscoRetrogradeRadius: number;
  photonOrbitRadius: number;
  showISCO: boolean;
  showPhotonSphere: boolean;
  toScreenCoordinates: (x: number, y: number) => [number, number];
}): void {
  const {
    context,
    centerX,
    centerY,
    scale,
    spin,
    horizonRadius,
    ergosphereRadius,
    iscoProgradeRadius,
    iscoRetrogradeRadius,
    photonOrbitRadius,
    showISCO,
    showPhotonSphere,
    toScreenCoordinates,
  } = props;

  if (spin > 0.01) {
    const ergosphereGradient = context.createRadialGradient(
      centerX,
      centerY,
      horizonRadius * scale,
      centerX,
      centerY,
      ergosphereRadius * scale,
    );
    ergosphereGradient.addColorStop(0, "rgba(120,50,200,0.35)");
    ergosphereGradient.addColorStop(1, "rgba(120,50,200,0)");
    context.beginPath();
    context.arc(centerX, centerY, ergosphereRadius * scale, 0, Math.PI * 2);
    context.fillStyle = ergosphereGradient;
    context.fill();
    drawCircleRing({
      context,
      centerX,
      centerY,
      ringRadius: ergosphereRadius * scale,
      ringColor: COLOR_ERGOSPHERE,
      opacity: 0.45,
      dashPattern: [3, 5],
    });
    const [ex, ey] = toScreenCoordinates(0, ergosphereRadius);
    drawLabel({
      context,
      posX: ex + 5,
      posY: ey - 4,
      labelText: "Ergosphere  2M",
      labelColor: COLOR_ERGOSPHERE,
    });
  }

  if (showISCO) {
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

  if (showPhotonSphere)
    drawCircleRing({
      context,
      centerX,
      centerY,
      ringRadius: photonOrbitRadius * scale,
      ringColor: COLOR_PHOTON_SPHERE,
      opacity: 0.55,
      dashPattern: [4, 4],
    });

  if (showISCO) {
    const [ix, iy] = toScreenCoordinates(0, iscoProgradeRadius);
    drawLabel({
      context,
      posX: ix + 5,
      posY: iy - 4,
      labelText: `ISCO  ${iscoProgradeRadius.toFixed(1)}M`,
      labelColor: COLOR_ISCO_PROGRADE,
    });
    if (spin > 0.01) {
      const [rx, ry] = toScreenCoordinates(0, iscoRetrogradeRadius);
      drawLabel({
        context,
        posX: rx + 5,
        posY: ry - 4,
        labelText: `ISCO⁻  ${iscoRetrogradeRadius.toFixed(1)}M`,
        labelColor: COLOR_ISCO_RETROGRADE,
      });
    }
  }

  if (showPhotonSphere) {
    const [px, py] = toScreenCoordinates(0, photonOrbitRadius);
    drawLabel({
      context,
      posX: px + 5,
      posY: py - 4,
      labelText: `Photon sphere  ${photonOrbitRadius.toFixed(1)}M`,
      labelColor: COLOR_PHOTON_SPHERE,
    });
  }

  const [hx, hy] = toScreenCoordinates(0, horizonRadius);
  drawLabel({
    context,
    posX: hx + 5,
    posY: hy - 4,
    labelText: `r₊  ${horizonRadius.toFixed(2)}M`,
    labelColor: TEXT_SECONDARY,
  });
}
