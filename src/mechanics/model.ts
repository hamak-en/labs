export interface Control {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  initial: number;
}

const control = (key: string, label: string, unit: string, min: number, max: number, step: number, initial: number): Control =>
  ({ key, label, unit, min, max, step, initial });

export const stokesReferenceDiameter = 4.85; // mm, sample 1
const glassBallDiameters = [stokesReferenceDiameter, 4.9, 4.81, 4.94, 4.87];
export const caliperJaw = control('jaw', 'Розведення губок', 'мм', 0, 60, .1, 46);
const micrometerJaw = control('jaw', 'Розведення п’яти й гвинта', 'мм', 0, 25, .01, 18);
const cylinderPoint = control('point', 'Точка заміру на циліндрі', '', 1, 5, 1, 1);
export const flywheelShaftPoint = control('point', 'Місце вимірювання вала', '', 1, 5, 1, 1);
const cylinderDiameterPositions = { start: .4, end: .6 };

// Dimensions in mm. The side tapers slightly and the lower face is slightly inclined.
export const cylinder = {
  length: 35.7,
  diameterPositions: cylinderDiameterPositions,
  diameterAt(position: number) {
    const { start, end } = cylinderDiameterPositions;
    const taper = Math.min(1, Math.max(0, (position - start) / (end - start)));
    return 28.6 - .4 * taper;
  },
  heightAt(position: number) {
    return cylinder.length + .8 * (position - .5);
  },
};

export const modes = [
  { lab: 1, key: 'cylinder', label: 'Циліндр', controls: [cylinderPoint, caliperJaw] },
  { lab: 1, key: 'sphere', label: 'Куля', controls: [control('point', 'Місце вимірювання', '', 1, 5, 1, 1), micrometerJaw] },
  { lab: 2, key: 'stretch', label: 'Розтяг', controls: [control('load', 'Маса тягарів', 'кг', 0, 2.5, .5, 0), control('point', 'Місце вимірювання діаметра', '', 1, 5, 1, 1)] },
  { lab: 2, key: 'bend', label: 'Згин', controls: [control('load', 'Маса тягарів', 'кг', 0, 2.5, .5, 0), control('offset', 'Зсув вантажу від середини', 'мм', -15, 15, 5, 0), control('point', 'Переріз для заміру ширини й товщини', '', 1, 5, 1, 1)] },
  { lab: 3, key: 'flywheel', label: 'Махове колесо', controls: [control('height', 'Початкова висота', 'см', 20, 75, 1, 65), flywheelShaftPoint] },
  { lab: 4, key: 'stokes', label: 'Осідання кульки', controls: [control('ball', 'Номер кульки', '', 1, glassBallDiameters.length, 1, 1), control('point', 'Точка вимірювання діаметра', '', 1, 5, 1, 1)] },
  { lab: 5, key: 'phase', label: 'Зсув фаз', controls: [control('frequency', 'Частота генератора', 'Гц', 1500, 2500, 10, 2000), control('speaker', 'Положення гучномовця', 'см', 0, 30, .1, 5), control('microphone', 'Положення мікрофона', 'см', 31, 100, .1, 41.1), control('amplitude', 'Вихід генератора', 'В', 0, 3, .1, 0), control('gain', 'Підсилення Y', '×', .5, 2, .1, 1), control('focus', 'Фокус', 'под.', 1, 5, 1, 3), control('brightness', 'Яскравість', 'под.', 1, 5, 1, 3)] },
  { lab: 5, key: 'resonance', label: 'Резонанс', controls: [control('column', 'Висота повітряного стовпа', 'см', 2, 110, .1, 10)] },
  { lab: 6, key: 'gas', label: 'Адіабатичне розширення', controls: [] },
  { lab: 7, key: 'benzene', label: 'Тиск насиченої пари', controls: [control('temperature', 'Цільова температура ванни', '°C', 20, 50, 5, 20)] },
  { lab: 8, key: 'electrolysis', label: 'Електроліз', controls: [control('current', 'Уставка струму', 'А', .25, .30, .001, .275)] },
  { lab: 9, key: 'humidity', label: 'Психрометрія', controls: [] },
] as const;

export type Mode = typeof modes[number];
export type ModeKey = Mode['key'];

type Stage = 'ready' | 'moving' | 'done' | 'pumped' | 'recovering' | 'settled' | 'running' | 'settling';

export interface Experiment {
  values: Record<string, number>;
  stage: Stage;
  elapsed: number;
  time: number;
  timer: boolean;
  offset: number;
  attached: boolean;
  tool: 'diameter' | 'height';
  heater: boolean;
  temperature: number;
  vacuum: number;
  valve: boolean;
  wet: boolean;
  turns: number;
  pressure: number;
  scope: boolean;
  generator: boolean;
  warm: number;
  generatorWarm: number;
  obstacle: boolean;
  struck: number;
  starts: number;
}

const storageKey = 'mechanics-lab:v1';
let stored: Record<string, Record<string, number>> = {};
try {
  const data = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
  if (data && typeof data === 'object' && !Array.isArray(data)) stored = data;
} catch { /* The experiment can run with an unavailable browser store. */ }

export function normalize(field: Control, value: number) {
  const clamped = Math.min(field.max, Math.max(field.min, value));
  return Number((field.min + Math.round((clamped - field.min) / field.step) * field.step).toFixed(8));
}

export function freshExperiment(mode: Mode, restore = true): Experiment {
  const values = Object.fromEntries(mode.controls.map(field => {
    const saved = restore ? stored[mode.key]?.[field.key] : undefined;
    return [field.key, typeof saved === 'number' && Number.isFinite(saved) ? normalize(field, saved) : field.initial];
  }));
  const e: Experiment = { values, stage: 'ready', elapsed: 0, time: 0, timer: false, offset: 0,
    attached: true, tool: 'diameter',
    heater: false, temperature: mode.key === 'humidity' ? 24 : 20,
    vacuum: 0, valve: false, wet: false, turns: 0, pressure: 0, scope: false, generator: false,
    warm: 0, generatorWarm: 0, obstacle: false, struck: 0, starts: 0 };
  if (mode.key === 'cylinder') fitCylinder(e);
  return e;
}

export function persistExperiment(mode: Mode, experiment: Experiment) {
  stored[mode.key] = { ...experiment.values };
  try { localStorage.setItem(storageKey, JSON.stringify(stored)); } catch { /* Optional persistence. */ }
}

export const gravity = 9.81;
export const atmosphere = 101.3; // kPa
export const gasConstant = 8.314462618;
export const elementaryCharge = 1.602176634e-19;
export const tank = { radius: 2.5, top: 11, bottom: 25, depth: 29, viscosity: 1.194, liquidDensity: 1260, glassDensity: 2500 };
export const fork = { frequency: 440 };
export const airSpeed = 343.4;
export const wetCoefficient = .0007;
export const psychrometerWind = { startTurns: 5, maxTurns: 6 };
export const ambientTemperature = 24;
export const hydrogen = { bathTemperature: 22, liquidDensity: 1100, waterActivity: .968, tubeArea: .7 };
export const wheelMass = 1.6;
export const hangingMass = .18;
export const steelWire = { length: 1120, diameter: .81 }; // mm
const bendingPlate = { span: 420, width: 31.3, thickness: 4.3 }; // mm
const wheelRadii = { shaft: .018, outer: .14, inner: .088 };
const deviations = [-.03, .01, 0, -.01, .02];
const localDeviation = (e: Experiment) => deviations[e.values.point - 1] ?? 0;
const axialInertia = .0012;

export const roundReading = (value: number, step: number) => Number((Math.round(value / step) * step).toFixed(8));

export function cylinderMeasurement(e: Experiment) {
  const height = e.tool === 'height';
  const fraction = (e.values.point - cylinderPoint.min) / (cylinderPoint.max - cylinderPoint.min);
  const { start, end } = height ? { start: .25, end: .75 } : cylinderDiameterPositions;
  const position = start + (end - start) * fraction;
  return { height, position, size: height ? cylinder.heightAt(position) : cylinder.diameterAt(position) };
}

export function specimenSize(mode: 'sphere' | 'stokes' | 'cylinder' | 'stretch', e: Experiment) {
  const deviation = localDeviation(e);
  if (mode === 'sphere') return 13.47 + deviation;
  if (mode === 'stokes') return glassBallDiameters[e.values.ball - 1] + deviation;
  if (mode === 'cylinder') return cylinderMeasurement(e).size;
  return steelWire.diameter + deviation / 4;
}

export function plateDimensions(e: Experiment) {
  const variation = 3 * localDeviation(e);
  return { span: bendingPlate.span, width: bendingPlate.width + variation, thickness: bendingPlate.thickness + variation };
}

export function flywheelDiameters(e: Experiment) {
  return { shaft: 2000 * wheelRadii.shaft + 4 * localDeviation(e), outer: 2000 * wheelRadii.outer, inner: 2000 * wheelRadii.inner };
}

export function deformation(mode: ModeKey, e: Experiment) {
  if (mode === 'stretch') {
    const force = e.values.load * gravity;
    return force * steelWire.length / (197e9 * Math.PI * (steelWire.diameter / 2000) ** 2);
  }
  return plateProfile(e, .5).deflection;
}

export function plateLoadPosition(e: Experiment) {
  return .5 + e.values.offset / bendingPlate.span;
}

export function plateProfile(e: Experiment, position: number) {
  const { span, width, thickness } = bendingPlate;
  const load = plateLoadPosition(e);
  const rightSide = position > load;
  const x = (rightSide ? 1 - position : position) * span;
  const oppositeArm = (rightSide ? load : 1 - load) * span;
  const areaMoment = width * thickness ** 3 / 12;
  const elasticModulus = 70_000; // N/mm²
  const factor = e.values.load * gravity * oppositeArm / (6 * span * elasticModulus * areaMoment);
  const term = span ** 2 - oppositeArm ** 2;
  // Integrate the bending moment on each side. Slope is per unit of normalized span.
  return {
    deflection: factor * x * (term - x ** 2),
    slope: (rightSide ? -1 : 1) * span * factor * (term - 3 * x ** 2),
  };
}

export function wheelMotion(e: Experiment) {
  const height = e.values.height / 100;
  const inertia = axialInertia + (e.attached ? wheelMass * (wheelRadii.outer ** 2 + wheelRadii.inner ** 2) / 2 : 0);
  const friction = e.attached ? .18 : .11;
  const weight = hangingMass * gravity;
  const effectiveMass = hangingMass + inertia / wheelRadii.shaft ** 2;
  const acceleration = (weight - friction) / effectiveMass;
  const fallTime = Math.sqrt(2 * height / acceleration);
  const riseAcceleration = (weight + friction) / effectiveMass;
  const riseTime = acceleration * fallTime / riseAcceleration;
  const rebound = height * (weight - friction) / (weight + friction);
  const riseElapsed = Math.max(0, e.elapsed - fallTime);
  const rise = riseAcceleration * riseElapsed * (riseTime - riseElapsed / 2);
  const distance = e.elapsed <= fallTime ? acceleration * e.elapsed ** 2 / 2 : height - rise;
  const unwound = e.elapsed <= fallTime ? distance : height + rise;
  return { fallTime, riseTime, rebound, height: 100 * (height - distance), angle: unwound / wheelRadii.shaft };
}

export function stokesSpeed(diameter: number, radius: number) {
  const r = diameter / 2000;
  return 100 * 2 * (tank.glassDensity - tank.liquidDensity) * gravity * r ** 2 /
    (9 * tank.viscosity * (1 + 2.4 * r / (radius / 100)));
}

export function stokesMotion(e: Experiment) {
  // Use the specimen's mean diameter for motion and a local diameter for the micrometer.
  const diameter = glassBallDiameters[e.values.ball - 1];
  const speed = stokesSpeed(diameter, tank.radius);
  const tau = .03;
  return { diameter, speed, depth: Math.min(tank.depth, speed * (e.elapsed + tau * Math.expm1(-e.elapsed / tau))) };
}

export function phaseShift(e: Experiment) {
  return 2 * Math.PI * e.values.frequency * (e.values.microphone - e.values.speaker) / (100 * airSpeed) + (e.obstacle ? .8 : 0);
}

export function resonance(e: Experiment) {
  const phase = 2 * Math.PI * (e.values.column / 100) * fork.frequency / airSpeed;
  const peak = .1 + .9 * Math.exp(-Math.pow(Math.cos(phase) / .19, 2));
  return peak * Math.max(0, 1 - e.struck / 9);
}

export function saturationPressure(celsius: number) {
  // IAPWS SR1-86(1992), saturation curve for ordinary water. Output in kPa.
  const temperature = celsius + 273.15;
  const theta = 1 - temperature / 647.096;
  const a = -7.85951783 * theta + 1.84408259 * theta ** 1.5 - 11.7866497 * theta ** 3
    + 22.6807411 * theta ** 3.5 - 15.9618719 * theta ** 4 + 1.80122502 * theta ** 7.5;
  return 22064 * Math.exp(647.096 / temperature * a);
}

export function benzenePressure(celsius: number) {
  // NIST WebBook, Antoine fit by Willingham et al.; exponential uses T in K and p in bar.
  // Its lower fit bound is 287.70 K; the simulated bath starts at 293.15 K.
  return 100 * 10 ** (4.01814 - 1203.835 / (celsius + 273.15 - 53.226));
}

export function hydrogenReadings(e: Experiment) {
  const moles = e.values.current * e.elapsed / (2 * 96485.33212);
  const vapor = hydrogen.waterActivity * saturationPressure(hydrogen.bathTemperature);
  const pressure = atmosphere - vapor;
  const head = hydrogen.liquidDensity * gravity / (1e5 * hydrogen.tubeArea);
  const gas = moles * gasConstant * (hydrogen.bathTemperature + 273.15) * 1000;
  const volume = 2 * gas / (pressure + Math.sqrt(pressure ** 2 + 4 * head * gas));
  return { volume, height: volume / hydrogen.tubeArea, vapor };
}

export function vaporFromWetBulb(dry: number, wet: number, pressure: number) {
  return saturationPressure(wet) - wetCoefficient * pressure * (dry - wet);
}

function equilibriumWetBulb() {
  const vapor = .58 * saturationPressure(ambientTemperature);
  let low = 0, high = ambientTemperature;
  for (let i = 0; i < 35; i++) {
    const middle = (low + high) / 2;
    if (vaporFromWetBulb(ambientTemperature, middle, atmosphere) < vapor) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}
const wetBulbTarget = equilibriumWetBulb();

export function psychrometerFanRunning(e: Experiment) {
  return e.wet && e.turns >= psychrometerWind.startTurns;
}

function contactGap(mode: ModeKey, e: Experiment) {
  if (mode === 'sphere') return roundReading(specimenSize(mode, e), micrometerJaw.step);
  if (mode === 'cylinder') return roundReading(specimenSize(mode, e), caliperJaw.step);
  return 0;
}

function fitCylinder(e: Experiment) {
  if (e.values.jaw < contactGap('cylinder', e)) e.values.jaw = caliperJaw.initial;
}

export function controlMinimum(mode: Mode, e: Experiment, field: Control) {
  return field.key === 'jaw' ? contactGap(mode.key, e) : field.min;
}

export function setControl(mode: Mode, e: Experiment, field: Control, value: number) {
  if (!Number.isFinite(value)) return;
  if (controlDisabled(mode, e, field.key)) return;
  const previous = e.values[field.key];
  e.values[field.key] = Math.max(controlMinimum(mode, e, field), normalize(field, value));
  if (field.key === 'point' && e.values.point !== previous) {
    if (mode.key === 'cylinder') e.values.jaw = caliperJaw.initial;
    if (mode.key === 'sphere') e.values.jaw = micrometerJaw.initial;
  }
  if (field.key === 'height' || field.key === 'ball') resetRun(e);
  if (mode.key === 'electrolysis') resetRun(e);
}

export function controlDisabled(mode: Mode, e: Experiment, key: string) {
  return (key === 'height' && e.stage === 'moving')
    || (key === 'ball' && e.stage === 'moving')
    || (mode.key === 'electrolysis' && e.stage !== 'ready');
}

function resetRun(e: Experiment) {
  e.stage = 'ready';
  e.elapsed = 0;
}

export interface Action { key: string; label: string; disabled?: boolean; pressed?: boolean }

export const stopwatchPrecision = { flywheel: 2, stokes: 2, electrolysis: 1 } as const;
export type StopwatchMode = keyof typeof stopwatchPrecision;

export function isStopwatchMode(mode: ModeKey): mode is StopwatchMode {
  return Object.hasOwn(stopwatchPrecision, mode);
}

export function stopwatchReading(mode: StopwatchMode, e: Experiment) {
  return roundReading(mode === 'electrolysis' ? e.elapsed : e.time, 10 ** -stopwatchPrecision[mode]);
}

function recordTimeAction(mode: StopwatchMode, e: Experiment): Action {
  return { key: 'record-time', label: 'Записати час', disabled: stopwatchReading(mode, e) <= 0 };
}

export function actions(mode: ModeKey, e: Experiment): Action[] {
  const measure = (key: string, label: string) => ({ key, label, pressed: e.tool === key });
  switch (mode) {
    case 'cylinder': return [measure('diameter', 'Діаметр'), measure('height', 'Висота')];
    case 'sphere': return [{ key: 'contact', label: 'Підвести гвинт тріскачкою' }];
    case 'stretch':
    case 'bend': return [{ key: 'zero', label: 'Встановити нуль', disabled: e.values.load !== 0 }];
    case 'flywheel': return [{ key: 'wheel', label: e.attached ? 'Зняти колесо' : 'Установити колесо', disabled: e.stage === 'moving' },
      { key: 'prepare', label: 'Намотати нитку', disabled: e.stage === 'moving' },
      { key: 'release', label: 'Відпустити тягарець', disabled: e.stage !== 'ready' }, ...timerActions(mode, e)];
    case 'stokes': return [
      e.stage === 'ready'
        ? { key: 'release', label: 'Опустити кульку' }
        : { key: 'prepare', label: 'Вийняти кульку' },
      ...timerActions(mode, e)];
    case 'phase': return [{ key: 'scope', label: 'Осцилограф', pressed: e.scope },
      { key: 'generator', label: 'Генератор', pressed: e.generator },
      { key: 'obstacle', label: 'Перешкода між приладами', pressed: e.obstacle }];
    case 'resonance': return [{ key: 'strike', label: 'Вдарити по камертону' }];
    case 'gas': return [{ key: 'pump', label: 'Качнути насосом', disabled: e.stage === 'recovering' || e.stage === 'settled' || e.offset >= 24 },
      { key: 'vent', label: 'Коротко відкрити кран', disabled: e.stage !== 'pumped' || Math.abs(e.pressure - e.offset) >= .05 },
      { key: 'prepare', label: 'Вирівняти тиск для повтору' }];
    case 'benzene': return [{ key: 'heat', label: 'Нагрівач', pressed: e.heater },
      { key: 'valve', label: 'З’єднати з насосом', pressed: e.valve },
      { key: 'pump', label: 'Качнути насосом', disabled: !e.valve || e.vacuum >= 99 },
      { key: 'fine', label: 'Відкачати на 0,1 кПа', disabled: !e.valve || e.vacuum >= 99 },
      { key: 'bleed', label: 'Впустити повітря на 0,1 кПа', disabled: !e.valve || e.vacuum <= 0 }];
    case 'electrolysis': return [{ key: 'run', label: 'Увімкнути струм і секундомір', disabled: e.stage !== 'ready' },
      { key: 'stop', label: 'Вимкнути струм і секундомір', disabled: e.stage !== 'running' },
      { key: 'prepare', label: 'Випустити газ і підготувати повтор', disabled: e.stage !== 'settled' }, recordTimeAction(mode, e)];
    case 'humidity': return [{ key: 'wet', label: 'Змочити батист', pressed: e.wet }, { key: 'wind', label: 'Зробити оберт ключем', disabled: !e.wet || e.turns >= psychrometerWind.maxTurns }];
  }
}

function timerActions(mode: 'flywheel' | 'stokes', e: Experiment): Action[] {
  return [
    { key: 'timer', label: e.timer ? 'Зупинити секундомір' : 'Запустити секундомір' },
    { key: 'reset-time', label: 'Обнулити секундомір', disabled: e.timer || e.time === 0 },
    recordTimeAction(mode, e),
  ];
}

export function perform(mode: ModeKey, e: Experiment, key: string) {
  const action = actions(mode, e).find(item => item.key === key);
  if (!action || action.disabled) return;
  switch (key) {
    case 'contact': e.values.jaw = contactGap(mode, e); break;
    case 'diameter':
    case 'height':
      e.tool = key;
      if (mode === 'cylinder') fitCylinder(e);
      break;
    case 'zero': e.offset = deformation(mode, e) + .03; break;
    case 'wheel': e.attached = !e.attached; resetRun(e); break;
    case 'prepare': resetRun(e); e.pressure = 0; e.offset = 0; break;
    case 'release': e.stage = 'moving'; e.elapsed = 0; break;
    case 'timer': e.timer = !e.timer; break;
    case 'reset-time': e.time = 0; break;
    case 'record-time': break;
    case 'scope': e.scope = !e.scope; e.warm = 0; break;
    case 'generator': e.generator = !e.generator; e.generatorWarm = 0; break;
    case 'obstacle': e.obstacle = !e.obstacle; break;
    case 'strike': e.struck = 0; e.starts++; break;
    case 'pump':
      if (mode === 'gas') {
        e.stage = 'pumped';
        e.offset = Math.min(24, e.offset + 4);
        e.pressure = e.offset + 1.7;
      } else e.vacuum = roundReading(Math.min(99, e.vacuum + (e.vacuum < 50 ? 10 : 2)), .1);
      break;
    case 'vent': e.stage = 'recovering'; e.pressure = 0; break;
    case 'heat': e.heater = !e.heater; break;
    case 'valve': e.valve = !e.valve; if (!e.valve) e.vacuum = 0; break;
    case 'fine': e.vacuum = roundReading(Math.min(99, e.vacuum + .1), .1); break;
    case 'bleed': e.vacuum = roundReading(Math.max(0, e.vacuum - .1), .1); break;
    case 'run': e.stage = 'running'; e.time = 0; break;
    case 'stop': e.stage = 'settling'; e.time = 0; break;
    case 'wet': e.wet = true; break;
    case 'wind': e.turns++; break;
  }
}

function approach(value: number, target: number, dt: number, tau: number, threshold: number) {
  const updated = target + (value - target) * Math.exp(-dt / tau);
  return Math.abs(updated - target) < threshold ? target : updated;
}

export function tick(mode: ModeKey, e: Experiment, dt: number): boolean {
  if (e.timer) e.time += dt;
  switch (mode) {
    case 'flywheel': {
      if (e.stage !== 'moving') return e.timer;
      e.elapsed += dt;
      const { fallTime, riseTime } = wheelMotion(e);
      if (e.elapsed >= fallTime + riseTime) {
        e.elapsed = fallTime + riseTime;
        e.stage = 'done';
      }
      return true;
    }
    case 'stokes':
      if (e.stage !== 'moving') return e.timer;
      e.elapsed += dt;
      if (stokesMotion(e).depth >= tank.depth) e.stage = 'done';
      return true;
    case 'phase':
      if (e.scope && e.warm < 1 || e.generator && e.generatorWarm < 1) {
        if (e.scope) e.warm = Math.min(1, e.warm + dt / 2.5);
        if (e.generator) e.generatorWarm = Math.min(1, e.generatorWarm + dt / 2.5);
        return true;
      }
      return false;
    case 'resonance':
      if (e.starts && e.struck < 9) { e.struck += dt; return true; }
      return false;
    case 'gas': {
      if (e.stage !== 'pumped' && e.stage !== 'recovering') return false;
      const target = e.stage === 'pumped' ? e.offset : e.offset * (1 - 1 / 1.402);
      if (e.pressure === target) return false;
      e.pressure = approach(e.pressure, target, dt, 1.05, .045);
      if (e.stage === 'recovering' && e.pressure === target) e.stage = 'settled';
      return true;
    }
    case 'benzene': {
      const target = e.heater ? e.values.temperature : 20;
      if (target === e.temperature) return false;
      e.temperature = approach(e.temperature, target, dt, 1.35, .045);
      return true;
    }
    case 'electrolysis':
      if (e.stage === 'running') {
        e.elapsed += 12 * dt;
        if (hydrogenReadings(e).volume >= 8) { e.stage = 'settling'; e.time = 0; }
        return true;
      }
      if (e.stage === 'settling') {
        e.time += dt;
        if (e.time >= 1.8) e.stage = 'settled';
        return true;
      }
      return false;
    case 'humidity':
      if (!psychrometerFanRunning(e) || e.stage === 'settled') return false;
      e.temperature = approach(e.temperature, wetBulbTarget, dt, 1.2, .045);
      if (e.temperature === wetBulbTarget) e.stage = 'settled';
      return true;
    default: return false;
  }
}
