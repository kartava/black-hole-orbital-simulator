import { Particle, createColorCycler } from "./particles";
import {
  circularOrbitParameters,
  orbitParametersFromInitialConditions,
  hawkingTemperature,
  schwarzschildRadiusInKilometers,
  blackHoleGeometry,
  type BlackHoleGeometry,
} from "./physics";
import type { SimulationState } from "./types";

type ParticleBlueprint = {
  radius: number;
  azimuthalAngle?: number;
  radialVelocity?: number;
  angularMomentum: number;
  specificEnergy: number;
  spin: number;
  label: string;
};

interface PresetDef {
  id: string;
  label: string;
  build(props: {
    geometry: BlackHoleGeometry;
    spin: number;
  }): ParticleBlueprint | null;
}

const PRESETS: PresetDef[] = [
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
        spin,
      });
      if (!params) return null;
      return {
        radius: iscoPrograde,
        azimuthalAngle: 0,
        ...params,
        spin,
        label: "ISCO circular",
      };
    },
  },
  {
    id: "stable",
    label: "Stable r=10M",
    build(props) {
      const { spin } = props;
      const params = circularOrbitParameters({ orbitalRadius: 10, spin });
      if (!params) return null;
      return {
        radius: 10,
        azimuthalAngle: 0,
        ...params,
        spin,
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
      const r = Math.max(photonSphere + 0.5, 4);
      const params = circularOrbitParameters({ orbitalRadius: r, spin });
      if (!params) return null;
      return {
        radius: r,
        azimuthalAngle: 0,
        ...params,
        radialVelocity: 1e-4,
        spin,
        label: `Unstable r=${r.toFixed(1)}M`,
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
        spin,
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
        spin,
        label: "Scatter",
      };
    },
  },
  {
    id: "eccentric",
    label: "Eccentric orbit",
    build(props) {
      const { spin } = props;
      const params = circularOrbitParameters({ orbitalRadius: 12, spin });
      if (!params) return null;
      return {
        radius: 12,
        angularMomentum: params.angularMomentum * 0.82,
        specificEnergy: params.specificEnergy * 0.98,
        spin,
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
      const r = photonSphere + 0.15;
      const params = circularOrbitParameters({ orbitalRadius: r, spin });
      if (!params) return null;
      return {
        radius: r,
        azimuthalAngle: 0,
        ...params,
        spin,
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
        spin,
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
        spin,
        prograde: false,
      });
      if (!params) return null;
      return {
        radius: iscoRetrograde,
        azimuthalAngle: 0,
        ...params,
        spin,
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
  state: SimulationState;
}): () => void {
  const { container, state } = props;
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
        ${PRESETS.map((p) => `<button data-preset="${p.id}">${p.label}</button>`).join("\n        ")}
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
    const params = circularOrbitParameters({
      orbitalRadius: state.spawn.initialRadius,
      spin: state.spin,
    });
    if (!params) return;
    state.spawn.angularMomentum = params.angularMomentum;
    setDisplayText("angular-momentum-value", params.angularMomentum.toFixed(2));
    const slider = document.getElementById(
      "angular-momentum-slider",
    ) as HTMLInputElement | null;
    if (slider) slider.value = params.angularMomentum.toFixed(2);
  }

  function updateBlackHoleReadouts(): void {
    const el = document.getElementById("black-hole-readouts");
    if (!el) return;
    const { spin, solarMasses } = state;
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
    const params = orbitParametersFromInitialConditions({
      radius: state.spawn.initialRadius,
      angularMomentum: state.spawn.angularMomentum,
      radialVelocity: state.spawn.radialVelocity,
      spin: state.spin,
    });
    if (!params) return;
    const particle = new Particle({
      radius: state.spawn.initialRadius,
      azimuthalAngle: 0,
      ...params,
      spin: state.spin,
      color: getNextColor(),
      label: "custom",
    });
    state.particles.push(particle);
    state.selectedParticle = particle;
  }

  function addPreset(presetId: string): void {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const geometry = blackHoleGeometry(state.spin);
    const blueprint = preset.build({ geometry, spin: state.spin });
    if (!blueprint) return;
    const particle = new Particle({ ...blueprint, color: getNextColor() });
    state.particles.push(particle);
    state.selectedParticle = particle;
  }

  getElement("mass-slider").addEventListener("input", (e) => {
    state.solarMasses = +(e.target as HTMLInputElement).value;
    setDisplayText("mass-value", String(state.solarMasses));
    updateBlackHoleReadouts();
  });

  getElement("spin-slider").addEventListener("input", (e) => {
    state.spin = +(e.target as HTMLInputElement).value;
    setDisplayText("spin-value", state.spin.toFixed(2));
    updateBlackHoleReadouts();
  });

  getElement("initial-radius-slider").addEventListener("input", (e) => {
    state.spawn.initialRadius = +(e.target as HTMLInputElement).value;
    setDisplayText(
      "initial-radius-value",
      state.spawn.initialRadius.toFixed(1),
    );
    syncAngularMomentumToCircularOrbit();
  });
  getElement("angular-momentum-slider").addEventListener("input", (e) => {
    state.spawn.angularMomentum = +(e.target as HTMLInputElement).value;
    setDisplayText(
      "angular-momentum-value",
      state.spawn.angularMomentum.toFixed(2),
    );
  });
  getElement("radial-velocity-slider").addEventListener("input", (e) => {
    state.spawn.radialVelocity = +(e.target as HTMLInputElement).value;
    setDisplayText(
      "radial-velocity-value",
      (e.target as HTMLInputElement).value,
    );
  });

  getElement("speed-slider").addEventListener("input", (e) => {
    state.simulationSpeed = +(e.target as HTMLInputElement).value;
    setDisplayText("speed-value", (e.target as HTMLInputElement).value + "×");
  });

  getElement("pause-button").addEventListener("click", () => {
    state.paused = !state.paused;
    getElement("pause-button").textContent = state.paused ? "Resume" : "Pause";
  });
  getElement("clear-particles-button").addEventListener("click", () => {
    state.particles.length = 0;
    state.selectedParticle = null;
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

  getElement("toggle-isco").addEventListener("change", (e) => {
    state.options.showISCO = (e.target as HTMLInputElement).checked;
  });
  getElement("toggle-photon-sphere").addEventListener("change", (e) => {
    state.options.showPhotonSphere = (e.target as HTMLInputElement).checked;
  });
  getElement("toggle-effective-potential").addEventListener("change", (e) => {
    state.options.showEffectivePotential = (
      e.target as HTMLInputElement
    ).checked;
  });
  getElement("toggle-time-dilation").addEventListener("change", (e) => {
    state.options.showTimeDilationPanel = (
      e.target as HTMLInputElement
    ).checked;
  });
  getElement("toggle-tidal-stretching").addEventListener("change", (e) => {
    state.options.showTidalStretching = (e.target as HTMLInputElement).checked;
  });

  updateBlackHoleReadouts();
  syncAngularMomentumToCircularOrbit();

  const particleReadoutsEl = getElement("particle-readouts");
  let lastTrackedParticle: Particle | null = null;
  let readoutCells: ReadoutCells | null = null;

  return function updateParticleReadouts(): void {
    const particle = state.selectedParticle;

    if (!particle) {
      if (lastTrackedParticle !== null) {
        particleReadoutsEl.innerHTML =
          '<span class="status-hint">Click a particle or add one</span>';
        lastTrackedParticle = null;
        readoutCells = null;
      }
      return;
    }

    if (!particle.alive) {
      if (lastTrackedParticle !== particle) {
        particleReadoutsEl.innerHTML = `<span class="status-alert">${particle.captured ? "Captured by BH" : "Escaped to infinity"}</span>`;
        lastTrackedParticle = particle;
        readoutCells = null;
      }
      return;
    }

    if (lastTrackedParticle !== particle) {
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
      lastTrackedParticle = particle;
    }

    const cells = readoutCells!;
    const rate = particle.coordinateTimeRate;
    cells.radius.textContent = `${particle.radius.toFixed(3)} M`;
    cells.angularMomentum.textContent = `${particle.angularMomentum.toFixed(3)} M`;
    cells.energy.textContent = particle.specificEnergy.toFixed(4);
    cells.dilationNow.textContent = (1 / rate).toFixed(5);
    cells.properTime.textContent = `${particle.properTime.toFixed(2)} M`;
    cells.coordTime.textContent = `${particle.coordinateTime.toFixed(2)} M`;
  };
}
