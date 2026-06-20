import "./assets/styles.css";
import "./assets/mobile.css";
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

let lastTouchTimestamp = 0;

canvas.addEventListener("click", (event) => {
  // Skip synthetic click fired by the browser after touchend to avoid double-selecting.
  if (performance.now() - lastTouchTimestamp < 500) return;
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

// Touch: pinch-to-zoom and tap-to-select
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
      state.camera.scale = Math.max(
        5,
        Math.min(200, pinchStartScale * (dist / pinchStartDistance)),
      );
    }
  },
  { passive: false },
);

canvas.addEventListener("touchend", (event) => {
  if (!wasPinch && event.touches.length === 0 && event.changedTouches.length === 1) {
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
      let nearest: (typeof state.particles)[number] | null = null;
      let nearestDist = Infinity;
      for (const p of state.particles) {
        if (!p.alive) continue;
        const d = Math.hypot(p.x - worldX, p.y - worldY);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = p;
        }
      }
      if (nearest && nearestDist < 5) state.selectedParticle = nearest;
    }
  }
  if (event.touches.length === 0) wasPinch = false;
});

const updateParticleReadouts = buildControls({
  container: controlsElement,
  state,
});

// Mobile sidebar drawer
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

// Swipe-down-to-close: listen on the full header for a usable touch target.
const sidebarHeader = sidebar.querySelector(".sidebar-header") as HTMLElement | null;
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
