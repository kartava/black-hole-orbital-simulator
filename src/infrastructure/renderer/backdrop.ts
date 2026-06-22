export interface Star {
  x: number;
  y: number;
  radius: number;
  opacity: number;
}

const STAR_COUNT = 220;

export function generateStars(props: {
  canvasWidth: number;
  canvasHeight: number;
}): Star[] {
  const { canvasWidth, canvasHeight } = props;
  return Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random() * canvasWidth,
    y: Math.random() * canvasHeight,
    radius: Math.random() * 1.4 + 0.3,
    opacity: Math.random() * 0.6 + 0.4,
  }));
}

export function drawSpaceBackdrop(props: {
  context: CanvasRenderingContext2D;
  canvasWidth: number;
  canvasHeight: number;
  stars: readonly Star[];
}): void {
  const { context, canvasWidth, canvasHeight, stars } = props;
  context.fillStyle = "#06071a";
  context.fillRect(0, 0, canvasWidth, canvasHeight);

  stars.forEach((star) => {
    context.globalAlpha = star.opacity;
    context.fillStyle = "#fff";
    context.beginPath();
    context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    context.fill();
  });
  context.globalAlpha = 1;
}
