import { fit } from '../physics';
import { atmosphere, saturationPressure, vaporFromWetBulb } from './model';
import { display } from './scene';

type Point = [number, number];
interface Series { points: Point[]; label: string; color: string; markers?: boolean }

const geometry = { left: 82, top: 26, width: 489, height: 228 };

function chart(series: Series[], xLabel: string, yLabel: string, bounds?: [number, number, number, number], digits = 1) {
  const points = series.flatMap(s => s.points);
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const [minX, maxX, minY, maxY] = bounds ?? [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const x = (value: number) => geometry.left + geometry.width * (value - minX) / (maxX - minX || 1);
  const y = (value: number) => geometry.top + geometry.height * (1 - (value - minY) / (maxY - minY || 1));
  const grid = Array.from({ length: 6 }, (_, i) => {
    const px = minX + i / 5 * (maxX - minX), py = minY + i / 5 * (maxY - minY);
    return `<path d="M${x(px)} 26V254 M82 ${y(py)}H571" stroke="#dbe5d7" fill="none"/>
      <text x="${x(px)}" y="276" text-anchor="middle">${display(px, digits)}</text>
      <text x="74" y="${y(py) + 4}" text-anchor="end">${display(py, digits)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 640 322" class="mechanics-chart" role="img" aria-label="${yLabel} залежно від ${xLabel}">
    <rect x="82" y="26" width="489" height="228" fill="#f5f8ef" stroke="#afbfaa"/>
    ${grid}
    ${series.map(({ points, color, label, markers }) => {
      const last = points.at(-1)!;
      return `<polyline points="${points.map(([px, py]) => `${x(px)},${y(py)}`).join(' ')}" stroke="${color}" stroke-width="2" fill="none"/>
        ${label ? `<text x="${x(last[0]) + 7}" y="${y(last[1]) + 4}">${label}</text>` : ''}
        ${markers ? points.map(([px, py]) => `<circle cx="${x(px)}" cy="${y(py)}" r="4" fill="${color}"/>`).join('') : ''}`;
    }).join('')}
    <text x="326" y="308" text-anchor="middle">${xLabel}</text>
    <text x="20" y="140" text-anchor="middle" transform="rotate(-90 20 140)">${yLabel}</text>
  </svg>`;
}

export function nomogram() {
  const series = [10, 25, 40, 55, 70, 85, 100].map(relative => ({
    label: `${relative} %`, color: '#527d72', points: Array.from({ length: 26 }, (_, i): Point => {
      const dry = 10 + i;
      const vapor = saturationPressure(dry) * relative / 100;
      let low = 0, high = dry;
      for (let step = 0; step < 23; step++) {
        const wet = (low + high) / 2;
        if (vaporFromWetBulb(dry, wet, atmosphere) < vapor) low = wet;
        else high = wet;
      }
      return [dry, (low + high) / 2];
    }),
  }));
  return chart(series, 'Сухий термометр, °C', 'Мокрий термометр, °C', [10, 35, 0, 35], 0);
}

export function benzeneCharts(points: Point[]) {
  if (points.length < 2) return '<p>Введи щонайменше дві точки з різними температурами.</p>';
  const transformed: Point[] = points.map(([temperature, pressure]) => [1000 / (temperature + 273.15), Math.log(pressure)]).reverse() as Point[];
  const { slope, intercept } = fit(transformed.map(p => p[0]), transformed.map(p => p[1]));
  const first = transformed[0][0], last = transformed.at(-1)![0];
  const fitted: Point[] = [[first, intercept + first * slope], [last, intercept + last * slope]];
  return `<div class="mechanics-graphs">
    <figure><div class="mechanics-chart-viewport" tabindex="0">${chart([{ points, label: '', color: '#447d73', markers: true }], 'Температура, °C', 'Тиск, кПа')}</div>
      <figcaption>Тиск насиченої пари від температури</figcaption></figure>
    <figure><div class="mechanics-chart-viewport" tabindex="0">${chart([{ points: transformed, label: '', color: '#447d73', markers: true }, { points: fitted, label: '', color: '#9e7445' }],
       '1/T, 10⁻³ К⁻¹', 'ln(p / 1 кПа)', undefined, 2)}</div>
      <figcaption>Нахил відносно 1/T: ${display(slope * 1000, 1)} К</figcaption></figure>
  </div>${slope >= 0 ? '<p>Очікується від’ємний нахил. Перевір абсолютний тиск і температуру в точках.</p>' : ''}`;
}
