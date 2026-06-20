import "./assets/styles.css";
import { buildControls } from "./controls";
import { render, initializeBackgroundStars } from "./renderer";
import type { SimulationState } from "./types";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const context = canvas.getContext("2d")!;
const controlsElement = document.getElementById("controls")!;

const state: SimulationState = {
  particles: [],
  selectedParticle: null,
  paused: false,
  simulationSpeed: 8,
  solarMasses: 10,
  spin: 0,
  camera: { scale: 28 },
  spawn: { initialRadius: 10, angularMomentum: 3.46, radialVelocity: 0 },
  options: {
    showISCO: true,
    showPhotonSphere: true,
    showEffectivePotential: true,
    showTimeDilationPanel: true,
    showTidalStretching: false,
  },
};

const mainElement = document.getElementById("main")!;

function resize(): void {
  canvas.width = mainElement.offsetWidth;
  canvas.height = mainElement.offsetHeight;
  state.camera.scale = Math.min(canvas.width, canvas.height) / 48;
  initializeBackgroundStars({
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
  });
}

resize();
window.addEventListener("resize", resize);

canvas.addEventListener("click", (event) => {
  const boundingRect = canvas.getBoundingClientRect();
  const mouseOffsetX = event.clientX - boundingRect.left - canvas.width / 2;
  const mouseOffsetY = -(event.clientY - boundingRect.top - canvas.height / 2);
  const scale = state.camera.scale;
  const worldX = mouseOffsetX / scale;
  const worldY = mouseOffsetY / scale;

  let nearestParticle = null;
  let nearestDistance = Infinity;
  for (const candidate of state.particles) {
    if (!candidate.alive) continue;
    const distanceToParticle = Math.hypot(
      candidate.x - worldX,
      candidate.y - worldY,
    );
    if (distanceToParticle < nearestDistance) {
      nearestDistance = distanceToParticle;
      nearestParticle = candidate;
    }
  }
  if (nearestParticle && nearestDistance < 3)
    state.selectedParticle = nearestParticle;
});

canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    state.camera.scale *= event.deltaY < 0 ? 1.12 : 0.89;
    state.camera.scale = Math.max(5, Math.min(200, state.camera.scale));
  },
  { passive: false },
);

const updateParticleReadouts = buildControls({
  container: controlsElement,
  state,
});

function setPaused(paused: boolean): void {
  state.paused = paused;
  const pauseButton = document.getElementById("pause-button");
  if (pauseButton) pauseButton.textContent = paused ? "Resume" : "Pause";
}

// Respect the OS-level "reduce motion" preference — auto-pause on load and
// when the user toggles the setting while the page is open.
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
if (motionQuery.matches) setPaused(true);
motionQuery.addEventListener("change", (e) => setPaused(e.matches));

// Space bar toggles pause/resume from anywhere except interactive controls.
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

const PROPER_TIME_STEP = 0.04;

let lastFrameTimestamp = performance.now();

function animationLoop(currentTimestamp: number): void {
  const elapsedSeconds = Math.min(
    (currentTimestamp - lastFrameTimestamp) / 1000,
    0.05,
  );
  lastFrameTimestamp = currentTimestamp;

  if (!state.paused) {
    const integrationSteps = Math.max(
      1,
      Math.round(state.simulationSpeed * elapsedSeconds * 60),
    );
    for (const particle of state.particles)
      particle.step({
        properTimeDelta: PROPER_TIME_STEP,
        integrationSubsteps: integrationSteps,
      });
  }

  render({
    context,
    canvas,
    particles: state.particles,
    camera: state.camera,
    options: state.options,
    spin: state.spin,
    selectedParticle: state.selectedParticle,
  });
  updateParticleReadouts();

  requestAnimationFrame(animationLoop);
}

requestAnimationFrame(animationLoop);
