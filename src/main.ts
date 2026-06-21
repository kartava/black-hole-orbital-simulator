import "./assets/styles.css";
import "./assets/mobile.css";
import {
  SimulationEngine,
  createInitialState,
} from "./application/simulation-engine";
import { Rk4Integrator } from "./infrastructure/rk4-integrator";
import {
  render,
  initializeBackgroundStars,
} from "./infrastructure/renderer/canvas-renderer";
import { buildControls } from "./infrastructure/controls-ui";
import { buildInputAdapter } from "./infrastructure/input-adapter";

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

const updateParticleReadouts = buildControls({
  container: controlsElement,
  getState: () => state,
  setState: (newState) => {
    state = newState;
  },
});

function setPaused(paused: boolean): void {
  state = { ...state, paused: paused };
  const pauseButton = document.getElementById("pause-button");
  if (pauseButton) pauseButton.textContent = paused ? "Resume" : "Pause";
}

buildInputAdapter({
  canvas: canvas,
  getState: () => state,
  setState: (newState) => {
    state = newState;
  },
  setPaused: setPaused,
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
    (touchEvent) => {
      dragStartY = (touchEvent as TouchEvent).touches[0].clientY;
    },
    { passive: true },
  );
  sidebarHeader.addEventListener(
    "touchend",
    (touchEvent) => {
      if (
        (touchEvent as TouchEvent).changedTouches[0].clientY - dragStartY >
        50
      )
        closeSidebar();
    },
    { passive: true },
  );
}

const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
if (motionQuery.matches) setPaused(true);
motionQuery.addEventListener("change", (motionEvent) =>
  setPaused(motionEvent.matches),
);

let lastFrameTimestamp = performance.now();

function animationLoop(currentTimestamp: number): void {
  const elapsedSeconds = Math.min(
    (currentTimestamp - lastFrameTimestamp) / 1000,
    0.05,
  );
  lastFrameTimestamp = currentTimestamp;

  if (!state.paused) {
    state = engine.step({ state: state, deltaTime: elapsedSeconds });
  }

  const selectedParticle =
    state.selectedParticleId !== null
      ? (state.particles.find(
          (particle) => particle.id === state.selectedParticleId,
        ) ?? null)
      : null;

  render({
    context: context,
    canvas: canvas,
    particles: state.particles,
    camera: state.camera,
    options: state.options,
    spin: state.spin,
    selectedParticle: selectedParticle,
  });
  updateParticleReadouts();

  requestAnimationFrame(animationLoop);
}

requestAnimationFrame(animationLoop);
