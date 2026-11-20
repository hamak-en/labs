import { escapeHtml } from '../lab-layout';
import { actions, controlDisabled, controlMinimum } from './model';
import type { Action, Control, Experiment, Mode } from './model';

const svgNS = 'http://www.w3.org/2000/svg';
const currentDrawings = new WeakMap<SVGGElement, string>();
const format = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3, useGrouping: false });

type HitBox = [x: number, y: number, width: number, height: number];
type Travel = { axis: 'x' | 'y' | 'dial'; pixelsPerUnit: number };

interface Hardware {
  id: string;
  action?: Action;
  field?: Control;
  direction?: -1 | 1;
  travel?: Travel;
  disabled: boolean;
  label: string;
  markup: string;
}

function engraving(x: number, y: number, value: string, className = 'mech-key-label') {
  return `<text x="${x}" y="${y}" text-anchor="middle" class="${className}">${escapeHtml(value)}</text>`;
}

function face([x, y, w, h]: HitBox, label: string, head = false) {
  const mid = x + w / 2;
  return `<rect class="mech-key-seat" x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/>
    <rect class="mech-key-face" x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 5}" rx="4"/>
    ${engraving(mid, y + h / 2 + 4, label, head ? 'mech-key-symbol' : undefined)}`;
}

function hotspot([x, y, w, h]: HitBox, marker?: [number, number]) {
  return `<rect class="mech-object-hit" x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/>
    ${marker ? `<circle class="mech-grip" cx="${marker[0]}" cy="${marker[1]}" r="9"/>
      <path class="mech-grip-glyph" d="M${marker[0] - 4} ${marker[1] - 2}h8m-8 4h8"/>` : ''}`;
}

export function hardwareDrawing(mode: Mode, experiment: Experiment) {
  const definitions = new Map(actions(mode.key, experiment).map(action => [action.key, action]));
  const fields = new Map<string, Control>(mode.controls.map(field => [field.key, field]));
  const items: Hardware[] = [];

  function addAction(key: string, markup: string) {
    const action = definitions.get(key);
    if (!action) throw new Error(`Невідома дія стенда: ${mode.key}/${key}`);
    items.push({ id: key, action, disabled: !!action.disabled, label: action.label, markup });
  }

  function addField(key: string, markup: string, travel?: Travel, direction?: -1 | 1) {
    const field = fields.get(key);
    if (!field) throw new Error(`Невідомий регулятор стенда: ${mode.key}/${key}`);
    const value = experiment.values[key];
    const blocked = controlDisabled(mode, experiment, key);
    const atLimit = direction === -1 && value <= controlMinimum(mode, experiment, field)
      || direction === 1 && value >= field.max;
    const step = `${format.format(field.step)}${field.unit ? ` ${field.unit}` : ''}`;
    const label = direction ? `${field.label}, ${direction < 0 ? 'зменшити' : 'збільшити'} на ${step}` : field.label;
    items.push({ id: direction ? `${key}-${direction < 0 ? 'minus' : 'plus'}` : key,
      field, direction, travel, disabled: blocked || atLimit, label, markup });
  }

  function steps(key: string, x: number, y: number, distance = 60) {
    addField(key, face([x - distance / 2 - 12, y, 24, 25], '−', true), undefined, -1);
    addField(key, face([x + distance / 2 - 12, y, 24, 25], '+', true), undefined, 1);
  }

  return {
    items,
    button(key: string, bounds: HitBox, label: string) {
      addAction(key, face(bounds, label));
    },
    object(key: string, bounds: HitBox, marker?: [number, number]) {
      addAction(key, hotspot(bounds, marker));
    },
    grip(key: string, bounds: HitBox, travel: Travel, marker: [number, number]) {
      addField(key, hotspot(bounds, marker), travel);
    },
    steps,
    index(key: string, x: number, y: number, label: string) {
      const value = experiment.values[key];
      addField(key, face([x - 21, y, 42, 25], format.format(value)), { axis: 'x', pixelsPerUnit: 16 });
      steps(key, x, y, 72);
      return engraving(x, y - 6, label, 'mech-engraving');
    },
    readout(key: string, x: number, y: number, label: string) {
      steps(key, x, y, 72);
      return engraving(x, y - 6, label, 'mech-engraving')
        + engraving(x, y + 17, format.format(experiment.values[key]), 'mech-setting');
    },
    knob(key: string, x: number, y: number, label: string, radius = 17) {
      const field = fields.get(key)!;
      const fraction = (experiment.values[key] - field.min) / (field.max - field.min);
      const angle = -132 + 264 * fraction;
      const ticks = Array.from({ length: 9 }, (_, index) => {
        const a = (-132 + 33 * index) * Math.PI / 180;
        const sx = Math.sin(a), sy = -Math.cos(a);
        return `<path class="mech-knob-tick" d="M${x + sx * (radius + 4)} ${y + sy * (radius + 4)}
          L${x + sx * (radius + 7)} ${y + sy * (radius + 7)}"/>`;
      }).join('');
      addField(key, `<circle class="mech-knob-base" cx="${x}" cy="${y + 1}" r="${radius + 3}"/>
        ${ticks}<circle class="mech-knob-grip" cx="${x}" cy="${y}" r="${radius}"/>
        <circle class="mech-knob-cap" cx="${x}" cy="${y}" r="${radius - 4}"/>
        <path class="mech-knob-needle" d="M${x} ${y - radius + 2}v7" transform="rotate(${angle} ${x} ${y})"/>`,
      { axis: 'dial', pixelsPerUnit: 145 / (field.max - field.min) });
      steps(key, x, y + radius + 5, 62);
      return engraving(x, y - radius - 11, label, 'mech-engraving')
        + engraving(x, y + radius + 22, format.format(experiment.values[key]), 'mech-setting');
    },
  };
}

export type HardwareDrawing = ReturnType<typeof hardwareDrawing>;

export function updateHardware(layer: SVGGElement, items: Hardware[], mode: Mode, experiment: Experiment) {
  // The focusable groups stay mounted while their readings and hit areas move.
  items.forEach((item, index) => {
    let group = layer.children[index] as SVGGElement | undefined;
    if (!group) {
      group = document.createElementNS(svgNS, 'g');
      layer.append(group);
    }
    const slider = !!item.travel;
    group.dataset.mechId = item.id;
    group.setAttribute('role', slider ? 'slider' : 'button');
    group.setAttribute('tabindex', item.disabled ? '-1' : '0');
    group.setAttribute('aria-disabled', String(item.disabled));
    group.setAttribute('aria-label', item.label);
    group.classList.toggle('mech-slider', slider);
    if (item.action?.pressed !== undefined) group.setAttribute('aria-pressed', String(item.action.pressed));
    if (item.travel && item.field) {
      const value = experiment.values[item.field.key];
      group.setAttribute('aria-valuemin', String(controlMinimum(mode, experiment, item.field)));
      group.setAttribute('aria-valuemax', String(item.field.max));
      group.setAttribute('aria-valuenow', String(value));
      group.setAttribute('aria-valuetext', `${format.format(value)} ${item.field.unit}`.trim());
      group.setAttribute('aria-orientation', item.travel.axis === 'y' ? 'vertical' : 'horizontal');
    }
    if (currentDrawings.get(group) !== item.markup) {
      group.innerHTML = item.markup;
      currentDrawings.set(group, item.markup);
    }
  });
}

export function bindHardware(
  svg: SVGSVGElement,
  options: AddEventListenerOptions,
  getItem: (id: string) => Hardware | undefined,
  getExperiment: () => Experiment,
  mode: Mode,
  change: (field: Control, value: number) => void,
  act: (key: string) => void,
) {
  type Drag = { id: number; item: Hardware; x: number; y: number; value: number };
  let drag: Drag | undefined;
  const groupFor = (event: Event) => (event.target as Element).closest<SVGGElement>('[data-mech-id]');
  const point = (event: PointerEvent) => new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM()!.inverse());

  function activate(item: Hardware) {
    if (item.action) act(item.action.key);
    if (item.field && item.direction) change(item.field, getExperiment().values[item.field.key] + item.direction * item.field.step);
  }

  svg.addEventListener('click', event => {
    const group = groupFor(event);
    const item = group && getItem(group.dataset.mechId!);
    if (item && !item.disabled && !item.travel) {
      group.focus({ preventScroll: true });
      activate(item);
    }
  }, options);

  svg.addEventListener('keydown', event => {
    const group = groupFor(event);
    const item = group && getItem(group.dataset.mechId!);
    if (!item || item.disabled) return;
    if (!item.travel && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      activate(item);
    }
    if (!item.travel || !item.field) return;
    const directions: Record<string, number> = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 };
    const direction = directions[event.key];
    const { field } = item;
    const experiment = getExperiment();
    if (direction === undefined && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    change(field, event.key === 'Home' ? controlMinimum(mode, experiment, field) :
      event.key === 'End' ? field.max : experiment.values[field.key] + direction * field.step);
  }, options);

  svg.addEventListener('pointerdown', event => {
    const group = groupFor(event);
    const item = group && getItem(group.dataset.mechId!);
    if (drag || event.button !== 0 || !group || !item?.travel || !item.field || item.disabled) return;
    event.preventDefault();
    group.focus({ preventScroll: true });
    const { x, y } = point(event);
    drag = { id: event.pointerId, item, x, y, value: getExperiment().values[item.field.key] };
    svg.setPointerCapture(event.pointerId);
  }, options);
  svg.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const { x, y } = point(event);
    const { axis, pixelsPerUnit } = drag.item.travel!;
    const delta = axis === 'x' ? x - drag.x : axis === 'y' ? y - drag.y : x - drag.x + drag.y - y;
    change(drag.item.field!, drag.value + delta / pixelsPerUnit);
  }, options);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    svg.addEventListener(type, event => {
      if (event.pointerId === drag?.id) drag = undefined;
    }, options);
  }
}
