import { escapeHtml } from '../lab-layout';
import { downloadCSV } from '../storage';
import { stopwatchPrecision, stopwatchReading } from './model';
import type { Experiment, StopwatchMode } from './model';
import { display } from './scene';

const contextFields: Record<StopwatchMode, string[]> = {
  flywheel: ['Колесо', 'Початкова висота, см'],
  stokes: ['Кулька'],
  electrolysis: ['Струм, А'],
};

const fileName: Record<StopwatchMode, string> = {
  flywheel: 'mechanics-3-flywheel-time.csv',
  stokes: 'mechanics-4-stokes-time.csv',
  electrolysis: 'mechanics-8-electrolysis-time.csv',
};

const origins = { instrument: 'Секундомір', manual: 'Власні' } as const;

interface Timing {
  id: number;
  time: number;
  conditions: string[];
  source: keyof typeof origins;
}

function conditionsAtStart(mode: StopwatchMode, e: Experiment): string[] {
  switch (mode) {
    case 'flywheel': return [e.attached ? 'З колесом' : 'Без колеса', display(e.values.height)];
    case 'stokes': return [`№ ${display(e.values.ball)}`];
    case 'electrolysis': return [display(e.values.current, 3)];
  }
}

function restore(mode: StopwatchMode, key: string): Timing[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    if (!Array.isArray(data)) return [];
    return data.filter((row): row is Timing => !!row && Number.isSafeInteger(row.id) && row.id > 0
      && Number.isFinite(row.time) && row.time > 0
      && (row.source === 'manual' || row.source === 'instrument')
      && Array.isArray(row.conditions) && row.conditions.length === contextFields[mode].length
      && row.conditions.every((value: unknown) => typeof value === 'string'));
  } catch { return []; }
}

export function timeLogMarkup(mode: StopwatchMode) {
  const step = 10 ** -stopwatchPrecision[mode];
  return `<section id="mech-time-log" class="controls-card mechanics-time-log" aria-labelledby="mech-time-title">
    <div class="section-title">
      <h2 id="mech-time-title">Журнал часу</h2>
      <button type="button" class="secondary-button" data-time-action="export" disabled>Експорт CSV</button>
    </div>
    <p class="muted">«Запис» зберігає поточний показ секундоміра.</p>
    <form class="mechanics-data-form">
      <label>Час, с <input type="number" name="time" min="${step}" step="${step}" required inputmode="decimal"></label>
      <button type="submit" class="secondary-button">Додати вручну</button>
      <button type="button" class="text-button" data-time-action="cancel" hidden>Скасувати</button>
    </form>
    <p role="status" class="mechanics-time-status"></p>
    <div class="table-scroll" role="region" aria-label="Записані відліки часу" tabindex="0" hidden>
      <table aria-label="Записані відліки часу">
        <thead><tr><th scope="col">№</th>${contextFields[mode].map(field => `<th scope="col">${field}</th>`).join('')}
          <th scope="col">Час, с</th><th scope="col">Джерело</th><th scope="col">Дії</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  </section>`;
}

export function mountTimeLog(root: HTMLElement, mode: StopwatchMode, getExperiment: () => Experiment, options: AddEventListenerOptions) {
  const container = root.querySelector<HTMLElement>('#mech-time-log')!;
  const form = container.querySelector('form')!;
  const input = form.querySelector('input')!;
  const submit = form.querySelector('button[type="submit"]')!;
  const cancel = form.querySelector<HTMLButtonElement>('[data-time-action="cancel"]')!;
  const table = container.querySelector<HTMLElement>('.table-scroll')!;
  const body = table.querySelector('tbody')!;
  const exportButton = container.querySelector<HTMLButtonElement>('[data-time-action="export"]')!;
  const status = container.querySelector<HTMLElement>('[role="status"]')!;
  const storageKey = `mechanics-stopwatch:v1:${mode}`;
  const rows = restore(mode, storageKey);
  let nextId = rows.reduce((last, row) => Math.max(last, row.id), 0) + 1;
  let editing: Timing | undefined;
  let timedConditions: string[] | undefined;

  function renderRows() {
    body.innerHTML = rows.map((row, index) => `<tr><th scope="row">${index + 1}</th>
      ${row.conditions.map(value => `<td>${escapeHtml(value)}</td>`).join('')}
      <td>${display(row.time, stopwatchPrecision[mode])}</td><td>${origins[row.source]}</td>
      <td class="mechanics-time-actions">
        <button type="button" class="text-button" data-time-action="edit" data-time-id="${row.id}" aria-label="Змінити час у рядку ${index + 1}">Змінити</button>
        <button type="button" class="text-button" data-time-action="delete" data-time-id="${row.id}" aria-label="Видалити рядок ${index + 1}">Видалити</button>
      </td></tr>`).join('');
    table.hidden = !rows.length;
    exportButton.disabled = !rows.length;
  }

  function save(message: string) {
    try { localStorage.setItem(storageKey, JSON.stringify(rows)); } catch { /* Keep rows available for export. */ }
    renderRows();
    status.textContent = message;
  }

  function clearEdit() {
    editing = undefined;
    form.reset();
    submit.textContent = 'Додати вручну';
    cancel.hidden = true;
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const time = input.valueAsNumber;
    if (!Number.isFinite(time) || time <= 0) return;
    if (editing) {
      if (editing.time !== time) {
        editing.time = time;
        editing.source = 'manual';
      }
    } else rows.push({ id: nextId++, time, conditions: conditionsAtStart(mode, getExperiment()), source: 'manual' });
    clearEdit();
    save('Час збережено.');
  }, options);

  container.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-time-action]');
    if (!button) return;
    const action = button.dataset.timeAction;
    if (action === 'export') {
      if (rows.length) downloadCSV(fileName[mode], ['№', 'Режим', ...contextFields[mode], 'Час, с', 'Джерело'],
        rows.map((row, i) => [i + 1, { flywheel: 'Махове колесо', stokes: 'Осідання кульки', electrolysis: 'Електроліз' }[mode],
          ...row.conditions, display(row.time, stopwatchPrecision[mode]), origins[row.source]]));
      return;
    }
    if (action === 'cancel') {
      clearEdit();
      input.focus();
      return;
    }
    const index = rows.findIndex(row => row.id === Number(button.dataset.timeId));
    if (index < 0) return;
    if (action === 'edit') {
      editing = rows[index];
      input.value = String(editing.time);
      submit.textContent = 'Зберегти зміну';
      cancel.hidden = false;
    } else if (action === 'delete') {
      if (editing === rows[index]) clearEdit();
      rows.splice(index, 1);
      save('Рядок видалено.');
    }
    input.focus();
  }, options);

  renderRows();
  return {
    start(e: Experiment) {
      timedConditions = conditionsAtStart(mode, e);
    },
    record(e: Experiment) {
      const time = stopwatchReading(mode, e);
      rows.push({ id: nextId++, time, conditions: timedConditions ?? conditionsAtStart(mode, e), source: 'instrument' });
      save(`Записано ${display(time, stopwatchPrecision[mode])} с.`);
    },
  };
}
