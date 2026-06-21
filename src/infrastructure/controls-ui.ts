import {
  ParticleStatus,
  createParticle,
  createColorCycler,
  createParticleIdSequence,
  particleRadius,
  getCoordinateTimeRate,
} from "../domain/particle";
import type { Particle } from "../domain/particle";
import {
  circularOrbitParameters,
  orbitParametersFromInitialConditions,
} from "../domain/orbit";
import {
  hawkingTemperature,
  schwarzschildRadiusInKilometers,
  blackHoleGeometry,
} from "../domain/black-hole";
import type { BlackHoleGeometry } from "../domain/types";
import type { SimulationState } from "../application/simulation-engine";
import type { DisplayOptions, ViewState } from "../types";
import { requireElement } from "../dom";

type ParticleBlueprint = {
  radius: number;
  azimuthalAngle?: number;
  radialVelocity?: number;
  angularMomentum: number;
  specificEnergy: number;
  spin: number;
  label: string;
};

interface PresetDefinition {
  id: string;
  label: string;
  build(props: {
    geometry: BlackHoleGeometry;
    spin: number;
  }): ParticleBlueprint | null;
}

const PRESETS: PresetDefinition[] = [
  {
    id: "isco",
    label: "ISCO circular",
    build(props) {
      const {
        geometry: { iscoPrograde },
        spin,
      } = props;
      const params = circularOrbitParameters({
        orbitalRadius: iscoPrograde,
        spin: spin,
      });
      if (!params) return null;
      return {
        radius: iscoPrograde,
        azimuthalAngle: 0,
        ...params,
        spin: spin,
        label: "ISCO circular",
      };
    },
  },
  {
    id: "stable",
    label: "Stable r=10M",
    build(props) {
      const { spin } = props;
      const params = circularOrbitParameters({ orbitalRadius: 10, spin: spin });
      if (!params) return null;
      return {
        radius: 10,
        azimuthalAngle: 0,
        ...params,
        spin: spin,
        label: "Stable circular",
      };
    },
  },
  {
    id: "unstable",
    label: "Unstable r=4M",
    build(props) {
      const {
        geometry: { photonSphere },
        spin,
      } = props;
      const orbitalRadius = Math.max(photonSphere + 0.5, 4);
      const params = circularOrbitParameters({
        orbitalRadius: orbitalRadius,
        spin: spin,
      });
      if (!params) return null;
      return {
        radius: orbitalRadius,
        azimuthalAngle: 0,
        ...params,
        radialVelocity: 1e-4,
        spin: spin,
        label: `Unstable r=${orbitalRadius.toFixed(1)}M`,
      };
    },
  },
  {
    id: "plunge",
    label: "Radial plunge",
    build(props) {
      const { spin } = props;
      return {
        radius: 20,
        angularMomentum: 0,
        specificEnergy: 1.0,
        spin: spin,
        label: "Radial plunge",
      };
    },
  },
  {
    id: "scatter",
    label: "Scatter",
    build(props) {
      const { spin } = props;
      return {
        radius: 40,
        azimuthalAngle: Math.PI,
        radialVelocity: -0.3,
        angularMomentum: 5.5,
        specificEnergy: 1.05,
        spin: spin,
        label: "Scatter",
      };
    },
  },
  {
    id: "eccentric",
    label: "Eccentric orbit",
    build(props) {
      const { spin } = props;
      const params = circularOrbitParameters({ orbitalRadius: 12, spin: spin });
      if (!params) return null;
      return {
        radius: 12,
        angularMomentum: params.angularMomentum * 0.82,
        specificEnergy: params.specificEnergy * 0.98,
        spin: spin,
        label: "Eccentric (precesses)",
      };
    },
  },
  {
    id: "photon",
    label: "Near photon sphere",
    build(props) {
      const {
        geometry: { photonSphere },
        spin,
      } = props;
      const orbitalRadius = photonSphere + 0.15;
      const params = circularOrbitParameters({
        orbitalRadius: orbitalRadius,
        spin: spin,
      });
      if (!params) return null;
      return {
        radius: orbitalRadius,
        azimuthalAngle: 0,
        ...params,
        spin: spin,
        label: "Near photon sphere",
      };
    },
  },
  {
    id: "capture",
    label: "Capture orbit",
    build(props) {
      const { spin } = props;
      return {
        radius: 30,
        azimuthalAngle: Math.PI * 0.7,
        radialVelocity: -0.22,
        angularMomentum: 3.45,
        specificEnergy: 1.0,
        spin: spin,
        label: "Capture orbit",
      };
    },
  },
  {
    id: "retrograde",
    label: "Retrograde ISCO",
    build(props) {
      const {
        geometry: { iscoRetrograde },
        spin,
      } = props;
      const params = circularOrbitParameters({
        orbitalRadius: iscoRetrograde,
        spin: spin,
        prograde: false,
      });
      if (!params) return null;
      return {
        radius: iscoRetrograde,
        azimuthalAngle: 0,
        ...params,
        spin: spin,
        label: "Retrograde ISCO",
      };
    },
  },
];

interface ReadoutCells {
  radius: HTMLElement;
  angularMomentum: HTMLElement;
  energy: HTMLElement;
  dilationNow: HTMLElement;
  properTime: HTMLElement;
  coordTime: HTMLElement;
}

function buildReadoutRow(props: {
  container: HTMLElement;
  labelText: string;
}): HTMLElement {
  const { container, labelText } = props;
  const row = document.createElement("div");
  const label = document.createElement("span");
  label.className = "readout-label";
  label.textContent = labelText;
  const value = document.createElement("b");
  row.append(label, " ", value);
  container.appendChild(row);
  return value;
}

function formatTemperature(temperature: number): string {
  if (temperature < 1e-6) return (temperature * 1e9).toFixed(2) + " nK";
  if (temperature < 1e-3) return (temperature * 1e6).toFixed(2) + " μK";
  if (temperature < 1) return (temperature * 1e3).toFixed(2) + " mK";
  return temperature.toFixed(2) + " K";
}

function controlsMarkup(): string {
  return `
    <div class="panel">
      <h2>Black Hole</h2>
      <label>Mass <span class="control-value" id="mass-value">10</span> M☉
        <input type="range" id="mass-slider" min="1" max="100" value="10" step="1">
      </label>
      <label>Spin <span class="control-value" id="spin-value">0.00</span> M  (Kerr parameter a)
        <input type="range" id="spin-slider" min="0" max="0.99" value="0" step="0.01">
      </label>
      <div class="readouts" id="black-hole-readouts"></div>

      <h2>Add Particle</h2>
      <div class="presets">
        ${PRESETS.map((preset) => `<button data-preset="${preset.id}">${preset.label}</button>`).join("\n        ")}
      </div>

      <div class="particle-builder">
        <label>r₀ <span class="control-value" id="initial-radius-value">10</span> M
          <input type="range" id="initial-radius-slider" min="2.1" max="40" value="10" step="0.1">
        </label>
        <label>L <span class="control-value" id="angular-momentum-value">3.46</span> M
          <input type="range" id="angular-momentum-slider" min="-12" max="12" value="3.46" step="0.05">
        </label>
        <label>ṙ₀ <span class="control-value" id="radial-velocity-value">0</span>
          <input type="range" id="radial-velocity-slider" min="-0.5" max="0.5" value="0" step="0.01">
        </label>
        <button id="add-particle-button">Drop particle</button>
      </div>

      <h2>Display</h2>
      <label class="checkbox-option"><input type="checkbox" id="toggle-isco" checked> ISCO / prograde+retrograde</label>
      <label class="checkbox-option"><input type="checkbox" id="toggle-photon-sphere" checked> Photon sphere ring</label>
      <label class="checkbox-option"><input type="checkbox" id="toggle-effective-potential" checked> Effective potential V²(r)</label>
      <label class="checkbox-option"><input type="checkbox" id="toggle-time-dilation" checked> Time dilation panel</label>
      <label class="checkbox-option"><input type="checkbox" id="toggle-tidal-stretching"> Tidal stretching (spaghettification)</label>

      <h2>Simulation</h2>
      <label>Speed <span class="control-value" id="speed-value">8×</span>
        <input type="range" id="speed-slider" min="1" max="20" value="8" step="1">
      </label>
      <div class="simulation-actions">
        <button id="pause-button">Pause</button>
        <button id="clear-particles-button">Clear all</button>
      </div>

      <h2>Selected Particle</h2>
      <div class="readouts" id="particle-readouts">—</div>

    </div>
  `;
}

interface ControlsWiring {
  getSimulationState: () => SimulationState;
  setSimulationState: (newState: SimulationState) => void;
  getViewState: () => ViewState;
  setViewState: (newState: ViewState) => void;
  getNextColor: () => string;
  getNextId: () => string;
  container: HTMLElement;
}

function wireControls(wiring: ControlsWiring): void {
  const {
    getSimulationState,
    setSimulationState,
    getViewState,
    setViewState,
    getNextColor,
    getNextId,
    container,
  } = wiring;

  const setDisplayText = (id: string, value: string): void => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };

  const setSliderValue = (id: string, value: string): void => {
    const slider = document.getElementById(id) as HTMLInputElement | null;
    if (slider) slider.value = value;
  };

  const updateOption = (patch: Partial<DisplayOptions>): void => {
    const viewState = getViewState();
    setViewState({ ...viewState, options: { ...viewState.options, ...patch } });
  };

  function syncAngularMomentumToCircularOrbit(): void {
    const viewState = getViewState();
    const params = circularOrbitParameters({
      orbitalRadius: viewState.spawn.initialRadius,
      spin: getSimulationState().spin,
    });
    if (!params) return;
    setViewState({
      ...getViewState(),
      spawn: {
        ...getViewState().spawn,
        angularMomentum: params.angularMomentum,
      },
    });
    setDisplayText("angular-momentum-value", params.angularMomentum.toFixed(2));
    setSliderValue(
      "angular-momentum-slider",
      params.angularMomentum.toFixed(2),
    );
  }

  function updateBlackHoleReadouts(): void {
    const element = document.getElementById("black-hole-readouts");
    if (!element) return;
    const { spin, solarMasses } = getSimulationState();
    const radiusKm = schwarzschildRadiusInKilometers(solarMasses);
    const temperature = hawkingTemperature({
      solarMasses: solarMasses,
      spin: spin,
    });
    const { horizon, iscoPrograde, iscoRetrograde } = blackHoleGeometry(spin);
    element.innerHTML = `
      <div><span class="readout-label">r<sub>+</sub></span> <b>${((horizon * radiusKm) / 2).toFixed(2)} km</b></div>
      <div><span class="readout-label">T<sub>H</sub></span> <b>${formatTemperature(temperature)}</b></div>
      <div><span class="readout-label">ISCO (pro)</span> <b>${iscoPrograde.toFixed(2)} M = ${((iscoPrograde * radiusKm) / 2).toFixed(1)} km</b></div>
      ${spin > 0.01 ? `<div><span class="readout-label">ISCO (retro)</span> <b>${iscoRetrograde.toFixed(2)} M</b></div>` : ""}
    `;
  }

  function addCustomParticle(): void {
    const simulationState = getSimulationState();
    const { spawn } = getViewState();
    const params = orbitParametersFromInitialConditions({
      radius: spawn.initialRadius,
      angularMomentum: spawn.angularMomentum,
      radialVelocity: spawn.radialVelocity,
      spin: simulationState.spin,
    });
    if (!params) return;
    const particle = createParticle({
      id: getNextId(),
      radius: spawn.initialRadius,
      azimuthalAngle: 0,
      ...params,
      spin: simulationState.spin,
      color: getNextColor(),
      label: "custom",
    });
    setSimulationState({
      ...simulationState,
      particles: [...simulationState.particles, particle],
      selectedParticleId: particle.id,
    });
  }

  function addPreset(presetId: string): void {
    const simulationState = getSimulationState();
    const preset = PRESETS.find((candidate) => candidate.id === presetId);
    if (!preset) return;
    const geometry = blackHoleGeometry(simulationState.spin);
    const blueprint = preset.build({
      geometry: geometry,
      spin: simulationState.spin,
    });
    if (!blueprint) return;
    const particle = createParticle({
      id: getNextId(),
      ...blueprint,
      color: getNextColor(),
    });
    setSimulationState({
      ...simulationState,
      particles: [...simulationState.particles, particle],
      selectedParticleId: particle.id,
    });
  }

  requireElement("mass-slider").addEventListener("input", (event) => {
    const solarMasses = +(event.target as HTMLInputElement).value;
    setSimulationState({ ...getSimulationState(), solarMasses: solarMasses });
    setDisplayText("mass-value", String(solarMasses));
    updateBlackHoleReadouts();
  });

  requireElement("spin-slider").addEventListener("input", (event) => {
    const spin = +(event.target as HTMLInputElement).value;
    setSimulationState({ ...getSimulationState(), spin: spin });
    setDisplayText("spin-value", spin.toFixed(2));
    updateBlackHoleReadouts();
  });

  requireElement("initial-radius-slider").addEventListener("input", (event) => {
    const initialRadius = +(event.target as HTMLInputElement).value;
    setViewState({
      ...getViewState(),
      spawn: { ...getViewState().spawn, initialRadius: initialRadius },
    });
    setDisplayText("initial-radius-value", initialRadius.toFixed(1));
    syncAngularMomentumToCircularOrbit();
  });

  requireElement("angular-momentum-slider").addEventListener(
    "input",
    (event) => {
      const angularMomentum = +(event.target as HTMLInputElement).value;
      setViewState({
        ...getViewState(),
        spawn: { ...getViewState().spawn, angularMomentum: angularMomentum },
      });
      setDisplayText("angular-momentum-value", angularMomentum.toFixed(2));
    },
  );

  requireElement("radial-velocity-slider").addEventListener(
    "input",
    (event) => {
      const radialVelocity = +(event.target as HTMLInputElement).value;
      setViewState({
        ...getViewState(),
        spawn: { ...getViewState().spawn, radialVelocity: radialVelocity },
      });
      setDisplayText(
        "radial-velocity-value",
        (event.target as HTMLInputElement).value,
      );
    },
  );

  requireElement("speed-slider").addEventListener("input", (event) => {
    const simulationSpeed = +(event.target as HTMLInputElement).value;
    setSimulationState({
      ...getSimulationState(),
      simulationSpeed: simulationSpeed,
    });
    setDisplayText(
      "speed-value",
      (event.target as HTMLInputElement).value + "×",
    );
  });

  requireElement("pause-button").addEventListener("click", () => {
    const simulationState = getSimulationState();
    const paused = !simulationState.paused;
    setSimulationState({ ...simulationState, paused: paused });
    requireElement("pause-button").textContent = paused ? "Resume" : "Pause";
  });

  requireElement("clear-particles-button").addEventListener("click", () => {
    setSimulationState({
      ...getSimulationState(),
      particles: [],
      selectedParticleId: null,
    });
  });

  requireElement("add-particle-button").addEventListener(
    "click",
    addCustomParticle,
  );

  container.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () =>
      addPreset((button as HTMLElement).dataset.preset!),
    );
  });

  requireElement("toggle-isco").addEventListener("change", (event) => {
    updateOption({ showISCO: (event.target as HTMLInputElement).checked });
  });
  requireElement("toggle-photon-sphere").addEventListener("change", (event) => {
    updateOption({
      showPhotonSphere: (event.target as HTMLInputElement).checked,
    });
  });
  requireElement("toggle-effective-potential").addEventListener(
    "change",
    (event) => {
      updateOption({
        showEffectivePotential: (event.target as HTMLInputElement).checked,
      });
    },
  );
  requireElement("toggle-time-dilation").addEventListener("change", (event) => {
    updateOption({
      showTimeDilationPanel: (event.target as HTMLInputElement).checked,
    });
  });
  requireElement("toggle-tidal-stretching").addEventListener(
    "change",
    (event) => {
      updateOption({
        showTidalStretching: (event.target as HTMLInputElement).checked,
      });
    },
  );

  updateBlackHoleReadouts();
  syncAngularMomentumToCircularOrbit();
}

function createReadoutUpdater(
  getSimulationState: () => SimulationState,
): () => void {
  const particleReadoutsEl = requireElement("particle-readouts");
  let lastTrackedParticleId: string | null = null;
  let readoutCells: ReadoutCells | null = null;

  return function updateParticleReadouts(): void {
    const simulationState = getSimulationState();
    const particle: Particle | null = simulationState.selectedParticleId
      ? (simulationState.particles.find(
          (candidate) => candidate.id === simulationState.selectedParticleId,
        ) ?? null)
      : null;

    if (!particle) {
      if (lastTrackedParticleId !== null) {
        particleReadoutsEl.innerHTML =
          '<span class="status-hint">Click a particle or add one</span>';
        lastTrackedParticleId = null;
        readoutCells = null;
      }
      return;
    }

    if (particle.status !== ParticleStatus.ALIVE) {
      if (lastTrackedParticleId !== particle.id) {
        particleReadoutsEl.innerHTML = `<span class="status-alert">${particle.status === ParticleStatus.CAPTURED ? "Captured by BH" : "Escaped to infinity"}</span>`;
        lastTrackedParticleId = particle.id;
        readoutCells = null;
      }
      return;
    }

    if (lastTrackedParticleId !== particle.id) {
      particleReadoutsEl.innerHTML = "";
      const labelRow = document.createElement("div");
      const labelKey = document.createElement("span");
      labelKey.className = "readout-label";
      labelKey.textContent = "Label";
      const labelValue = document.createElement("b");
      labelValue.style.color = particle.color;
      labelValue.textContent = particle.label;
      labelRow.append(labelKey, " ", labelValue);
      particleReadoutsEl.appendChild(labelRow);

      readoutCells = {
        radius: buildReadoutRow({
          container: particleReadoutsEl,
          labelText: "r",
        }),
        angularMomentum: buildReadoutRow({
          container: particleReadoutsEl,
          labelText: "L (ang. mom.)",
        }),
        energy: buildReadoutRow({
          container: particleReadoutsEl,
          labelText: "E (energy/m)",
        }),
        dilationNow: buildReadoutRow({
          container: particleReadoutsEl,
          labelText: "dτ/dt (now)",
        }),
        properTime: buildReadoutRow({
          container: particleReadoutsEl,
          labelText: "τ proper",
        }),
        coordTime: buildReadoutRow({
          container: particleReadoutsEl,
          labelText: "t coord",
        }),
      };
      lastTrackedParticleId = particle.id;
    }

    const cells = readoutCells!;
    const rate = getCoordinateTimeRate(particle);
    cells.radius.textContent = `${particleRadius(particle).toFixed(3)} M`;
    cells.angularMomentum.textContent = `${particle.angularMomentum.toFixed(3)} M`;
    cells.energy.textContent = particle.specificEnergy.toFixed(4);
    cells.dilationNow.textContent = (1 / rate).toFixed(5);
    cells.properTime.textContent = `${particle.properTime.toFixed(2)} M`;
    cells.coordTime.textContent = `${particle.coordinateTime.toFixed(2)} M`;
  };
}

export function buildControls(props: {
  container: HTMLElement;
  getSimulationState: () => SimulationState;
  setSimulationState: (newState: SimulationState) => void;
  getViewState: () => ViewState;
  setViewState: (newState: ViewState) => void;
}): () => void {
  const {
    container,
    getSimulationState,
    setSimulationState,
    getViewState,
    setViewState,
  } = props;

  container.innerHTML = controlsMarkup();
  wireControls({
    getSimulationState: getSimulationState,
    setSimulationState: setSimulationState,
    getViewState: getViewState,
    setViewState: setViewState,
    getNextColor: createColorCycler(),
    getNextId: createParticleIdSequence(),
    container: container,
  });
  return createReadoutUpdater(getSimulationState);
}
