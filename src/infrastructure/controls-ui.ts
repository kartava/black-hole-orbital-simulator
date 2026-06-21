import {
  ParticleStatus,
  createParticle,
  createColorCycler,
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
  const div = document.createElement("div");
  const label = document.createElement("span");
  label.className = "readout-label";
  label.textContent = labelText;
  const value = document.createElement("b");
  div.append(label, " ", value);
  container.appendChild(div);
  return value;
}

function formatTemperature(temperature: number): string {
  if (temperature < 1e-6) return (temperature * 1e9).toFixed(2) + " nK";
  if (temperature < 1e-3) return (temperature * 1e6).toFixed(2) + " μK";
  if (temperature < 1) return (temperature * 1e3).toFixed(2) + " mK";
  return temperature.toFixed(2) + " K";
}

export function buildControls(props: {
  container: HTMLElement;
  getState: () => SimulationState;
  setState: (newState: SimulationState) => void;
}): () => void {
  const { container, getState, setState } = props;
  const getNextColor = createColorCycler();

  container.innerHTML = `
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

  const getElement = (id: string): HTMLElement => document.getElementById(id)!;
  const setDisplayText = (id: string, value: string): void => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  function syncAngularMomentumToCircularOrbit(): void {
    const state = getState();
    const params = circularOrbitParameters({
      orbitalRadius: state.spawn.initialRadius,
      spin: state.spin,
    });
    if (!params) return;
    setState({
      ...state,
      spawn: { ...state.spawn, angularMomentum: params.angularMomentum },
    });
    setDisplayText("angular-momentum-value", params.angularMomentum.toFixed(2));
    const slider = document.getElementById(
      "angular-momentum-slider",
    ) as HTMLInputElement | null;
    if (slider) slider.value = params.angularMomentum.toFixed(2);
  }

  function updateBlackHoleReadouts(): void {
    const el = document.getElementById("black-hole-readouts");
    if (!el) return;
    const { spin, solarMasses } = getState();
    const rsKm = schwarzschildRadiusInKilometers(solarMasses);
    const temp = hawkingTemperature({ solarMasses, spin });
    const { horizon, iscoPrograde, iscoRetrograde } = blackHoleGeometry(spin);
    el.innerHTML = `
      <div><span class="readout-label">r<sub>+</sub></span> <b>${((horizon * rsKm) / 2).toFixed(2)} km</b></div>
      <div><span class="readout-label">T<sub>H</sub></span> <b>${formatTemperature(temp)}</b></div>
      <div><span class="readout-label">ISCO (pro)</span> <b>${iscoPrograde.toFixed(2)} M = ${((iscoPrograde * rsKm) / 2).toFixed(1)} km</b></div>
      ${spin > 0.01 ? `<div><span class="readout-label">ISCO (retro)</span> <b>${iscoRetrograde.toFixed(2)} M</b></div>` : ""}
    `;
  }

  function addCustomParticle(): void {
    const state = getState();
    const params = orbitParametersFromInitialConditions({
      radius: state.spawn.initialRadius,
      angularMomentum: state.spawn.angularMomentum,
      radialVelocity: state.spawn.radialVelocity,
      spin: state.spin,
    });
    if (!params) return;
    const particle = createParticle({
      radius: state.spawn.initialRadius,
      azimuthalAngle: 0,
      ...params,
      spin: state.spin,
      color: getNextColor(),
      label: "custom",
    });
    setState({
      ...state,
      particles: [...state.particles, particle],
      selectedParticleId: particle.id,
    });
  }

  function addPreset(presetId: string): void {
    const state = getState();
    const preset = PRESETS.find((candidate) => candidate.id === presetId);
    if (!preset) return;
    const geometry = blackHoleGeometry(state.spin);
    const blueprint = preset.build({ geometry: geometry, spin: state.spin });
    if (!blueprint) return;
    const particle = createParticle({ ...blueprint, color: getNextColor() });
    setState({
      ...state,
      particles: [...state.particles, particle],
      selectedParticleId: particle.id,
    });
  }

  getElement("mass-slider").addEventListener("input", (event) => {
    const solarMasses = +(event.target as HTMLInputElement).value;
    setState({ ...getState(), solarMasses: solarMasses });
    setDisplayText("mass-value", String(solarMasses));
    updateBlackHoleReadouts();
  });

  getElement("spin-slider").addEventListener("input", (event) => {
    const spin = +(event.target as HTMLInputElement).value;
    setState({ ...getState(), spin: spin });
    setDisplayText("spin-value", spin.toFixed(2));
    updateBlackHoleReadouts();
  });

  getElement("initial-radius-slider").addEventListener("input", (event) => {
    const initialRadius = +(event.target as HTMLInputElement).value;
    setState({
      ...getState(),
      spawn: { ...getState().spawn, initialRadius: initialRadius },
    });
    setDisplayText("initial-radius-value", initialRadius.toFixed(1));
    syncAngularMomentumToCircularOrbit();
  });

  getElement("angular-momentum-slider").addEventListener("input", (event) => {
    const angularMomentum = +(event.target as HTMLInputElement).value;
    setState({
      ...getState(),
      spawn: { ...getState().spawn, angularMomentum: angularMomentum },
    });
    setDisplayText("angular-momentum-value", angularMomentum.toFixed(2));
  });

  getElement("radial-velocity-slider").addEventListener("input", (event) => {
    const radialVelocity = +(event.target as HTMLInputElement).value;
    setState({
      ...getState(),
      spawn: { ...getState().spawn, radialVelocity: radialVelocity },
    });
    setDisplayText(
      "radial-velocity-value",
      (event.target as HTMLInputElement).value,
    );
  });

  getElement("speed-slider").addEventListener("input", (event) => {
    const simulationSpeed = +(event.target as HTMLInputElement).value;
    setState({ ...getState(), simulationSpeed: simulationSpeed });
    setDisplayText(
      "speed-value",
      (event.target as HTMLInputElement).value + "×",
    );
  });

  getElement("pause-button").addEventListener("click", () => {
    const state = getState();
    const paused = !state.paused;
    setState({ ...state, paused: paused });
    getElement("pause-button").textContent = paused ? "Resume" : "Pause";
  });

  getElement("clear-particles-button").addEventListener("click", () => {
    setState({ ...getState(), particles: [], selectedParticleId: null });
  });

  getElement("add-particle-button").addEventListener(
    "click",
    addCustomParticle,
  );

  container.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () =>
      addPreset((button as HTMLElement).dataset.preset!),
    );
  });

  getElement("toggle-isco").addEventListener("change", (event) => {
    const state = getState();
    setState({
      ...state,
      options: {
        ...state.options,
        showISCO: (event.target as HTMLInputElement).checked,
      },
    });
  });
  getElement("toggle-photon-sphere").addEventListener("change", (event) => {
    const state = getState();
    setState({
      ...state,
      options: {
        ...state.options,
        showPhotonSphere: (event.target as HTMLInputElement).checked,
      },
    });
  });
  getElement("toggle-effective-potential").addEventListener(
    "change",
    (event) => {
      const state = getState();
      setState({
        ...state,
        options: {
          ...state.options,
          showEffectivePotential: (event.target as HTMLInputElement).checked,
        },
      });
    },
  );
  getElement("toggle-time-dilation").addEventListener("change", (event) => {
    const state = getState();
    setState({
      ...state,
      options: {
        ...state.options,
        showTimeDilationPanel: (event.target as HTMLInputElement).checked,
      },
    });
  });
  getElement("toggle-tidal-stretching").addEventListener("change", (event) => {
    const state = getState();
    setState({
      ...state,
      options: {
        ...state.options,
        showTidalStretching: (event.target as HTMLInputElement).checked,
      },
    });
  });

  updateBlackHoleReadouts();
  syncAngularMomentumToCircularOrbit();

  const particleReadoutsEl = getElement("particle-readouts");
  let lastTrackedParticleId: string | null = null;
  let readoutCells: ReadoutCells | null = null;

  return function updateParticleReadouts(): void {
    const state = getState();
    const particle: Particle | null = state.selectedParticleId
      ? (state.particles.find(
          (candidate) => candidate.id === state.selectedParticleId,
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
      const labelDiv = document.createElement("div");
      const labelKey = document.createElement("span");
      labelKey.className = "readout-label";
      labelKey.textContent = "Label";
      const labelVal = document.createElement("b");
      labelVal.style.color = particle.color;
      labelVal.textContent = particle.label;
      labelDiv.append(labelKey, " ", labelVal);
      particleReadoutsEl.appendChild(labelDiv);

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
