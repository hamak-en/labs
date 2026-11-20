import {
  airSpeed, ambientTemperature, atmosphere, benzenePressure, caliperJaw, cylinder, cylinderMeasurement, deformation, flywheelDiameters, flywheelShaftPoint, fork, hangingMass,
  hydrogen, hydrogenReadings, phaseShift, plateDimensions, plateLoadPosition, plateProfile, psychrometerFanRunning, psychrometerWind, resonance, roundReading, specimenSize, steelWire, stokesMotion, stokesReferenceDiameter,
  stopwatchPrecision, stopwatchReading, tank, wheelMass, wheelMotion,
} from './model';
import type { Experiment, Mode, ModeKey } from './model';
import { hardwareDrawing, updateHardware } from './hardware';
import type { HardwareDrawing } from './hardware';

const integer = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0, useGrouping: false });
const decimals = [1, 2, 3].map(digits => new Intl.NumberFormat('uk-UA', { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false }));
export const display = (value: number, digits = 0) => (decimals[digits - 1] ?? integer).format(value);

const ink = '#385346';
const green = '#648875';
const muted = '#577465';
const aqua = '#6baaaa';
const blue = '#3a747b';
const brass = '#a67949';
const glass = '#edf5ef';
const edge = '#62776e';

const text = (x: number, y: number, value: string, kind = 'label', anchor = 'start') =>
  `<text x="${x}" y="${y}" class="mechanics-${kind}" text-anchor="${anchor}">${value}</text>`;
const line = (x1: number, y1: number, x2: number, y2: number, color = edge, width = 1) =>
  `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${width}" />`;
const rectangle = (x: number, y: number, width: number, height: number, fill = glass, stroke = edge, radius = 5) =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" stroke="${stroke}"/>`;
const circle = (x: number, y: number, r: number, fill = glass, stroke = edge) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}"/>`;
const path = (d: string, stroke = edge, width = 2, fill = 'none') =>
  `<path d="${d}" stroke="${stroke}" fill="${fill}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const terminal = (x: number, y: number, color = ink) => circle(x, y, 5, color, '#eef2e7');
const repeat = (count: number, item: (index: number) => string) => Array.from({ length: count }, (_, i) => item(i)).join('');

function plate(x: number, y: number, w: number, label: string, value: string, unit = '', height = 113) {
  return casework(x, y, w, height) + text(x + 14, y + 25, label, 'instrument')
    + rectangle(x + 12, y + 38, w - 24, 54, '#445c50', '#3a5046', 7)
    + rectangle(x + 16, y + 42, w - 32, 45, 'url(#mech-lcd)', '#89a394', 4)
    + line(x + 19, y + 44, x + w - 19, y + 44, '#c5e3ca')
    + text(x + w / 2, y + 73, unit ? `${value} ${unit}` : value, 'reading', 'middle');
}

function compactReadout(x: number, y: number, width: number, label: string, value: string) {
  return `<g class="mechanics-compact-readout">${casework(x, y, width, 70)}
    ${text(x + width / 2, y + 23, label, 'instrument', 'middle')}
    ${rectangle(x + 7, y + 30, width - 14, 33, '#445c50', '#3a5046', 5)}
    ${rectangle(x + 10, y + 33, width - 20, 27, 'url(#mech-lcd)', '#89a394', 3)}
    ${text(x + width / 2, y + 51, value, 'reading', 'middle')}</g>`;
}

function scale(x: number, top: number, height: number, maximum: number, spacing: number, direction = -1) {
  const count = Math.floor(maximum / spacing);
  return line(x, top, x, top + height) + repeat(count + 1, tick => {
    const y = top + (direction === -1 ? height * (1 - tick / count) : height * tick / count);
    return line(x, y, x - 7, y, edge)
      + text(x - 12, y + 4, display(tick * spacing), 'tick', 'end');
  });
}

const screw = (x: number, y: number) => circle(x, y, 3.2, '#abb8a8', '#51695b') + line(x - 1.7, y + 1.7, x + 1.7, y - 1.7, '#60746a');
const feet = (x: number, y: number, width: number) => rectangle(x + 13, y, 26, 7, '#40584e', '#40584e', 2)
  + rectangle(x + width - 39, y, 26, 7, '#40584e', '#40584e', 2);
const shadow = (x: number, y: number, rx: number) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="12" fill="url(#mech-shadow)"/>`;

function casework(x: number, y: number, w: number, h: number) {
  return shadow(x + w / 2, y + h + 5, w / 2 + 10) + feet(x, y + h, w)
    + rectangle(x, y, w, h, 'url(#mech-case)', '#53695e', 9)
    + rectangle(x + 3, y + 3, w - 6, h - 6, 'none', '#e3e9d9', 7)
    + screw(x + 8, y + h - 9) + screw(x + w - 8, y + h - 9);
}

function surface(y = 416) {
  return line(46, y, 754, y, '#9cae9f');
}

function status(value: string, y = 503) {
  return text(42, y, value, 'status');
}

function cylinderBetweenJaws(left: number, gaugeY: number, pitch: number, measurement: ReturnType<typeof cylinderMeasurement>) {
  const { height, position, size } = measurement;
  const span = size * pitch;
  const right = left + span;
  const topRadius = cylinder.diameterAt(0) * pitch / 2;
  const bottomRadius = cylinder.diameterAt(1) * pitch / 2;
  const taperStart = cylinder.length * cylinder.diameterPositions.start * pitch;
  const taperEnd = cylinder.length * cylinder.diameterPositions.end * pitch;
  const baseLeft = cylinder.heightAt(0) * pitch;
  const baseRight = cylinder.heightAt(1) * pitch;
  const sectionX = (2 * position - 1) * bottomRadius;
  const sectionY = position * cylinder.length * pitch;
  const orientation = height
    ? `translate(${left} ${gaugeY + sectionX}) rotate(-90)`
    : `translate(${left + span / 2} ${gaugeY - sectionY})`;
  const bottom = height ? gaugeY + sectionX + topRadius : gaugeY - sectionY + baseRight;
  const body = path(`M${-topRadius} 0 H${topRadius} V${taperStart} L${bottomRadius} ${taperEnd}
    V${baseRight} L${-bottomRadius} ${baseLeft} V${taperEnd} L${-topRadius} ${taperStart} Z`, green, 1.4, 'url(#mech-cylinder)')
    + path(`M${-topRadius} 0 Q0 28 ${topRadius} 0 Z`, green, 1, '#c9dbcc')
    + path(`M${-bottomRadius} ${baseLeft - 9} Q0 ${(baseLeft + baseRight) / 2 + 7} ${bottomRadius} ${baseRight - 9}`, green, .8);
  return `<g data-caliper-specimen="${height ? 'height' : 'diameter'}">
    ${shadow(left + span / 2, bottom + 2, span / 2 + 15)}
    <g class="mechanics-cylinder-body" transform="${orientation}">${body}</g>
    <g class="mechanics-caliper-span">
      <path d="M${left} ${gaugeY}H${right}" stroke="${blue}" stroke-width="1.5" stroke-dasharray="4 3"/>
      ${circle(left, gaugeY, 2.5, blue, '#eff4e4')}${circle(right, gaugeY, 2.5, blue, '#eff4e4')}
    </g>
  </g>`;
}

function caliperVernier(x: number, y: number, pitch: number, enlarged = false) {
  const divisions = 10;
  const vernierPitch = pitch * (divisions - 1) / divisions;
  return line(x, y, x + divisions * vernierPitch, y, blue)
    + repeat(divisions + 1, i => {
      const mark = x + vernierPitch * i;
      const major = i % 5 === 0;
      const markHeight = enlarged ? (major ? 20 : 13) : (major ? 11 : 7);
      return line(mark, y, mark, y + markHeight, blue)
        + (enlarged || (major && i > 0) ? text(mark, y + (enlarged ? 36 : 24), display(i), enlarged ? 'tick' : 'engraved', 'middle') : '');
    });
}

function caliper(e: Experiment, hw: HardwareDrawing) {
  const zero = 162, pitch = 4.6, beamY = 113, gaugeY = 260, jawTip = gaugeY + 7;
  const jaw = e.values.jaw;
  const measurement = cylinderMeasurement(e);
  const size = roundReading(measurement.size, caliperJaw.step);
  const moving = zero + pitch * jaw;
  const near = Math.floor(jaw);
  const zoomX = 245 + (jaw - near) * 28;
  const contact = Math.abs(jaw - size) < caliperJaw.step / 2;
  hw.button('diameter', [535, 63, 92, 30], 'Діаметр');
  hw.button('height', [636, 63, 92, 30], 'Висота');
  hw.grip('jaw', [moving + 62, 151, 45, 31], { axis: 'x', pixelsPerUnit: pitch }, [moving + 86, 166]);
  const point = hw.index('point', 101, 307, 'ТОЧКА ЗАМІРУ');
  return text(42, 52, 'ШТАНГЕНЦИРКУЛЬ', 'instrument')
    + rectangle(125, beamY, 467, 41, 'url(#mech-metal)', edge)
    + path(`M125 ${beamY + 1} H${zero} V154 H${zero - 3} V${gaugeY - 4} H${zero}
      V${jawTip} H137 L125 ${jawTip - 35} Z`, edge, 2, 'url(#mech-metal)')
    + repeat(caliperJaw.max + 1, i => {
      const x = zero + pitch * i;
      const major = i % 5 === 0;
      return line(x, beamY + 16, x, beamY + (major ? 29 : 23), muted)
        + (major && i > 0 ? text(x, beamY + 11, display(i), 'engraved', 'middle') : '');
    })
    + text(zero + pitch * caliperJaw.max + 15, beamY + 11, 'мм', 'engraved')
    + path(`M${moving} 144 h112 v50 h-86 V${jawTip} H${moving} V${gaugeY - 4} H${moving + 3} V180 H${moving} Z`, edge, 2, 'url(#mech-metal)')
    + rectangle(moving + 63, 153, 43, 28, 'url(#mech-case)', '#6a7d70', 4)
    + caliperVernier(moving, 156, pitch)
    + cylinderBetweenJaws(zero, gaugeY, pitch, measurement)
    + point
    + rectangle(104, 381, 588, 116, '#f0f4e9', '#9eb19d')
    + text(124, 404, 'ЗБІЛЬШЕНА ШКАЛА', 'instrument')
    + line(125, 445, 668, 445, edge)
    + repeat(19, i => {
      const x = 133 + 28 * i;
      const value = near - 4 + i;
      return value < 0 || value > caliperJaw.max ? '' : line(x, 445, x, 427, ink) + text(x, 421, display(value), 'tick', 'middle');
    })
    + caliperVernier(zoomX, 455, 28, true)
    + text(660, 491, 'мм', 'tick', 'end')
    + status(contact ? 'Губки торкаються зразка. Зніми відлік зі шкал.' : 'Пересунь рухому губку до дотику з циліндром.', 514);
}

function ballOrientationMark(x: number, y: number, radius: number, point: number, className: string) {
  const rotation = (point - 1) * 36;
  const marking = `M${x - radius * .22} ${y - radius * .7} Q${x} ${y - radius * .82} ${x + radius * .22} ${y - radius * .7}`;
  const width = Math.max(1.8, radius * .07);
  return `<g class="${className}" transform="rotate(${rotation} ${x} ${y})">
    ${path(marking, '#f5dba0', width + 1.5)}${path(marking, '#64482c', width)}
  </g>`;
}

function micrometer(e: Experiment, hw: HardwareDrawing) {
  const jaw = e.values.jaw;
  const size = specimenSize('sphere', e);
  const contact = Math.abs(jaw - roundReading(size, .01)) < .0051;
  const spindle = 234 + Math.max(size, jaw) * 7;
  const drum = Math.round(jaw * 100) % 50;
  const main = Math.floor(Math.round(jaw * 100) / 50) / 2;
  const indexX = 270;
  const radius = 3.5 * size;
  const centerX = 234 + radius, centerY = 189;
  hw.grip('jaw', [613, 149, 87, 80], { axis: 'dial', pixelsPerUnit: 13 }, [655, 189]);
  hw.steps('jaw', 655, 247, 74);
  hw.object('contact', [700, 154, 44, 72], [721, 188]);
  const specimenPosition = hw.index('point', 570, 303, 'МІСЦЕ ВІДЛІКУ');
  return text(42, 52, 'МІКРОМЕТР', 'instrument') + text(42, 100, 'Вимірювання діаметра кулі')
    + shadow(384, 314, 327)
    + path('M234 172 H171 C54 172 58 316 161 316 H399 C482 316 507 278 507 221 V172 H478 V226 Q475 278 398 278 H170 C106 278 109 207 174 207 H234 Z', '#476556', 3, 'url(#mech-enamel)')
    + rectangle(199, 169, 35, 40, 'url(#mech-metal)')
    + circle(centerX, centerY, radius, 'url(#mech-ball)', brass)
    + ballOrientationMark(centerX, centerY, radius, e.values.point, 'mechanics-sphere-orientation')
    + rectangle(spindle, 172, 489 - spindle, 32, 'url(#mech-metal)')
    + rectangle(489, 158, 125, 62, 'url(#mech-metal)')
    + rectangle(613, 149, 87, 80, '#7c9781', green)
    + repeat(7, i => line(620 + i * 11, 154, 620 + i * 11, 224, '#40594e'))
    + rectangle(700, 162, 39, 54, 'url(#mech-brass)', '#7f623e')
    + repeat(4, i => line(706 + i * 9, 166, 706 + i * 9, 212, '#88683e'))
    + text(721, 241, 'Тріскачка', 'tick', 'middle') + text(655, 263, 'ГВИНТ', 'tick', 'middle') + specimenPosition
    + rectangle(104, 350, 588, 108, '#f0f4e9', '#9eb19d')
    + text(120, 375, 'СТЕБЛО · півміліметри', 'instrument') + text(424, 375, 'БАРАБАН · соті', 'instrument')
    + line(125, 415, 380, 415, ink) + line(indexX + 55, 387, indexX + 55, 443, green, 2)
    + repeat(9, i => {
      const value = main + (i - 5) / 2, x = 185 + 28 * i;
      if (i > 5 || value < 0) return '';
      return value % 1 === 0 ? line(x, 416, x, 396, ink) + text(x, 391, display(value), 'tick', 'middle')
        : line(x, 416, x, 431, ink);
    })
    + line(430, 411, 668, 411, edge)
    + repeat(11, i => {
      const tick = (drum + i - 5 + 50) % 50, x = 438 + 20 * i;
      return line(x, 411, x, tick % 5 === 0 ? 430 : 423, blue) + (tick % 5 === 0 ? text(x, 445, display(tick), 'tick', 'middle') : '');
    })
    + path('M538 399 l-5 -7 h10 Z', brass, 1, brass)
    + status(contact ? 'Гвинт торкається кулі. Зніми відлік зі стебла й барабана.' : 'Підведи гвинт до кулі. Тріскачка обмежує натиск.');
}

function dial(x: number, y: number, reading: number, maximum: number) {
  const angle = -.75 * Math.PI + (Math.min(reading, maximum) / maximum) * 1.5 * Math.PI;
  return shadow(x, y + 59, 57) + circle(x, y, 64, 'url(#mech-metal)', '#51695b')
    + circle(x, y, 58, '#556d60', '#344e42') + circle(x, y, 54, 'url(#mech-scale)', '#a6b4a4')
    + line(x, y, x + Math.sin(angle) * 45, y - Math.cos(angle) * 45, brass, 2.5)
    + repeat(21, index => {
      const t = -.75 * Math.PI + index * 1.5 * Math.PI / 20;
      const major = index % 5 === 0;
      const r = major ? 44 : 47;
      const labelRadius = 29;
      return line(x + Math.sin(t) * r, y - Math.cos(t) * r, x + Math.sin(t) * 50, y - Math.cos(t) * 50, ink)
        + (major ? text(x + Math.sin(t) * labelRadius, y - Math.cos(t) * labelRadius, display(index * maximum / 20, 2), 'dial-tick', 'middle') : '');
    }) + circle(x, y, 4, green, green);
}

function bentPlateDrawing(e: Experiment) {
  const left = 147, span = 301, top = 327, deflectionScale = 12;
  function pointAt(position: number) {
    const { deflection, slope } = plateProfile(e, position);
    return { x: left + span * position, y: top + deflectionScale * deflection, slope: deflectionScale * slope / span };
  }
  function segment(from: ReturnType<typeof pointAt>, to: ReturnType<typeof pointAt>) {
    const dx = (to.x - from.x) / 3;
    return `C${from.x + dx} ${from.y + from.slope * dx} ${to.x - dx} ${to.y - to.slope * dx} ${to.x} ${to.y}`;
  }
  const start = pointAt(0), end = pointAt(1);
  const load = pointAt(plateLoadPosition(e));
  const mid = pointAt(.5);
  const mark = pointAt(e.values.point / 6);
  const curve = `M124 ${start.y + start.slope * (124 - start.x)} L${start.x} ${start.y}
    ${segment(start, load)} ${segment(load, end)} L474 ${end.y + end.slope * (474 - end.x)}`;
  return {
    span, load,
    body: `<g class="mechanics-bent-plate">${path(curve, ink, 6)}</g>`,
    mark: `<g class="mechanics-plate-point">${line(mark.x, mark.y - 12, mark.x, mark.y - 3, blue, 1.5)}${circle(mark.x, mark.y - 12, 4.5, blue, '#eff4e4')}</g>`,
    probe: path(`M365 245 V274 H${mid.x + 16} V${mid.y - 16} L${mid.x} ${mid.y - 3}`, green, 2),
  };
}

function elastic(mode: 'stretch' | 'bend', e: Experiment, hw: HardwareDrawing) {
  const stretch = mode === 'stretch';
  const deflection = deformation(mode, e);
  const reading = Math.max(0, deflection + .03 - e.offset);
  const mass = e.values.load;
  const bendLoaded = !stretch && mass > 0;
  const zeroInstruction = bendLoaded ? 'Зніми тягарці, щоб установити нуль індикатора.' : 'Встанови нуль індикатора без тягарів.';
  const measurementInstruction = bendLoaded ? 'Запиши прогин для цього навантаження.' : 'Індикатор обнулено без навантаження.';
  const wireTop = 134, wireBottom = 314 + deflection * 35;
  const wirePoint = wireTop + (wireBottom - wireTop) * e.values.point / 6;
  const bentPlate = stretch ? undefined : bentPlateDrawing(e);
  const body = bentPlate
    ? rectangle(98, 399, 390, 17, 'url(#mech-metal)') + path('M122 398 l25 -67 l25 67 Z', green, 2, '#bdc9b6')
      + path('M423 398 l25 -67 l25 67 Z', green, 2, '#bdc9b6')
      + bentPlate.body
      + line(bentPlate.load.x, 299, bentPlate.load.x, bentPlate.load.y + 4, brass, 3)
      + rectangle(bentPlate.load.x - 14.5, 293, 29, 15, 'url(#mech-brass)', '#89683d', 3)
    : rectangle(99, 84, 330, 23, 'url(#mech-metal)') + rectangle(140, 107, 18, 309, '#98ae99')
      + rectangle(205, 115, 36, 19, '#6f8f78') + line(223, wireTop, 223, wireBottom, ink, 3)
      + `<g class="mechanics-wire-point">${circle(223, wirePoint, 5, blue, '#eff4e4')}</g>`
      + rectangle(202, wireBottom, 42, 12, brass);
  const weightsX = bentPlate ? bentPlate.load.x - 24 : 199;
  const weightsY = bentPlate ? bentPlate.load.y + 4 : wireBottom + 13;
  const weightPitch = stretch ? 10 : 5;
  const trayHeight = stretch ? 10 : 4;
  const indicatorX = 535, indicatorWidth = 213, zeroWidth = 86;
  const indicatorCenter = indicatorX + indicatorWidth / 2;
  hw.button('zero', [indicatorCenter - zeroWidth / 2, 217, zeroWidth, 26], 'На нуль');
  const point = hw.index('point', indicatorCenter, 453, stretch ? 'ТОЧКА ЗАМІРУ ДІАМЕТРА' : 'ПЕРЕРІЗ ПЛАСТИНИ');
  const load = hw.readout('load', 168, 448, 'МАСА, КГ');
  const offset = stretch ? '' : hw.readout('offset', 361, 448, 'ЗСУВ, ММ');
  const { span, width, thickness } = plateDimensions(e);
  if (bentPlate) hw.grip('offset', [bentPlate.load.x - 16, 287, 32, 32], { axis: 'x', pixelsPerUnit: bentPlate.span / span }, [bentPlate.load.x, 302]);
  const dimensions = stretch
    ? compactReadout(535, 260, 213, 'Діаметр дроту', `${display(specimenSize('stretch', e), 2)} мм`)
      + compactReadout(535, 340, 213, 'Початкова довжина', `${display(steelWire.length)} мм`)
    : compactReadout(535, 260, 101, 'Ширина', `${display(width, 1)} мм`)
      + compactReadout(647, 260, 101, 'Товщина', `${display(thickness, 1)} мм`)
      + compactReadout(535, 340, 213, 'Відстань між опорами', `${display(span, 1)} мм`);
  return text(42, 52, stretch ? 'РОЗТЯГ ДРОТУ' : 'ЗГИН ПЛАСТИНИ', 'instrument') + shadow(291, 417, 222) + body + point + load + offset
    + (bentPlate ? text(bentPlate.load.x, 266, 'Підвіс', 'tick', 'middle') : '')
    + rectangle(weightsX, weightsY, 48, trayHeight, 'url(#mech-brass)', '#846c49', 2)
    + repeat(Math.round(mass * 2), i => rectangle(weightsX, weightsY + (stretch ? 0 : trayHeight) + i * weightPitch, 48, weightPitch - 1, 'url(#mech-brass)', '#846c49', 2))
    + dial(393, stretch ? 263 : 189, reading, stretch ? 2 : 4)
    + (bentPlate?.probe ?? path(`M342 268 H295 V${wireBottom + 1} H246`, green, 2))
    + (bentPlate?.mark ?? '') + surface(418)
    + plate(indicatorX, 120, indicatorWidth, stretch ? 'Індикатор' : 'Прогин посередині', display(reading, 2), 'мм', 128)
    + dimensions
    + status(e.offset ? measurementInstruction : zeroInstruction);
}

function flywheelShaftView(point: number) {
  const x = 82, y = 83, width = 142;
  const { min, max } = flywheelShaftPoint;
  const sectionX = (site: number) => x + 16 + (width - 32) * (site - min) / (max - min);
  const selectedX = sectionX(point);
  return text(x + width / 2, 66, 'Вал збоку', 'tick', 'middle')
    + rectangle(x, y - 8, width, 16, 'url(#mech-metal)', edge, 3)
    + rectangle(x - 7, y - 5, 8, 10, 'url(#mech-metal)', edge, 2)
    + rectangle(x + width - 1, y - 10, 8, 20, 'url(#mech-metal)', edge, 2)
    + repeat(max - min + 1, i => line(sectionX(min + i), y - 6, sectionX(min + i), y + 6, muted))
    + `<g class="mechanics-shaft-point">
      ${line(selectedX, y - 8, selectedX, y + 8, blue, 2.5)}
      ${circle(selectedX, y - 8, 2.8, blue, '#eff4e4')}${circle(selectedX, y + 8, 2.8, blue, '#eff4e4')}
    </g>`;
}

function flywheel(e: Experiment, hw: HardwareDrawing) {
  const motion = wheelMotion(e);
  const y = 419 - motion.height * 3.7;
  const angle = motion.angle * 180 / Math.PI;
  const diameters = flywheelDiameters(e);
  hw.button('timer', [538, 160, 64, 25], e.timer ? 'Стоп' : 'Старт');
  hw.button('reset-time', [607, 160, 56, 25], 'Нуль');
  hw.button('record-time', [668, 160, 66, 25], 'Запис');
  hw.button('wheel', [170, 371, 160, 31], e.attached ? 'Зняти колесо' : 'Поставити колесо');
  hw.button('prepare', [383, 448, 136, 31], 'Намотати нитку');
  hw.button('release', [530, 448, 212, 31], 'Відпустити тягарець');
  hw.grip('height', [401, y - 8, 39, 33], { axis: 'y', pixelsPerUnit: -3.7 }, [420, y + 9]);
  hw.steps('height', 631, 421, 90);
  const point = hw.index('point', 291, 65, 'ТОЧКА ЗАМІРУ');
  return text(42, 52, 'МАХОВЕ КОЛЕСО', 'instrument')
    + flywheelShaftView(e.values.point)
    + shadow(274, 420, 188) + rectangle(92, 105, 352, 26, 'url(#mech-metal)') + rectangle(116, 133, 16, 287, '#acbea9')
    + rectangle(286, 132, 10, 111, '#a1b6a0')
    + (e.attached ? `<g transform="rotate(${angle} 291 237)">${circle(291, 237, 109, 'url(#mech-enamel)', '#425e50')}
      ${circle(291, 237, 94, 'none', '#d2ddc8')}
      ${circle(291, 237, 68, 'url(#mech-case)', '#456356')}${repeat(6, i => {
        const a = i * Math.PI / 3;
        return line(291 + 22 * Math.cos(a), 237 + 22 * Math.sin(a), 291 + 94 * Math.cos(a), 237 + 94 * Math.sin(a), green, 5);
      })}</g>` : '')
    + circle(291, 237, 21, '#94ab97', green) + circle(291, 237, 8, ink, green)
    + circle(420, 126, 9, '#9bb19e', green)
    + path(`M312 237 V132 Q312 117 327 117 H412 Q420 117 420 127 V${y}`, ink, 1.5)
    + rectangle(407, y, 26, 19, '#b49362', brass)
    + scale(483, 123, 296, 80, 10) + text(487, 112, 'см', 'tick')
    + line(434, y, 470, y, brass, 2)
    + plate(530, 64, 212, 'Секундомір', display(stopwatchReading('flywheel', e), stopwatchPrecision.flywheel), 'с', 126)
    + compactReadout(530, 201, 101, 'Діаметр вала', `${display(diameters.shaft, 1)} мм`)
    + compactReadout(641, 201, 101, 'Висота тягарця', `${display(motion.height, 1)} см`)
    + compactReadout(530, 285, 101, 'Зовн. діаметр', e.attached ? `${display(diameters.outer, 1)} мм` : '—')
    + compactReadout(641, 285, 101, 'Внутр. діаметр', e.attached ? `${display(diameters.inner, 1)} мм` : '—')
    + point + text(631, 437, 'ВИСОТА', 'tick', 'middle')
    + text(78, 458, `Тягарець ${display(hangingMass, 2)} кг · колесо ${display(wheelMass, 1)} кг`, 'label')
    + status(e.stage === 'done' ? 'Рух завершився. Відчитай висоту підйому.' : e.stage === 'moving' ? 'Тягарець рухається. Стеж за нижньою точкою.' : 'Нитка намотана. Тягарець готовий до спуску.');
}

function stokesMicrometer(radius: number, point: number) {
  const leftContact = 542, centerY = 114;
  const centerX = leftContact + radius;
  const screwTip = centerX + radius;
  return casework(450, 38, 300, 181)
    + text(464, 60, 'МІКРОМЕТР · ЗБІЛЬШЕНИЙ ВИГЛЯД', 'instrument')
    + shadow(604, 162, 117)
    + path('M527 98 H513 C472 98 472 160 509 160 H643 Q680 160 680 127 V99 H663 V126 Q663 144 640 144 H510 C491 144 490 113 513 113 H527 Z',
      '#476556', 2, 'url(#mech-enamel)')
    + rectangle(509, centerY - 11, leftContact - 509, 22, 'url(#mech-metal)', edge, 4)
    + rectangle(screwTip, centerY - 10, 649 - screwTip, 20, 'url(#mech-metal)', edge, 3)
    + rectangle(641, centerY - 15, 34, 30, 'url(#mech-metal)')
    + rectangle(670, centerY - 19, 44, 38, '#789282', '#53695e', 4)
    + repeat(5, i => line(678 + i * 7, centerY - 15, 678 + i * 7, centerY + 15, '#40594e'))
    + rectangle(713, centerY - 13, 14, 26, 'url(#mech-brass)', '#7f623e', 3)
    + text(518, 87, 'Нерухома п’ята', 'tick', 'middle')
    + text(649, 87, 'Рухомий гвинт', 'tick', 'middle')
    + circle(centerX, centerY, radius, 'url(#mech-ball)', brass)
    + ballOrientationMark(centerX, centerY, radius, point, 'mechanics-stokes-orientation')
    + `<path d="M${leftContact} ${centerY}H${screwTip}" fill="none" stroke="#fff2cf" stroke-width="1.5" stroke-dasharray="3 3"/>`
    + circle(leftContact, centerY, 2.6, '#f4e4ad', '#735635')
    + circle(screwTip, centerY, 2.6, '#f4e4ad', '#735635');
}

function sedimentation(e: Experiment, hw: HardwareDrawing) {
  const tubeX = 172, tubeWidth = 159;
  const tubeCenter = tubeX + tubeWidth / 2;
  const tubeDiameter = tank.radius * 20;
  const liquidWidth = tubeWidth - 12;
  const liquidTop = 113, liquidBottom = 430;
  const releaseButtonWidth = 122;
  const { depth, diameter } = stokesMotion(e);
  const picturedDiameter = stokesReferenceDiameter + 3 * (diameter - stokesReferenceDiameter);
  const ballRadius = 1.8 * (liquidWidth * picturedDiameter / tubeDiameter / 2);
  const measuredDiameter = roundReading(specimenSize('stokes', e), .01);
  const micrometerRadius = 5 * (picturedDiameter + (measuredDiameter - diameter));
  const y = liquidTop + depth * 10.4;
  const ballY = e.stage === 'ready' ? 93 : y;
  const ready = e.stage === 'ready';
  hw.button(ready ? 'release' : 'prepare', [tubeCenter - releaseButtonWidth / 2, 446, releaseButtonWidth, 30],
    ready ? 'Опустити кульку' : 'Вийняти кульку');
  hw.button('timer', [463, 333, 86, 26], e.timer ? 'Стоп' : 'Старт');
  hw.button('reset-time', [557, 333, 86, 26], 'Нуль');
  hw.button('record-time', [651, 333, 86, 26], 'Запис');
  const sample = hw.index('ball', 525, 185, 'КУЛЬКА №');
  const point = hw.index('point', 674, 185, 'ТОЧКА ЗАМІРУ');
  return text(42, 52, 'СКЛЯНА КУЛЬКА В ГЛІЦЕРИНІ', 'instrument')
    + shadow(tubeCenter, liquidBottom + 5, 105)
    + rectangle(tubeX, 86, tubeWidth, liquidBottom + 7 - 86, 'url(#mech-glass)', '#77928b', 14)
    + rectangle(178, liquidTop, liquidWidth, liquidBottom - liquidTop, 'url(#mech-fluid)', '#a3bb96', 8) + line(184, 121, 184, 388, '#f4faec', 3)
    + repeat(2, i => {
      const markY = liquidTop + (i === 0 ? tank.top : tank.bottom) * 10.4;
      return line(162, markY, 343, markY, brass, 2) + text(154, markY + 4, i === 0 ? 'Верхня мітка' : 'Нижня мітка', 'label', 'end');
    })
    + `<g class="mechanics-stokes-ball">${circle(tubeCenter, ballY, ballRadius, 'url(#mech-ball)', brass)}
      ${circle(tubeCenter, ballY, 3, '#263b31', '#fbf0cc')}</g>`
    + scale(378, liquidTop, 312, 30, 5, 1) + text(388, 102, 'см', 'tick')
    + surface(liquidBottom + 8)
    + stokesMicrometer(micrometerRadius, e.values.point) + sample + point
    + plate(450, 234, 300, 'Секундомір', display(stopwatchReading('stokes', e), stopwatchPrecision.stokes), 'с', 131)
    + compactReadout(450, 379, 96, 'Діаметр кульки', `${display(measuredDiameter, 2)} мм`)
    + compactReadout(552, 379, 96, 'Діаметр колби', `${display(tubeDiameter, 1)} мм`)
    + compactReadout(654, 379, 96, 'Між мітками', `${display(tank.bottom - tank.top, 1)} см`)
    + status(e.stage === 'done' ? 'Кулька опустилася на дно.' : e.stage === 'moving' ? 'Знімай час, коли точка в центрі перетинає мітку.' : 'Кулька готова до спуску.');
}

function phase(e: Experiment, hw: HardwareDrawing) {
  const ready = e.scope && e.generator && e.warm === 1 && e.generatorWarm === 1;
  const active = ready && e.values.amplitude > 0;
  const shift = phaseShift(e);
  const amplitude = 16 + e.values.amplitude * 20;
  const points = active ? repeat(161, i => {
    const t = i * Math.PI / 80;
    const x = 523 + Math.cos(t) * amplitude;
    const y = 183 - Math.cos(t - shift) * amplitude * e.values.gain * (e.obstacle ? .36 : .78);
    return `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)} `;
  }) : '';
  const xSpeaker = 89 + 6.2 * e.values.speaker;
  const xMic = 89 + 6.2 * e.values.microphone;
  hw.button('generator', [173, 98, 86, 22], e.generator ? 'Увімкнено' : 'Живлення');
  hw.button('scope', [626, 83, 89, 22], e.scope ? 'Увімкнено' : 'Живлення');
  hw.button('obstacle', [610, 363, 124, 29], e.obstacle ? 'Прибрати екран' : 'Поставити екран');
  hw.grip('speaker', [xSpeaker - 25, 369, 37, 41], { axis: 'x', pixelsPerUnit: 6.2 }, [xSpeaker - 10, 393]);
  hw.grip('microphone', [xMic - 11, 356, 26, 54], { axis: 'x', pixelsPerUnit: 6.2 }, [xMic + 2, 379]);
  hw.steps('speaker', 198, 470, 54);
  hw.steps('microphone', 530, 470, 54);
  const dials = hw.knob('frequency', 120, 221, 'ЧАСТОТА', 15)
    + hw.knob('amplitude', 220, 221, 'ВИХІД', 15)
    + hw.knob('gain', 442, 284, 'ПІДСИЛЕННЯ Y', 13) + hw.knob('focus', 534, 284, 'ФОКУС', 13)
    + hw.knob('brightness', 626, 284, 'ЯСКРАВІСТЬ', 13);
  return text(42, 51, 'ЗСУВ ФАЗ · РЕЖИМ XY', 'instrument')
    + casework(65, 87, 209, 193) + text(79, 114, 'ГЕНЕРАТОР', 'instrument')
    + rectangle(80, 127, 176, 57, '#435c50', '#385448', 6)
    + rectangle(84, 131, 168, 48, 'url(#mech-lcd)', '#8ba899', 4)
    + text(168, 165, e.generator && e.generatorWarm === 1 ? `${display(e.values.frequency)} Гц` : '—', 'reading', 'middle')
    + terminal(116, 280) + terminal(220, 280)
    + casework(388, 75, 338, 260) + text(403, 99, 'ОСЦИЛОГРАФ', 'instrument')
    + rectangle(401, 111, 244, 136, '#213e35', green, 9)
    + `<defs><clipPath id="mech-scope"><rect x="404" y="114" width="238" height="130" rx="6"/></clipPath></defs><g clip-path="url(#mech-scope)">`
    + repeat(11, i => line(403 + i * 24, 114, 403 + i * 24, 244, '#396052'))
    + repeat(7, i => line(404, 114 + 21.6 * i, 642, 114 + 23 * i, '#396052'))
    + (active ? `<path d="${points}" fill="none" stroke="#b8f287" stroke-width="${1.7 + Math.abs(3 - e.values.focus) * 1.4}" opacity="${.28 + .14 * e.values.brightness}"/>`
      : ready ? circle(523, 183, 3, '#b8f287', '#b8f287') : '') + '</g>'
    + path(`M116 280 V303 H52 V70 H751 V156 H679 M679 212 H745 V346 H${xMic} V355 M220 280 V319 H${xSpeaker} V355`, '#536d66', 2.4)
    + dials
    + terminal(679, 156) + text(689, 146, 'X', 'tick') + terminal(679, 212) + text(689, 202, 'Y', 'tick')
    + shadow(396, 436, 330) + feet(71, 429, 653) + rectangle(71, 413, 653, 16, 'url(#mech-metal)')
    + repeat(11, i => line(89 + 62 * i, 427, 89 + 62 * i, 435, edge) + text(89 + 62 * i, 448, display(10 * i), 'tick', 'middle'))
    + rectangle(xSpeaker - 23, 355, 46, 55, 'url(#mech-case)') + circle(xSpeaker, 376, 15, '#6c8c77', ink)
    + rectangle(xMic - 13, 355, 26, 55, 'url(#mech-enamel)') + circle(xMic, 365, 9, '#4a6b57', ink)
    + terminal(xSpeaker, 355) + terminal(xMic, 355)
    + text(198, 463, 'ГУЧНОМОВЕЦЬ', 'tick', 'middle') + text(530, 463, 'МІКРОФОН', 'tick', 'middle')
    + text(731, 448, 'см', 'tick')
    + (e.obstacle ? rectangle((xSpeaker + xMic) / 2 - 5, 370, 10, 42, '#c7a474', brass, 2) : '')
    + status(!e.scope || !e.generator ? 'Увімкни осцилограф і генератор.' : !ready ? 'Прилади прогріваються.' : !active ? 'Підвищ рівень виходу генератора.' : 'Шукай сусідні прямі протилежних нахилів.', 513);
}

function tubeResonance(e: Experiment, hw: HardwareDrawing) {
  const column = e.values.column;
  const top = 127, height = 2.6 * column;
  const level = top + height;
  const power = e.starts ? resonance(e) : 0;
  const wave = repeat(81, i => {
    const f = i / 80;
    const y = top + f * height;
    const x = 319 + 42 * power * Math.sin((1 - f) * (column / 100) * 2 * Math.PI * fork.frequency / airSpeed);
    return `${i ? 'L' : 'M'}${x} ${y} `;
  });
  hw.object('strike', [273, 78, 80, 44], [336, 96]);
  hw.grip('column', [448, level - 27, 88, 86], { axis: 'y', pixelsPerUnit: 2.6 }, [487, level + 29]);
  hw.steps('column', 638, 414, 90);
  return text(42, 52, 'РЕЗОНАНС У ЗАКРИТІЙ ТРУБІ', 'instrument')
    + shadow(320, 434, 113) + rectangle(263, 423, 113, 13, 'url(#mech-metal)')
    + path(`M272 127 V405 Q272 424 290 424 H353 Q369 424 369 405 V127`, '#5a7c70', 3, 'url(#mech-glass)')
    + rectangle(276, level, 89, 421 - level, '#a4c7c3', aqua, 0)
    + path(`M320 422 V448 H490 V${level + 36}`, blue, 4)
    + rectangle(454, level - 25, 75, 85, 'url(#mech-glass)', green, 9)
    + rectangle(458, level, 67, 55, '#a4c7c3', aqua)
    + line(281, 142, 281, 400, '#e7f2e6', 3)
    + path('M290 80 v14 q0 13 26 13 q26 0 26 -13 v-14 M316 107 v13', green, 5)
    + text(356, 91, 'Камертон № 880', 'label') + text(356, 107, 'Частота 440 Гц', 'tick')
    + scale(244, 127, 286, 110, 10, 1) + text(254, 114, 'см', 'tick')
    + path(wave, blue, 1.4)
    + casework(555, 153, 168, 104) + text(568, 181, 'ВІДНОСНА ГУЧНІСТЬ', 'instrument')
    + repeat(10, i => rectangle(568 + 14 * i, 204, 10, 28, power >= (i + 1) / 10 ? green : '#eaf0e5', edge, 2))
    + plate(555, 288, 168, 'Висота стовпа', display(column, 1), 'см')
    + text(638, 430, 'ВИСОТА', 'tick', 'middle') + text(356, 122, 'Натисни для удару', 'tick')
    + status(!e.starts || e.struck >= 9 ? 'Удар по камертону збуджує повітря в трубі.' : 'Змінюй висоту й шукай місцевий максимум гучності.');
}

function gas(e: Experiment, hw: HardwareDrawing) {
  const left = 300 - e.pressure * 1.8, right = 300 + e.pressure * 1.8;
  const progress = e.stage === 'pumped' && Math.abs(e.offset - e.pressure) < .05;
  hw.object('pump', [58, 175, 74, 76], [94, 197]);
  hw.object('vent', [345, 88, 58, 54], [375, 112]);
  hw.button('prepare', [139, 438, 179, 31], 'Вирівняти тиск');
  return text(42, 52, 'МЕТОД КЛЕМАНА–ДЕЗОРМА', 'instrument')
    + path('M227 214 V114 H375 M375 114 H445 V178', green, 5)
    + shadow(229, 420, 124)
    + rectangle(127, 204, 201, 219, 'url(#mech-enamel)', '#4d6859', 41)
    + rectangle(144, 283, 165, 56, 'url(#mech-case)', '#566e60', 6)
    + screw(153, 292) + screw(299, 291) + screw(153, 330) + screw(299, 330)
    + rectangle(214, 185, 26, 24, '#829d88', green)
    + rectangle(421, 167, 128, 273, 'url(#mech-scale)', '#6b8175', 12)
    + repeat(21, i => line(469, 190 + 11 * i, i % 5 === 0 ? 505 : 490, 190 + 11 * i, '#b2bfb0'))
    + path('M445 178 v179 q0 60 42 60 q42 0 42 -60 v-179', '#819f8e', 13)
    + path(`M445 ${left} v${357 - left} q0 60 42 60 q42 0 42 -60 v${right - 357}`, blue, 8)
    + rectangle(349, 93, 51, 40, '#b8cbb8', green) + circle(375, 113, 11, '#8ba68d', green)
    + text(374, 154, 'Кран', 'label', 'middle')
    + path('M227 115 H95 V251', green, 4) + rectangle(66, 251, 58, 120, 'url(#mech-metal)')
    + path('M95 250 V196', '#52695c', 7)
    + rectangle(63, 188, 64, 17, 'url(#mech-brass)', '#846440', 5)
    + feet(66, 367, 58)
    + text(94, 396, 'Насос', 'label', 'middle')
    + text(228, 318, 'Балон з повітрям', 'label', 'middle')
    + line(454, left, 518, left, brass) + line(456, right, 518, right, brass)
    + plate(576, 194, 176, 'Різниця рівнів', display(e.pressure, 1), 'см')
    + status(e.stage === 'settled' ? 'Теплова рівновага відновилася. Відчитай другий рівень.' : e.stage === 'recovering'
      ? 'Кран закрито. Різниця рівнів зростає під час нагрівання повітря.' : progress ? 'Показ стабільний. Відчитай перший рівень.' :
        e.stage === 'ready' ? 'Качни насосом, щоб створити надлишковий тиск.' : 'Повітря після накачування охолоджується.');
}

function benzene(e: Experiment, hw: HardwareDrawing) {
  const diff = atmosphere - e.vacuum - benzenePressure(e.temperature);
  const scaled = Math.tanh(diff / 12) * 48;
  const stable = Math.abs(e.temperature - (e.heater ? e.values.temperature : 20)) < .05;
  hw.object('valve', [343, 114, 54, 52], [385, 151]);
  hw.object('pump', [384, 312, 94, 105], [431, 349]);
  hw.button('heat', [90, 430, 148, 30], e.heater ? 'Нагрівач увімкнено' : 'Увімкнути нагрівач');
  hw.button('fine', [363, 432, 79, 31], '− 0,1 кПа');
  hw.button('bleed', [447, 432, 79, 31], '+ 0,1 кПа');
  const temperature = hw.knob('temperature', 292, 425, 'ЦІЛЬ, °C', 17);
  return text(42, 52, 'ТИСК НАСИЧЕНОЇ ПАРИ БЕНЗОЛУ', 'instrument')
    + shadow(205, 479, 159)
    + rectangle(73, 160, 258, 251, 'url(#mech-glass)', blue, 12)
    + rectangle(79, 208, 246, 197, 'url(#mech-fluid)', aqua, 8) + line(86, 177, 86, 391, '#eaf7eb', 4)
    + feet(64, 476, 276)
    + rectangle(64, 411, 276, 65, e.heater ? 'url(#mech-hot)' : 'url(#mech-case)', brass)
    + path('M139 182 V338 Q139 373 185 373 Q229 373 229 338 V142 H374', '#7f9a8c', 16)
    + path(`M139 ${288 - scaled} V338 Q139 373 185 373 Q229 373 229 338 V${288 + scaled}`, '#687b8f', 9)
    + path('M139 183 V174', '#6a8374', 13) + line(129, 173, 149, 173, ink, 3)
    + line(111, 288, 257, 288, brass) + text(269, 306, 'Нуль', 'tick', 'end')
    + path('M369 142 H403 V188 H416 M497 188 H521 V142 H563 M521 188 V268 H431 V322', green, 4)
    + rectangle(349, 122, 40, 37, 'url(#mech-case)') + circle(369, 141, 9, e.valve ? green : '#e5e9d5', green)
    + line(369, 141, e.valve ? 380 : 369, e.valve ? 141 : 130, ink, 2.8)
    + rectangle(416, 162, 81, 67, 'url(#mech-glass)', blue) + text(455, 202, 'Буфер', 'label', 'middle')
    + terminal(416, 188) + terminal(497, 188) + circle(521, 188, 4, green, green)
    + rectangle(280, 150, 13, 232, '#f1f5e5') + line(286, 375, 286, 357 - (e.temperature - 20) * 3.7, brass, 3)
    + circle(286, 375, 5, brass, brass)
    + plate(563, 82, 187, 'Вакуумметр', display(e.vacuum, 1), 'кПа') + terminal(563, 142)
    + plate(563, 211, 187, 'Термометр ванни', display(e.temperature, 1), '°C')
    + plate(563, 336, 187, 'Барометр', display(atmosphere, 1), 'кПа')
    + rectangle(385, 321, 91, 94, 'url(#mech-metal)') + terminal(431, 322)
    + text(430, 379, 'Насос', 'label', 'middle') + text(369, 105, e.valve ? 'До насоса' : 'До повітря', 'tick', 'middle') + temperature
    + status(!stable ? 'Температура ванни змінюється.' : Math.abs(diff) < .11
      ? 'Рівні зрівнялися. Відчитай розрідження.' : 'Для відліку зрівняй рівні в U-подібній трубці.');
}

function electrolysis(e: Experiment, hw: HardwareDrawing) {
  const { volume, height } = hydrogenReadings(e);
  const moving = e.stage === 'running' || e.stage === 'settling';
  const current = e.stage === 'running' ? e.values.current : 0;
  const levels = [224 + 16 * volume, 224 - 7 * height, 224 + 8 * volume];
  const bubblePhase = e.elapsed * 6 + e.time * 40;
  const columns = [135, 241, 347];
  hw.button('run', [111, 433, 124, 29], 'Пуск');
  hw.button('stop', [249, 433, 124, 29], 'Стоп');
  hw.button('record-time', [622, 161, 123, 25], 'Записати час');
  hw.button('prepare', [60, 119, 59, 30], 'Випуск');
  const currentKnob = hw.knob('current', 521, 400, 'СТРУМ, А');
  return text(42, 52, 'ЕЛЕКТРОЛІЗ · ВОЛЬТЕЛЕКТРОМЕТР', 'instrument')
    + shadow(243, 413, 155)
    + rectangle(87, 106, 311, 301, 'url(#mech-glass)', '#849c8e', 16)
    + path('M135 113 V354 Q135 384 163 384 H320 Q347 384 347 354 V113 M241 103 V384', '#8aa89a', 24)
    + path('M135 354 Q135 384 163 384 H320 Q347 384 347 354', aqua, 14)
    + columns.map((x, i) => line(x, levels[i], x, i === 1 ? 382 : 355, aqua, 14) + terminal(x, 112, blue)).join('')
    + text(135, 90, 'Катод · H₂', 'label', 'middle') + text(241, 90, 'Рівень розчину', 'tick', 'middle') + text(347, 90, 'Анод · O₂', 'label', 'middle')
    + repeat(9, i => line(102, 224 + i * 16, 123, 224 + i * 16, edge) + text(96, 228 + i * 16, display(i), 'tick', 'end'))
    + (moving ? repeat(6, i => circle(135 + (i % 2 === 0 ? -3 : 3), 350 - (i * 19 + bubblePhase) % 112, 2.6, '#d8efdf', blue)) : '')
    + casework(91, 410, 300, 57) + path('M135 350 H110 V427 M347 350 H370 V427', green, 2)
    + terminal(110, 429) + terminal(370, 429, brass)
    + text(241, 424, 'ДЖЕРЕЛО', 'tick', 'middle') + currentKnob
    + plate(450, 71, 141, 'Амперметр', display(current, 3), 'А')
    + plate(609, 65, 149, 'Секундомір', display(stopwatchReading('electrolysis', e), stopwatchPrecision.electrolysis), 'с', 126)
    + plate(450, 201, 141, 'Газ на катоді', e.stage === 'settling' ? '—' : display(volume, 1), e.stage === 'settling' ? '' : 'см³')
    + plate(609, 201, 149, 'Різниця рівнів', e.stage === 'settled' ? display(height, 1) : '—', e.stage === 'settled' ? 'см' : '')
    + text(604, 376, `Термометр ${display(hydrogen.bathTemperature, 1)} °C`, 'label')
    + text(604, 402, `Барометр ${display(atmosphere, 1)} кПа`, 'label')
    + status(e.stage === 'settling' ? 'Бульбашки ще виходять з розчину.' : e.stage === 'settled'
      ? 'Меніск стабілізувався. Запиши вимірювання.' : e.stage === 'running' ? 'Стеж за об’ємом газу на катоді.' : 'Задай струм і підготуй секундомір.');
}

const fanCenter = { x: 258, y: 97 };

function psychrometerRotor() {
  // Keep this group mounted while the thermometer readings are redrawn.
  return `<g transform="translate(${fanCenter.x} ${fanCenter.y})" aria-hidden="true">
    <g class="mechanics-fan">${repeat(3, i => `<path d="M0 0 Q-18 4 -15 -14 Q-1 -20 0 0Z" fill="#759884" transform="rotate(${i * 120})"/>`)}</g>
    ${circle(0, 0, 4, brass, brass)}
  </g>`;
}

function humidity(e: Experiment, hw: HardwareDrawing) {
  function thermometer(x: number, temperature: number, wet: boolean) {
    const minimumY = 377, maximumY = 166, maximumTemperature = 35;
    const scaleHeight = minimumY - maximumY;
    const level = minimumY - scaleHeight * temperature / maximumTemperature;
    return `<g class="mechanics-psychrometer-thermometer">` + rectangle(x - 30, 138, 60, 265, 'url(#mech-metal)')
      + rectangle(x - 7, 163, 14, 214, '#f5f6e9')
      + line(x, minimumY, x, level, wet ? blue : brass, 4)
      + circle(x, minimumY, 11, wet ? blue : brass, '#789385')
      + scale(x - 36, maximumY, scaleHeight, maximumTemperature, 5)
      + (wet && e.wet ? rectangle(x - 15, 366, 30, 25, '#a2c3bc', aqua, 7) : '') + '</g>';
  }
  const stable = e.stage === 'settled';
  const fanRunning = psychrometerFanRunning(e);
  hw.object('wind', [220, 59, 78, 76], [281, 112]);
  hw.button('wet', [270, 451, 165, 30], e.wet ? 'Батист змочено' : 'Змочити батист');
  return text(42, 52, 'ПСИХРОМЕТР', 'instrument')
    + rectangle(126, 124, 262, 30, 'url(#mech-enamel)', '#466357', 6)
    + screw(132, 137) + screw(381, 137)
    + text(306, 89, 'Ключ вентилятора', 'tick')
    + text(306, 107, fanRunning ? 'Вентилятор працює' : `Обертів ключа: ${e.turns} із ${psychrometerWind.startTurns}`, 'engraved')
    + circle(fanCenter.x, fanCenter.y, 39, 'url(#mech-metal)', green) + circle(fanCenter.x, fanCenter.y, 24, glass, blue)
    + path('M213 119 H162 V140 M301 119 H352 V140', green, 2)
    + thermometer(162, ambientTemperature, false) + thermometer(352, e.temperature, true)
    + shadow(260, 410, 156) + text(162, 434, 'Сухий', 'label', 'middle') + text(352, 434, 'Мокрий', 'label', 'middle')
    + plate(501, 87, 226, 'Сухий термометр', display(ambientTemperature, 1), '°C')
    + plate(501, 210, 226, 'Мокрий термометр', display(e.temperature, 1), '°C')
    + plate(501, 333, 226, 'Барометр', display(atmosphere, 1), 'кПа')
    + status(!e.wet ? 'Змочи батист на мокрому термометрі.' : !fanRunning ? 'Заведи вентилятор ключем.'
      : stable ? 'Рівновага. Запиши обидві температури й тиск.' : 'Мокрий термометр охолоджується.');
}


const scenes: Record<ModeKey, (e: Experiment, hw: HardwareDrawing) => string> = {
  cylinder: caliper, sphere: micrometer, stretch: (e, hw) => elastic('stretch', e, hw), bend: (e, hw) => elastic('bend', e, hw),
  flywheel, stokes: sedimentation, phase, resonance: tubeResonance, gas, benzene, electrolysis, humidity,
};

export function sceneMarkup(mode: Mode) {
  return `<svg class="bench-svg mechanics-scene" viewBox="0 0 800 540" role="group" aria-label="${mode.label}" aria-describedby="mechanics-readings">
    <desc id="mechanics-readings"></desc>
    <defs>
      <linearGradient id="mech-metal" x2="0" y2="1"><stop stop-color="#e6eddf"/><stop offset=".34" stop-color="#c9d7c6"/><stop offset=".61" stop-color="#a6baab"/><stop offset="1" stop-color="#859f90"/></linearGradient>
      <linearGradient id="mech-cylinder"><stop stop-color="#8ca99c"/><stop offset=".28" stop-color="#dfebdd"/><stop offset=".56" stop-color="#bed0c1"/><stop offset="1" stop-color="#839e90"/></linearGradient>
      <linearGradient id="mech-glass"><stop stop-color="#acc8bf"/><stop offset=".27" stop-color="#e1ede3"/><stop offset=".58" stop-color="#f4f7ee"/><stop offset="1" stop-color="#b8d2c4"/></linearGradient>
      <linearGradient id="mech-case" x2="0" y2="1"><stop stop-color="#e6ead8"/><stop offset=".56" stop-color="#c5d1bc"/><stop offset="1" stop-color="#a8bba9"/></linearGradient>
      <linearGradient id="mech-scale" x2="0" y2="1"><stop stop-color="#f8f8e6"/><stop offset="1" stop-color="#e4e9d9"/></linearGradient>
      <linearGradient id="mech-enamel" x2=".75" y2="1"><stop stop-color="#8faa89"/><stop offset=".46" stop-color="#739285"/><stop offset="1" stop-color="#4d6b60"/></linearGradient>
      <linearGradient id="mech-brass" x2="0" y2="1"><stop stop-color="#e4cd90"/><stop offset=".47" stop-color="#bd975d"/><stop offset="1" stop-color="#927043"/></linearGradient>
      <linearGradient id="mech-hot" x2="0" y2="1"><stop stop-color="#ddaa67"/><stop offset="1" stop-color="#ad7c50"/></linearGradient>
      <linearGradient id="mech-fluid" x2=".5" y2="1"><stop stop-color="#c4dcc3"/><stop offset="1" stop-color="#8fb9a3"/></linearGradient>
      <linearGradient id="mech-lcd" x2="0" y2="1"><stop stop-color="#b5d3b3"/><stop offset="1" stop-color="#dbe9c9"/></linearGradient>
      <linearGradient id="mech-button" x2="0" y2="1"><stop stop-color="#f0ebd2"/><stop offset="1" stop-color="#dbd1ae"/></linearGradient>
      <radialGradient id="mech-knob"><stop stop-color="#668575"/><stop offset=".73" stop-color="#4b6d5d"/><stop offset="1" stop-color="#27493c"/></radialGradient>
      <radialGradient id="mech-ball" cx=".31" cy=".23"><stop stop-color="#f6e1a7"/><stop offset=".65" stop-color="#b7915b"/><stop offset="1" stop-color="#805d37"/></radialGradient>
      <radialGradient id="mech-shadow"><stop stop-color="#2d493d" stop-opacity=".25"/><stop offset="1" stop-color="#2d493d" stop-opacity="0"/></radialGradient>
      <linearGradient id="mech-table" x2=".15" y2="1"><stop stop-color="#f5f4e7"/><stop offset=".67" stop-color="#e6eddf"/><stop offset="1" stop-color="#d2ded1"/></linearGradient>
      <pattern id="mech-grid" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M26 0H0V26" fill="none" stroke="#9eafa2" stroke-opacity=".2" stroke-width=".7"/></pattern>
    </defs>
    <g aria-hidden="true">
      <rect width="800" height="540" fill="url(#mech-table)"/>
      <rect x="18" y="18" width="764" height="504" rx="14" fill="url(#mech-grid)" stroke="#acbdae"/>
      <rect x="22" y="22" width="756" height="496" rx="12" fill="none" stroke="#fbfaf1"/>
      ${screw(30, 30)}${screw(770, 30)}${screw(30, 509)}${screw(770, 509)}
    </g>
    <g data-mechanics-drawing aria-hidden="true"></g>
    ${mode.key === 'humidity' ? psychrometerRotor() : ''}
    <g data-mechanics-hardware></g>
  </svg>`;
}

export function drawScene(svg: SVGSVGElement, mode: Mode, e: Experiment) {
  const hardware = hardwareDrawing(mode, e);
  const scene = scenes[mode.key](e, hardware);
  const readings = [...scene.matchAll(/class="mechanics-(?:reading|status|instrument)"[^>]*>([^<]+)/g)].map(match => match[1]);
  if (mode.key === 'cylinder') {
    readings.push(`Ліворуч від нуля ноніуса ${Math.floor(e.values.jaw)} мм. Збігається штрих номер ${Math.round(e.values.jaw * 10) % 10}.`);
  } else if (mode.key === 'sphere') {
    const divisions = Math.round(e.values.jaw * 100);
    readings.push(`Відкрито ${display(Math.floor(divisions / 50) / 2, 1)} мм стебла. На барабані поділка ${divisions % 50}.`);
  }
  svg.querySelector('desc')!.textContent = readings.join('. ');
  svg.querySelector('[data-mechanics-drawing]')!.innerHTML = scene;
  if (mode.key === 'humidity') svg.querySelector('.mechanics-fan')!.classList.toggle('mechanics-fan-spinning', psychrometerFanRunning(e));
  updateHardware(svg.querySelector('[data-mechanics-hardware]')!, hardware.items, mode, e);
  return hardware.items;
}
