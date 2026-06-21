// Single source of truth for the world<->screen mapping. World coordinates are in
// units of M with +y pointing up; screen coordinates are canvas-local pixels
// with +y pointing down, origin at the canvas centre. The two functions below
// are exact inverses — keep them that way.

export function worldToScreen(props: {
  worldX: number;
  worldY: number;
  canvasWidth: number;
  canvasHeight: number;
  scale: number;
}): readonly [number, number] {
  const { worldX, worldY, canvasWidth, canvasHeight, scale } = props;
  return [canvasWidth / 2 + worldX * scale, canvasHeight / 2 - worldY * scale];
}

export function screenToWorld(props: {
  screenX: number;
  screenY: number;
  canvasWidth: number;
  canvasHeight: number;
  scale: number;
}): { worldX: number; worldY: number } {
  const { screenX, screenY, canvasWidth, canvasHeight, scale } = props;
  return {
    worldX: (screenX - canvasWidth / 2) / scale,
    worldY: -(screenY - canvasHeight / 2) / scale,
  };
}
