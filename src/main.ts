import "@src/assets/styles.css";
import "@src/assets/mobile.css";

import { requireElement } from "@src/dom";
import { createInitialViewState } from "@src/types";

import {
  SimulationEngine,
  createInitialSimulationState,
} from "@application/simulation-engine";
import { buildControls } from "@infrastructure/controls-ui";
import { Rk4Integrator } from "@infrastructure/rk4-integrator";
import { buildInputAdapter } from "@infrastructure/input-adapter";
import { createRenderer } from "@infrastructure/renderer/canvas-renderer";

const canvas = requireElement<HTMLCanvasElement>("canvas");
const canvasContext = canvas.getContext("2d");
if (!canvasContext) throw new Error("2D canvas context unavailable");
const context: CanvasRenderingContext2D = canvasContext;
const controlsElement = requireElement("controls");
const mainElement = requireElement("main");

const engine = new SimulationEngine(new Rk4Integrator());
const renderer = createRenderer();
let simulationState = createInitialSimulationState();
let viewState = createInitialViewState();

function resize(): void {
  canvas.width = mainElement.offsetWidth;
  canvas.height = mainElement.offsetHeight;
  viewState = {
    ...viewState,
    camera: { scale: Math.min(canvas.width, canvas.height) / 48 },
  };
  renderer.resize({
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
  });
}

resize();
window.addEventListener("resize", resize);

const updateParticleReadouts = buildControls({
  container: controlsElement,
  getSimulationState: () => simulationState,
  setSimulationState: (newState) => {
    simulationState = newState;
  },
  getViewState: () => viewState,
  setViewState: (newState) => {
    viewState = newState;
  },
});

function setPaused(paused: boolean): void {
  simulationState = { ...simulationState, paused: paused };
  const pauseButton = document.getElementById("pause-button");
  if (pauseButton) pauseButton.textContent = paused ? "Resume" : "Pause";
}

buildInputAdapter({
  canvas: canvas,
  getSimulationState: () => simulationState,
  setSimulationState: (newState) => {
    simulationState = newState;
  },
  getViewState: () => viewState,
  setViewState: (newState) => {
    viewState = newState;
  },
  setPaused: setPaused,
});

const sidebar = requireElement("sidebar");
const controlsFab = requireElement("controls-fab");
const sidebarBackdrop = requireElement("sidebar-backdrop");
const sidebarClose = requireElement("sidebar-close");

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

  if (!simulationState.paused) {
    simulationState = engine.step({
      state: simulationState,
      deltaTime: elapsedSeconds,
    });
  }

  const selectedParticle =
    simulationState.selectedParticleId !== null
      ? (simulationState.particles.find(
          (particle) => particle.id === simulationState.selectedParticleId,
        ) ?? null)
      : null;

  renderer.render({
    context: context,
    canvas: canvas,
    particles: simulationState.particles,
    camera: viewState.camera,
    options: viewState.options,
    spin: simulationState.spin,
    selectedParticle: selectedParticle,
  });
  updateParticleReadouts();

  requestAnimationFrame(animationLoop);
}

requestAnimationFrame(animationLoop);
