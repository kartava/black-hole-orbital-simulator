import "./assets/styles.css";
import "./assets/mobile.css";
import { SimulationEngine, createInitialState } from "./application/simulation-engine";
import { Rk4Integrator } from "./infrastructure/rk4-integrator";
import {
  render,
  initializeBackgroundStars,
} from "./infrastructure/renderer/canvas-renderer";
import { buildControls } from "./infrastructure/controls-ui";
import { particleX, particleY } from "./domain/particle";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const context = canvas.getContext("2d")!;
const controlsElement = document.getElementById("controls")!;
const mainElement = document.getElementById("main")!;

const engine = new SimulationEngine(new Rk4Integrator());
let state = createInitialState();

function resize(): void {
  canvas.width = mainElement.offsetWidth;
  canvas.height = mainElement.offsetHeight;
  state = {
    ...state,
    camera: { scale: Math.min(canvas.width, canvas.height) / 48 },
  };
  initializeBackgroundStars({
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
  });
}

resize();
window.addEventListener("resize", resize);

let lastTouchTimestamp = 0;

canvas.addEventListener("click", (event) => {
  // Skip synthetic click fired after touchend to avoid double-selecting.
  if (performance.now() - lastTouchTimestamp < 500) return;
  const boundingRect = canvas.getBoundingClientRect();
  const mouseOffsetX = event.clientX - boundingRect.left - canvas.width / 2;
  const mouseOffsetY = -(event.clientY - boundingRect.top - canvas.height / 2);
  const scale = state.camera.scale;
  const worldX = mouseOffsetX / scale;
  const worldY = mouseOffsetY / scale;

  let nearestId: string | null = null;
  let nearestDistance = Infinity;
  for (const candidate of state.particles) {
    if (!candidate.alive) continue;
    const d = Math.hypot(
      particleX(candidate) - worldX,
      particleY(candidate) - worldY,
    );
    if (d < nearestDistance) {
      nearestDistance = d;
      nearestId = candidate.id;
    }
  }
  if (nearestId && nearestDistance < 3)
    state = { ...state, selectedParticleId: nearestId };
});

canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : 0.89;
    const newScale = Math.max(5, Math.min(200, state.camera.scale * factor));
    state = { ...state, camera: { scale: newScale } };
  },
  { passive: false },
);

let touchStartX = 0;
let touchStartY = 0;
let pinchStartDistance = 0;
let pinchStartScale = 0;
let wasPinch = false;

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
      pinchStartScale = state.camera.scale;
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
      state = {
        ...state,
        camera: {
          scale: Math.max(
            5,
            Math.min(200, pinchStartScale * (dist / pinchStartDistance)),
          ),
        },
      };
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
      const rect = canvas.getBoundingClientRect();
      const offsetX = touch.clientX - rect.left - canvas.width / 2;
      const offsetY = -(touch.clientY - rect.top - canvas.height / 2);
      const worldX = offsetX / state.camera.scale;
      const worldY = offsetY / state.camera.scale;
      let nearestId: string | null = null;
      let nearestDist = Infinity;
      for (const p of state.particles) {
        if (!p.alive) continue;
        const d = Math.hypot(particleX(p) - worldX, particleY(p) - worldY);
        if (d < nearestDist) {
          nearestDist = d;
          nearestId = p.id;
        }
      }
      if (nearestId && nearestDist < 5)
        state = { ...state, selectedParticleId: nearestId };
    }
  }
  if (event.touches.length === 0) wasPinch = false;
});

const updateParticleReadouts = buildControls({
  container: controlsElement,
  getState: () => state,
  setState: (newState) => {
    state = newState;
  },
});

const sidebar = document.getElementById("sidebar")!;
const controlsFab = document.getElementById("controls-fab")!;
const sidebarBackdrop = document.getElementById("sidebar-backdrop")!;
const sidebarClose = document.getElementById("sidebar-close")!;

function openSidebar(): void {
  document.body.classList.add("controls-open");
}

function closeSidebar(): void {
  document.body.classList.remove("controls-open");
}

controlsFab.addEventListener("click", openSidebar);
sidebarBackdrop.addEventListener("click", closeSidebar);
sidebarClose.addEventListener("click", closeSidebar);

const sidebarHeader = sidebar.querySelector(
  ".sidebar-header",
) as HTMLElement | null;
if (sidebarHeader) {
  let dragStartY = 0;
  sidebarHeader.addEventListener(
    "touchstart",
    (e) => {
      dragStartY = (e as TouchEvent).touches[0].clientY;
    },
    { passive: true },
  );
  sidebarHeader.addEventListener(
    "touchend",
    (e) => {
      if ((e as TouchEvent).changedTouches[0].clientY - dragStartY > 50)
        closeSidebar();
    },
    { passive: true },
  );
}

function setPaused(paused: boolean): void {
  state = { ...state, paused };
  const pauseButton = document.getElementById("pause-button");
  if (pauseButton) pauseButton.textContent = paused ? "Resume" : "Pause";
}

const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
if (motionQuery.matches) setPaused(true);
motionQuery.addEventListener("change", (e) => setPaused(e.matches));

document.addEventListener("keydown", (event) => {
  if (event.key !== " ") return;
  const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
  if (
    activeTag &&
    ["INPUT", "BUTTON", "SELECT", "TEXTAREA"].includes(activeTag)
  )
    return;
  event.preventDefault();
  setPaused(!state.paused);
});

let lastFrameTimestamp = performance.now();

function animationLoop(currentTimestamp: number): void {
  const elapsedSeconds = Math.min(
    (currentTimestamp - lastFrameTimestamp) / 1000,
    0.05,
  );
  lastFrameTimestamp = currentTimestamp;

  if (!state.paused) {
    state = engine.step({ state, deltaTime: elapsedSeconds });
  }

  const selectedParticle =
    state.selectedParticleId !== null
      ? (state.particles.find((p) => p.id === state.selectedParticleId) ?? null)
      : null;

  render({
    context,
    canvas,
    particles: state.particles,
    camera: state.camera,
    options: state.options,
    spin: state.spin,
    selectedParticle,
  });
  updateParticleReadouts();

  requestAnimationFrame(animationLoop);
}

requestAnimationFrame(animationLoop);
