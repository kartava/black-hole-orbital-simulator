import { ParticleStatus, particleX, particleY } from "../domain/particle";
import type { Particle } from "../domain/particle";
import type { SimulationState } from "../application/simulation-engine";

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
  getState: () => SimulationState;
  setState: (newState: SimulationState) => void;
  setPaused: (paused: boolean) => void;
}): void {
  const { canvas, getState, setState, setPaused } = props;

  let lastTouchTimestamp = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let pinchStartDistance = 0;
  let pinchStartScale = 0;
  let wasPinch = false;

  canvas.addEventListener("click", (event) => {
    // Skip synthetic click fired after touchend to avoid double-selecting.
    if (performance.now() - lastTouchTimestamp < 500) return;
    const state = getState();
    const boundingRect = canvas.getBoundingClientRect();
    const worldX =
      (event.clientX - boundingRect.left - canvas.width / 2) /
      state.camera.scale;
    const worldY =
      -(event.clientY - boundingRect.top - canvas.height / 2) /
      state.camera.scale;
    const nearestId = findNearestParticle({
      particles: state.particles,
      worldX: worldX,
      worldY: worldY,
      selectionRadius: 3,
    });
    if (nearestId !== null)
      setState({ ...state, selectedParticleId: nearestId });
  });

  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const state = getState();
      const factor = event.deltaY < 0 ? 1.12 : 0.89;
      const newScale = Math.max(5, Math.min(200, state.camera.scale * factor));
      setState({ ...state, camera: { scale: newScale } });
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
        pinchStartScale = getState().camera.scale;
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
        const dist = Math.hypot(
          event.touches[0].clientX - event.touches[1].clientX,
          event.touches[0].clientY - event.touches[1].clientY,
        );
        setState({
          ...getState(),
          camera: {
            scale: Math.max(
              5,
              Math.min(200, pinchStartScale * (dist / pinchStartDistance)),
            ),
          },
        });
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
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      if (Math.hypot(dx, dy) < 12) {
        const state = getState();
        const rect = canvas.getBoundingClientRect();
        const worldX =
          (touch.clientX - rect.left - canvas.width / 2) / state.camera.scale;
        const worldY =
          -(touch.clientY - rect.top - canvas.height / 2) / state.camera.scale;
        const nearestId = findNearestParticle({
          particles: state.particles,
          worldX: worldX,
          worldY: worldY,
          selectionRadius: 5,
        });
        if (nearestId !== null)
          setState({ ...state, selectedParticleId: nearestId });
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
    setPaused(!getState().paused);
  });
}
