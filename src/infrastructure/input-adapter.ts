import { ParticleStatus, particleX, particleY } from "../domain/particle";
import type { Particle } from "../domain/particle";
import type { SimulationState } from "../application/simulation-engine";
import type { ViewState } from "../types";
import { screenToWorld } from "../camera";

const MIN_CAMERA_SCALE = 5;
const MAX_CAMERA_SCALE = 200;

function findNearestParticle(props: {
  particles: readonly Particle[];
  worldX: number;
  worldY: number;
  selectionRadius: number;
}): string | null {
  const { particles, worldX, worldY, selectionRadius } = props;
  let nearestId: string | null = null;
  let nearestDistance = Infinity;
  for (const particle of particles) {
    if (particle.status !== ParticleStatus.ALIVE) continue;
    const distance = Math.hypot(
      particleX(particle) - worldX,
      particleY(particle) - worldY,
    );
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestId = particle.id;
    }
  }
  return nearestId !== null && nearestDistance < selectionRadius
    ? nearestId
    : null;
}

export function buildInputAdapter(props: {
  canvas: HTMLCanvasElement;
  getSimulationState: () => SimulationState;
  setSimulationState: (newState: SimulationState) => void;
  getViewState: () => ViewState;
  setViewState: (newState: ViewState) => void;
  setPaused: (paused: boolean) => void;
}): void {
  const {
    canvas,
    getSimulationState,
    setSimulationState,
    getViewState,
    setViewState,
    setPaused,
  } = props;

  let lastTouchTimestamp = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let pinchStartDistance = 0;
  let pinchStartScale = 0;
  let wasPinch = false;

  const clampScale = (scale: number): number =>
    Math.max(MIN_CAMERA_SCALE, Math.min(MAX_CAMERA_SCALE, scale));

  const setCameraScale = (scale: number): void => {
    const viewState = getViewState();
    setViewState({ ...viewState, camera: { scale: clampScale(scale) } });
  };

  const selectParticleAt = (props: {
    clientX: number;
    clientY: number;
    selectionRadius: number;
  }): void => {
    const { clientX, clientY, selectionRadius } = props;
    const simulationState = getSimulationState();
    const boundingRect = canvas.getBoundingClientRect();
    const { worldX, worldY } = screenToWorld({
      screenX: clientX - boundingRect.left,
      screenY: clientY - boundingRect.top,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      scale: getViewState().camera.scale,
    });
    const nearestId = findNearestParticle({
      particles: simulationState.particles,
      worldX: worldX,
      worldY: worldY,
      selectionRadius: selectionRadius,
    });
    if (nearestId !== null)
      setSimulationState({ ...simulationState, selectedParticleId: nearestId });
  };

  canvas.addEventListener("click", (event) => {
    // Skip synthetic click fired after touchend to avoid double-selecting.
    if (performance.now() - lastTouchTimestamp < 500) return;
    selectParticleAt({
      clientX: event.clientX,
      clientY: event.clientY,
      selectionRadius: 3,
    });
  });

  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.12 : 0.89;
      setCameraScale(getViewState().camera.scale * factor);
    },
    { passive: false },
  );

  canvas.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length === 1) {
        wasPinch = false;
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
      } else if (event.touches.length === 2) {
        wasPinch = true;
        event.preventDefault();
        pinchStartDistance = Math.hypot(
          event.touches[0].clientX - event.touches[1].clientX,
          event.touches[0].clientY - event.touches[1].clientY,
        );
        pinchStartScale = getViewState().camera.scale;
      }
    },
    { passive: false },
  );

  canvas.addEventListener(
    "touchmove",
    (event) => {
      if (event.touches.length === 2) {
        event.preventDefault();
        if (pinchStartDistance === 0) return;
        const distance = Math.hypot(
          event.touches[0].clientX - event.touches[1].clientX,
          event.touches[0].clientY - event.touches[1].clientY,
        );
        setCameraScale(pinchStartScale * (distance / pinchStartDistance));
      }
    },
    { passive: false },
  );

  canvas.addEventListener("touchend", (event) => {
    if (
      !wasPinch &&
      event.touches.length === 0 &&
      event.changedTouches.length === 1
    ) {
      lastTouchTimestamp = performance.now();
      const touch = event.changedTouches[0];
      const dragX = touch.clientX - touchStartX;
      const dragY = touch.clientY - touchStartY;
      if (Math.hypot(dragX, dragY) < 12) {
        selectParticleAt({
          clientX: touch.clientX,
          clientY: touch.clientY,
          selectionRadius: 5,
        });
      }
    }
    if (event.touches.length === 0) wasPinch = false;
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== " ") return;
    const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
    if (
      activeTag &&
      ["INPUT", "BUTTON", "SELECT", "TEXTAREA"].includes(activeTag)
    )
      return;
    event.preventDefault();
    setPaused(!getSimulationState().paused);
  });
}
