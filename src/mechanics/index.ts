import { asset, escapeHtml, mechanicsGuide } from '../lab-layout';
import { renderFormulas } from '../formulas';
import { actions, atmosphere, controlDisabled, controlMinimum, normalize, fork, freshExperiment, isStopwatchMode, modes, perform, persistExperiment, resonance, saturationPressure, setControl, tick } from './model';
import type { Control, Experiment, Mode } from './model';
import { benzeneCharts, nomogram } from './charts';
import { display, drawScene, sceneMarkup } from './scene';
import { bindHardware } from './hardware';
import { mountTimeLog, timeLogMarkup } from './time-log';
import { equations, labs, math } from './content';
import { questions } from './questions';

export const mechanicsLabs = Object.entries(labs).map(([id, lab]) => ({ id: Number(id), short: lab.short }));

export function mechanicsMode(id: number, key?: string): Mode {
  return modes.find(mode => mode.lab === id && mode.key === key) ?? modes.find(mode => mode.lab === id) ?? modes[0];
}

export const mechanicsFigure = (id: number, index: number) => labs[id].figures[index];

function controlMarkup(field: Control, value: number) {
  const title = escapeHtml(field.label);
  const units = field.unit ? ` ${field.unit}` : '';
  const stepLabel = `${display(field.step, field.step.toString().split('.')[1]?.length ?? 0)}${units}`;
  const attrs = `data-mechanics-control="${field.key}" min="${field.min}" max="${field.max}" step="${field.step}" value="${value}"`;
  return `<div class="control" data-mechanics-field="${field.key}"><label for="mechanics-number-${field.key}">${title}<span>${field.unit}</span></label>
    <div class="control-inputs mechanics-control">
      <button type="button" data-step="-1" aria-label="${title}, зменшити на ${stepLabel}">−</button>
      <input type="range" ${attrs} aria-label="${title}, повзунок">
      <button type="button" data-step="1" aria-label="${title}, збільшити на ${stepLabel}">+</button>
      <input type="number" id="mechanics-number-${field.key}" ${attrs} inputmode="decimal">
    </div></div>`;
}

function figures(id: number) {
  return labs[id].figures.map(({ file, caption }, index) => `<figure><button data-mechanics-image="${index}" aria-label="Збільшити: ${escapeHtml(caption)}">
    <img src="${asset(file)}" alt="${escapeHtml(caption)}" loading="lazy"></button><figcaption>${escapeHtml(caption)}</figcaption></figure>`).join('');
}

function actionMarkup(buttons: ReturnType<typeof actions>) {
  return buttons.map(action => `<button type="button" class="secondary-button" data-mechanics-action="${action.key}">${action.label}</button>`).join('');
}

function methodOptions(mode: Mode, methods: Mode[]) {
  return methods.map(method => `<option value="${method.key}" ${method.key === mode.key ? 'selected' : ''}>${method.label}</option>`).join('');
}

function saturationReference(withNomogram: boolean) {
  return `<section class="mechanics-reference theory-card">
    <h2>Довідник для обробки вимірювань</h2>
    <form id="mech-saturation" class="mechanics-data-form">
      <label>Температура, °C <input type="number" name="temperature" min="0.01" max="40" step="0.01" required></label>
      <button type="submit" class="secondary-button">Знайти тиск насиченої пари</button>
    </form>
    <p id="mech-saturation-output" role="status"></p>
    ${withNomogram ? `<figure class="mechanics-nomogram"><div class="mechanics-chart-viewport" tabindex="0">${nomogram()}</div>
      <figcaption>Відносна вологість за барометричного тиску ${display(atmosphere, 1)} кПа. Обери точку за відліками сухого й мокрого термометрів.</figcaption></figure>`
      : '<p>Для електроліту помнож довідковий тиск чистої води на 0,968.</p>'}
    <p>Довідкова крива за <a href="https://iapws.org/technical-guidance/release/Supp-sat" target="_blank" rel="noopener noreferrer">IAPWS SR1-86(1992)</a>.</p>
  </section>`;
}

function chartEntry() {
  return `<section class="mechanics-reference theory-card" aria-label="Графіки вимірювань">
    <h2>Графіки за вимірюваннями</h2>
    <p>Запиши температуру ванни й абсолютний тиск, розрахований із відліку вакуумметра. Повторне введення температури замінює її точку.</p>
    <form id="mech-benzene-form" class="mechanics-data-form">
      <label>Температура, °C <input type="number" name="temperature" min="20" max="50" step="0.1" required></label>
      <label>Тиск, кПа <input type="number" name="pressure" min="0.1" max="${atmosphere}" step="0.1" required></label>
      <button type="submit" class="secondary-button">Додати точку</button>
    </form>
    <ul id="mech-benzene-points" class="mechanics-points" aria-label="Введені точки"></ul>
    <div id="mech-benzene-charts"></div>
  </section>`;
}

export function mechanicsContent(mode: Mode, e: Experiment) {
  const lab = labs[mode.lab];
  const methods = modes.filter(option => option.lab === mode.lab);
  const formulas = equations[mode.key];
  const buttons = actions(mode.key, e)
    .filter(action => mode.key !== 'stokes' || (action.key !== 'release' && action.key !== 'prepare'));
  return `
    <section id="panel-experiment" role="tabpanel" aria-labelledby="tab-experiment">
      <div class="experiment-grid">
        <section class="apparatus-card" aria-label="Інтерактивна лабораторна установка">
          <p class="bench-pan-hint">На телефоні посунь стенд убік, щоб побачити всі прилади.</p>
          <div class="bench-viewport"><div id="bench" class="bench-host" data-backend="svg">
            ${sceneMarkup(mode)}
            ${methods.length > 1 ? `<div class="subject-picker mechanics-stage-method" data-instrument="${mode.key}">
              <span aria-hidden="true">${mode.label}</span><select id="mech-method" aria-label="Режим досліду">${methodOptions(mode, methods)}</select>
            </div>` : ''}
          </div></div>
          ${mode.controls.length ? '<p class="mechanics-handling">Перетягуй ручки й деталі на стенді або регулюй кнопками «−» і «+».</p>' : ''}
        </section>
        <section class="controls-card mechanics-controls-card">
          <div class="section-title"><h2>Точне керування</h2><button type="button" class="text-button" id="mech-reset">Скинути ↺</button></div>
          ${mode.controls.length ? `<div class="controls">${mode.controls.map(field => controlMarkup(field, e.values[field.key])).join('')}</div>` : ''}
          <details class="mechanics-backup"><summary>Кнопки керування</summary><div class="mechanics-actions">${actionMarkup(buttons)}</div></details>
          <p id="mech-status" class="sr-only" role="status"></p>
          <div class="formula-card"><span>КЛЮЧОВІ ФОРМУЛИ</span>${renderFormulas(formulas)}</div>
        </section>
      </div>
      ${isStopwatchMode(mode.key) ? timeLogMarkup(mode.key) : ''}
      ${mode.key === 'benzene' ? chartEntry() : ''}
    </section>
    <section id="panel-theory" role="tabpanel" aria-labelledby="tab-theory" hidden>
      <div class="theory-grid"><article class="theory-card">
        <h2>${lab.short}</h2><p>${lab.principle}</p>
        <div class="theory-formula">${renderFormulas(formulas)}</div>
        <h3>Як виконати роботу</h3><ol class="steps">${lab.steps.map((step, index) => `<li><span>${index + 1}</span><p>${step}</p></li>`).join('')}</ol>
        <details class="uncertainty-help"><summary>Як визначається похибка</summary>
          ${renderFormulas([math.student, math.uncertainty])}<p>${lab.uncertainty}</p>
          <p class="uncertainty-source">Коефіцієнт Стьюдента визначають за довірчою ймовірністю та числом незалежних повторів. Квадратичне поширення застосовують для малих незалежних невизначеностей. Крок, похибки приладів і кореляції перевіряй окремо.</p>
        </details>
        <p class="source-note">Методичні вказівки ОНУ, с. ${lab.pages}. Загальні правила обробки — с. 4–17.</p>
      </article><div class="figures">${figures(mode.lab)}</div></div>
      ${mode.key === 'humidity' || mode.key === 'electrolysis' ? saturationReference(mode.key === 'humidity') : ''}
    </section>
    <section id="panel-questions" role="tabpanel" aria-labelledby="tab-questions" hidden>
      <div class="questions">${questions[mode.lab].map(({ question, answer, formulas }, i) => `
        <details><summary><span class="question-number">${i + 1}</span><span>${question}</span><span class="question-plus">＋</span></summary>
        <div class="question-answer"><p>${answer}</p>${formulas?.length ? renderFormulas(formulas) : ''}</div></details>`).join('')}</div>
    </section>
    <section id="panel-equipment" role="tabpanel" aria-labelledby="tab-equipment" hidden>
      <article class="equipment-guide">
        <div class="equipment-heading"><h2>Обладнання</h2>
          <a class="secondary-button" href="${asset(mechanicsGuide)}#page=${lab.pages.split('–')[0]}" target="_blank" rel="noopener">Відкрити в методичці</a></div>
        <dl class="mechanics-equipment">${lab.equipment.map(([name, description]) => `<dt>${name}</dt><dd>${description}</dd>`).join('')}</dl>
      </article>
    </section>`;
}

function updateButton(button: HTMLButtonElement, action: ReturnType<typeof actions>[number]) {
  button.disabled = !!action.disabled;
  if (action.pressed !== undefined) button.setAttribute('aria-pressed', String(action.pressed));
  if (button.textContent !== action.label) button.textContent = action.label;
}

type Point = [number, number];
const benzeneStorageKey = 'mechanics-benzene-points:v1';
function restorePoints(): Point[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(benzeneStorageKey) ?? '[]');
    if (!Array.isArray(raw)) return [];
    const pairs = raw.filter((p): p is Point => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)
      && p[0] >= 20 && p[0] <= 50 && p[1] > 0 && p[1] <= atmosphere);
    return [...new Map(pairs).entries()].sort((a, b) => a[0] - b[0]);
  } catch { return []; }
}

export function mountMechanics(mode: Mode, initial: Experiment) {
  let experiment = initial;
  const root = document.querySelector<HTMLElement>('#workspace')!;
  const bench = root.querySelector<HTMLElement>('#bench')!;
  const svg = bench.querySelector<SVGSVGElement>('svg')!;
  const status = root.querySelector('#mech-status')!;
  let hardware: ReturnType<typeof drawScene> = [];
  const cancellation = new AbortController();
  const options = { signal: cancellation.signal };
  const timeLog = isStopwatchMode(mode.key) ? mountTimeLog(root, mode.key, () => experiment, options) : undefined;
  const controls = mode.controls.map(field => {
    const group = root.querySelector<HTMLElement>(`[data-mechanics-field="${field.key}"]`)!;
    return { field, inputs: [...group.querySelectorAll('input')], buttons: [...group.querySelectorAll('button')] };
  });
  const buttons = new Map([...root.querySelectorAll<HTMLButtonElement>('[data-mechanics-action]')]
    .map(button => [button.dataset.mechanicsAction!, button]));
  const points = new Map(mode.key === 'benzene' ? restorePoints() : []);
  let audio: AudioContext | undefined;
  let level: GainNode | undefined;

  function render() {
    hardware = drawScene(svg, mode, experiment);
    const message = bench.querySelector('.mechanics-status')!.textContent;
    if (message !== status.textContent) status.textContent = message;
    for (const action of actions(mode.key, experiment)) {
      const button = buttons.get(action.key);
      if (button) updateButton(button, action);
    }
    for (const { field, inputs, buttons } of controls) {
      const value = experiment.values[field.key];
      const blocked = controlDisabled(mode, experiment, field.key);
      const minimum = controlMinimum(mode, experiment, field);
      inputs.forEach(input => {
        input.disabled = blocked;
        input.min = String(minimum);
        if (document.activeElement !== input || input.type === 'range') input.value = String(value);
      });
      buttons.forEach(button => { button.disabled = blocked || (button.dataset.step === '-1' ? value <= minimum : value >= field.max); });
    }
    if (audio && level) level.gain.setTargetAtTime(resonance(experiment) * .075, audio.currentTime, .045);
  }

  function startTone() {
    try {
      if (!audio) {
        audio = new AudioContext();
        const tone = audio.createOscillator();
        tone.frequency.value = fork.frequency;
        level = audio.createGain();
        level.gain.value = 0;
        tone.connect(level);
        level.connect(audio.destination);
        tone.start();
      }
      if (audio.state === 'suspended') void audio.resume().catch(() => {});
    } catch { /* The loudness scale remains available if audio is disabled. */ }
  }

  function savePoints() {
    const rows = [...points.entries()].sort((a, b) => a[0] - b[0]) as Point[];
    root.querySelector('#mech-benzene-points')!.innerHTML = rows.map(([temperature, pressure]) =>
      `<li>${display(temperature, 1)} °C · ${display(pressure, 1)} кПа
        <button type="button" data-remove-point="${temperature}" aria-label="Видалити точку при ${display(temperature, 1)} градусах">×</button></li>`).join('');
    root.querySelector('#mech-benzene-charts')!.innerHTML = benzeneCharts(rows);
  }

  function commitPoints() {
    try { localStorage.setItem(benzeneStorageKey, JSON.stringify([...points.entries()])); } catch { /* Optional persistence. */ }
    savePoints();
  }

  function updateField(field: Control, value: number) {
    const next = Math.max(controlMinimum(mode, experiment, field), normalize(field, value));
    if (next === experiment.values[field.key] || controlDisabled(mode, experiment, field.key)) return;
    setControl(mode, experiment, field, next);
    persistExperiment(mode, experiment);
    render();
  }

  function activate(key: string) {
    if (timeLog && (key === 'record-time' || key === 'run' || key === 'timer')) {
      const action = actions(mode.key, experiment).find(item => item.key === key);
      if (!action || action.disabled) return;
      if (key === 'record-time') {
        timeLog.record(experiment);
        return;
      }
      if (key === 'run' || (!experiment.timer && experiment.time === 0)) timeLog.start(experiment);
    }
    perform(mode.key, experiment, key);
    if (key === 'strike') startTone();
    persistExperiment(mode, experiment);
    render();
  }

  bindHardware(svg, options, id => hardware.find(item => item.id === id), () => experiment, mode, updateField, activate);

  root.addEventListener('input', event => {
    const input = event.target as HTMLInputElement;
    const field = mode.controls.find(item => item.key === input.dataset.mechanicsControl);
    if (field && Number.isFinite(input.valueAsNumber) && input.valueAsNumber >= field.min && input.valueAsNumber <= field.max
        && (input.type === 'range' || !input.validity.stepMismatch)) {
      input.removeAttribute('aria-invalid');
      updateField(field, input.valueAsNumber);
    } else if (field) input.setAttribute('aria-invalid', 'true');
  }, options);

  root.addEventListener('change', event => {
    const input = event.target as HTMLInputElement;
    if (input.id === 'mech-method') {
      location.hash = `/mechanics/${mode.lab}/${input.value}`;
    } else if (input.dataset.mechanicsControl) {
      input.value = String(experiment.values[input.dataset.mechanicsControl]);
      input.removeAttribute('aria-invalid');
    }
  }, options);

  root.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button) return;
    if (button.id === 'mech-reset') {
      experiment = freshExperiment(mode, false);
    } else if (button.dataset.mechanicsAction) {
      activate(button.dataset.mechanicsAction);
      return;
    } else if (button.dataset.step) {
      const group = button.closest<HTMLElement>('[data-mechanics-field]')!;
      const field = mode.controls.find(item => item.key === group.dataset.mechanicsField)!;
      updateField(field, experiment.values[field.key] + field.step * Number(button.dataset.step));
      if (button.disabled) group.querySelector<HTMLInputElement>('input[type="range"]')?.focus();
      return;
    } else if (button.dataset.removePoint !== undefined) {
      points.delete(Number(button.dataset.removePoint));
      commitPoints();
      root.querySelector<HTMLInputElement>('#mech-benzene-form input')?.focus();
      return;
    } else return;
    persistExperiment(mode, experiment);
    render();
  }, options);

  root.addEventListener('submit', event => {
    const form = event.target as HTMLFormElement;
    if (form.id !== 'mech-benzene-form' && form.id !== 'mech-saturation') return;
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const temperature = Number(data.get('temperature'));
    if (form.id === 'mech-saturation') {
      root.querySelector('#mech-saturation-output')!.textContent = `${display(temperature, 2)} °C · ${display(saturationPressure(temperature), 3)} кПа`;
    } else {
      points.set(temperature, Number(data.get('pressure')));
      commitPoints();
    }
  }, options);

  if (mode.key === 'benzene') savePoints();
  render();
  let frame = 0;
  let last = performance.now();
  function animate(now: number) {
    const delta = (now - last) / 1000;
    if (delta >= 1 / 30) {
      last = now;
      if (!document.hidden && tick(mode.key, experiment, Math.min(delta, .12))) render();
    }
    frame = requestAnimationFrame(animate);
  }
  frame = requestAnimationFrame(animate);
  return () => {
    cancellation.abort();
    cancelAnimationFrame(frame);
    if (audio) void audio.close().catch(() => {});
  };
}
