// Static illustrations identify equipment types; they contain no specimen
// ratings, measured values, or controls and do not read experiment state.
const ink = '#51654f', metal = '#dce3d2', paper = '#f5f3df', copper = '#b47a4c';
const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const text = (x: number, y: number, value: string, size = 12) =>
  `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" fill="${ink}">${esc(value)}</text>`;
const path = (d: string, color = ink, width = 2) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const box = (x: number, y: number, w: number, h: number) =>
  `<rect x="${x + 3}" y="${y + 5}" width="${w}" height="${h}" rx="9" fill="#d6ddcb"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="#e9eddf" stroke="#8f9e85" stroke-width="1.5"/>`;
const jack = (x: number, y: number, color = ink) => `<circle cx="${x}" cy="${y}" r="6" fill="${paper}" stroke="#93a286"/><circle cx="${x}" cy="${y}" r="3" fill="${color}"/>`;
const knob = (x: number, y: number, r = 13) =>
  `<circle cx="${x}" cy="${y}" r="${r + 4}" fill="none" stroke="#a9b49a"/><circle cx="${x}" cy="${y}" r="${r}" fill="#586d54" stroke="#3c513c"/>${path(`M ${x} ${y - r + 3} v ${r - 5}`, '#f6efcf')}`;
const gauge = (symbol: string, center = false) => `${box(37, 35, 186, 126)}
  <rect x="51" y="48" width="158" height="83" rx="7" fill="${paper}" stroke="#b2bc9f"/>
  ${path('M 72 101 A 68 68 0 0 1 116 66 A 68 68 0 0 1 188 101', '#9fae8e', 1)}
  ${Array.from({ length: 11 }, (_, i) => {
    const a = (-65 + i * 13) * Math.PI / 180;
    const x = 130 + Math.sin(a) * 62, y = 126 - Math.cos(a) * 62;
    return path(`M ${x} ${y} l ${-Math.sin(a) * (i % 5 ? 5 : 8)} ${Math.cos(a) * (i % 5 ? 5 : 8)}`, ink, 1);
  }).join('')}
  ${path(`M 130 126 L ${center ? '130 70' : '103 79'}`, '#b7684d')}
  <circle cx="130" cy="126" r="4" fill="${ink}"/>${text(130, 115, symbol, 16)}
  ${center ? text(130, 59, '0', 9) : ''}${jack(79, 148, '#b45a49')}${jack(181, 148)}`;
const pair = (left: string, right: string) =>
  `<g transform="translate(-7 24) scale(.57)">${gauge(left)}</g><g transform="translate(119 24) scale(.57)">${gauge(right)}</g>`;
const source = (ac: boolean) => `${box(35, 29, 190, 136)}
  <rect x="52" y="45" width="98" height="48" rx="5" fill="#d2ddbf" stroke="#a4b18f"/>
  ${ac ? path('M 67 69 q 12 -25 25 0 t 25 0 t 17 0', ink, 2) : `${path('M 72 64 h 56 M 72 75 h 9 m 9 0 h 9 m 9 0 h 9 m 9 0 h 2', ink, 2)}`}
  ${knob(187, 71, 17)}${path('M 58 111 h 30 m -30 7 h 30 m -30 7 h 30', '#a7b39b')}
  ${jack(137, 137, '#b45a49')}${jack(188, 137)}${text(137, 121, ac ? '~' : '+')}${text(188, 121, ac ? '~' : '−')}`;
const rheostat = () => `${box(35, 51, 190, 105)}
  <rect x="51" y="69" width="158" height="46" rx="4" fill="#dbcfac" stroke="#a59876"/>
  ${Array.from({ length: 24 }, (_, i) => path(`M ${57 + i * 6.3} 72 v 40`, copper, 1.5)).join('')}
  ${path('M 53 63 h 154', '#6a7561', 3)}<rect x="126" y="50" width="24" height="25" rx="4" fill="#5f725a"/>
  ${jack(62, 137, '#b45a49')}${jack(198, 137)}`;
const winding = (x: number, y: number, w = 100) => `${path(`M ${x - 17} ${y} h 17 m ${w} 0 h 17`, ink, 3)}
  ${Array.from({ length: 12 }, (_, i) => `<ellipse cx="${x + i * w / 11}" cy="${y}" rx="10" ry="27" fill="none" stroke="${i % 2 ? copper : '#966944'}" stroke-width="2.7"/>`).join('')}`;
const tube = (x: number, semiconductor = false) => `<rect x="${x}" y="30" width="38" height="119" rx="18" fill="#e4f0e3" fill-opacity=".6" stroke="#93ad93" stroke-width="1.7"/>
  ${path(`M ${x + 12} 17 v ${semiconductor ? 65 : 50} m 14 -${semiconductor ? 65 : 50} v ${semiconductor ? 65 : 50}`, ink, 1.5)}
  ${semiconductor ? `<rect x="${x + 12}" y="80" width="14" height="28" rx="3" fill="#566851"/>` : Array.from({ length: 8 }, (_, i) => `<ellipse cx="${x + 19}" cy="${69 + i * 7}" rx="11" ry="5" fill="none" stroke="${copper}" stroke-width="2"/>`).join('')}`;
const capacitor = (x: number, y: number) => `${path(`M ${x} ${y - 28} v 12 m 32 -12 v 12`, ink, 2)}
  <rect x="${x - 13}" y="${y - 16}" width="58" height="65" rx="7" fill="#cad7b9" stroke="#8da078" stroke-width="1.5"/>
  ${path(`M ${x + 16} ${y - 3} v 11 m -12 0 h 24 m -24 7 h 24 m -12 0 v 13`, ink, 2)}`;
const bulb = (x: number) => `<path d="M ${x - 13} 106 C ${x - 67} 42 ${x + 67} 42 ${x + 13} 106 v 12 h -26 Z" fill="#f5eed2" stroke="#a8ab86" stroke-width="1.7"/>
  ${path(`M ${x - 8} 108 v -20 l 8 7 8 -7 v 20`, '#b28c53', 1.5)}
  <rect x="${x - 15}" y="114" width="30" height="23" rx="3" fill="${metal}" stroke="#899a7f"/>
  ${path(`M ${x - 14} 120 h 28 m -28 6 h 28`, '#97a58b', 1)}<rect x="${x - 22}" y="138" width="44" height="9" rx="3" fill="#6d7d62"/>`;

const pictures = {
  'dc-source': () => source(false),
  'ac-source': () => source(true),
  'resistance-box': () => `${box(23, 42, 214, 112)}${text(130, 64, 'R')}
    ${[55, 92, 130, 168, 205].map(x => knob(x, 97, 10)).join('')}${jack(54, 134, '#b45a49')}${jack(207, 134)}`,
  rheochord: () => `<rect x="17" y="94" width="226" height="43" rx="5" fill="#b49161" stroke="#96784e"/>
    <rect x="24" y="102" width="212" height="28" rx="2" fill="#edddb0"/>
    ${Array.from({ length: 41 }, (_, i) => path(`M ${30 + i * 5} 111 v ${i % 5 ? 6 : 12}`, '#8d7954', 1)).join('')}
    ${path('M 30 101 H 230', '#6a6d54', 2)}${jack(30, 101, '#b45a49')}${jack(230, 101)}
    <rect x="128" y="84" width="19" height="51" rx="4" fill="#d6bc75" stroke="#9d895b"/>
    ${knob(138, 90, 7)}${path('M 138 79 V 58 h 47', ink)}${jack(185, 58)}`,
  galvanometer: () => gauge('G', true),
  resistors: () => [71, 121].map((y, i) => `${path(`M 29 ${y} h 43 m 116 0 h 43`, ink, 2)}
    <rect x="72" y="${y - 13}" width="116" height="26" rx="9" fill="#dacaa8" stroke="#a68f6a"/>
    ${text(130, y + 4, i ? 'R₂' : 'R₁')}`).join(''),
  'reference-cell': () => `${box(55, 65, 150, 96)}<rect x="81" y="45" width="98" height="90" rx="12" fill="#c4d0b8" stroke="#8e9e80"/>
    <rect x="90" y="37" width="80" height="15" rx="4" fill="#6c8063"/>${text(130, 101, 'ℰₙ', 24)}${jack(80, 146, '#b45a49')}${jack(180, 146)}`,
  'unknown-cell': () => `${box(55, 65, 150, 96)}<rect x="81" y="45" width="98" height="90" rx="12" fill="#c4d0b8" stroke="#8e9e80"/>
    <rect x="90" y="37" width="80" height="15" rx="4" fill="#6c8063"/>${text(130, 101, 'ℰₓ', 24)}${jack(80, 146, '#b45a49')}${jack(180, 146)}`,
  thermostat: () => `${box(14, 69, 66, 92)}${knob(46, 102, 15)}<circle cx="46" cy="139" r="4" fill="#a8b97a"/>
    <rect x="95" y="65" width="145" height="99" rx="13" fill="#d3e5d5" stroke="#8da891"/>
    <rect x="103" y="87" width="129" height="67" rx="7" fill="#b1d6c4"/>
    <g transform="translate(2 23) scale(.8)">${tube(141)}${tube(204, true)}</g>
    ${path('M 105 144 q 8 -13 16 0 t 16 0 t 16 0 t 16 0 t 16 0 t 16 0', copper, 4)}
    ${path('M 80 139 h 15', ink)}`,
  thermometer: () => `<rect x="115" y="18" width="28" height="136" rx="14" fill="#f4f2de" stroke="#a5af91"/>
    <circle cx="129" cy="149" r="17" fill="#f4f2de" stroke="#a5af91"/>
    <circle cx="129" cy="149" r="11" fill="#b9684e"/><rect x="126" y="66" width="6" height="82" rx="3" fill="#b9684e"/>
    ${Array.from({ length: 13 }, (_, i) => path(`M 135 ${32 + i * 8} h ${i % 3 ? 5 : 10}`, ink, 1)).join('')}`,
  ohmmeter: () => `${box(105, 46, 129, 115)}<rect x="118" y="62" width="103" height="42" rx="4" fill="#cfdcba" stroke="#a1b38d"/>
    ${text(170, 91, 'Ω', 24)}${knob(169, 131, 14)}${jack(122, 144, '#b45a49')}${jack(217, 144)}
    ${path('M 17 90 l 35 -35 35 35 -35 35 Z', '#8c9a7e')}${jack(17, 90)}${jack(87, 90)}${text(52, 93, 'G')}`,
  'thermal-samples': () => `${tube(73)}${tube(149, true)}${text(92, 173, 'Cu')}${text(168, 173, 'R')}`,
  voltmeter: () => gauge('V'),
  microammeter: () => gauge('µA', true),
  'diode-ammeters': () => pair('µA', 'mA'),
  ammeter: () => gauge('A'),
  'power-ammeters': () => pair('mA', 'A'),
  diode: () => `${path('M 22 99 h 65 m 86 0 h 65', '#9aa48c', 3)}
    <rect x="87" y="82" width="86" height="34" rx="11" fill="#53654f" stroke="#3a503b" stroke-width="1.5"/>
    <rect x="153" y="83" width="8" height="32" fill="#e7e7cf"/>${text(130, 145, 'p–n')}`,
  oscilloscope: () => `${box(16, 35, 228, 126)}
    <rect x="29" y="51" width="137" height="93" rx="13" fill="#6d8068" stroke="#95a78a"/>
    <rect x="36" y="58" width="123" height="79" rx="9" fill="#213e2c"/>
    ${Array.from({ length: 9 }, (_, i) => path(`M ${48 + i * 12} 61 v 73`, '#416346', .7)).join('')}
    ${Array.from({ length: 5 }, (_, i) => path(`M 40 ${69 + i * 14} h 115`, '#416346', .7)).join('')}
    ${path('M 40 98 q 14 -38 28 0 t 28 0 t 28 0 t 28 0', '#b4cd87', 2)}
    ${knob(188, 73, 10)}${knob(224, 73, 10)}${knob(188, 112, 10)}${jack(222, 128)}`,
  generator: () => `${box(39, 31, 182, 133)}<rect x="54" y="47" width="152" height="43" rx="5" fill="${paper}" stroke="#adba9c"/>
    ${path('M 68 69 q 13 -22 26 0 t 26 0 t 26 0 t 26 0 t 19 0', '#8c9b73', 1.7)}${knob(129, 124, 22)}${jack(66, 139)}${jack(193, 139)}`,
  latr: () => `${box(35, 105, 190, 58)}<ellipse cx="130" cy="106" rx="77" ry="26" fill="#8a9c7e" stroke="#687f5d"/>
    <path d="M 53 106 V 66 A 77 26 0 0 1 207 66 V 106" fill="#b4c1a4" stroke="#7d9370"/>
    <ellipse cx="130" cy="66" rx="77" ry="26" fill="#dbe3cb" stroke="#8e9e7c"/>
    ${Array.from({ length: 13 }, (_, i) => {
      const a = (-150 + i * 25) * Math.PI / 180;
      return path(`M ${130 + Math.cos(a) * 62} ${66 + Math.sin(a) * 19} l ${Math.cos(a) * 5} ${Math.sin(a) * 3}`, ink, 1);
    }).join('')}${knob(130, 61, 22)}${jack(72, 142, '#b45a49')}${jack(188, 142)}`,
  rheostat,
  coil: () => `<rect x="53" y="121" width="154" height="24" rx="6" fill="#d4ddc7" stroke="#a3b392"/>
    ${winding(80, 91)}<rect x="62" y="152" width="137" height="12" rx="4" fill="#9da996" stroke="#72856a"/>`,
  capacitors: () => `${capacitor(70, 88)}${capacitor(156, 88)}`,
  capacitor: () => capacitor(114, 88),
  wattmeter: () => gauge('W'),
  loads: () => `<g transform="translate(-2 8) scale(.8)">${bulb(80)}${bulb(166)}</g>
    <g transform="translate(144 56) scale(.55)">${winding(20, 91)}</g>`,
} satisfies Record<string, () => string>;

export type EquipmentImage = keyof typeof pictures;

export function renderEquipmentImage(kind: EquipmentImage, name: string): string {
  return `<svg class="equipment-illustration" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 190" width="260" height="190" role="img" aria-label="${esc(name)} — схематичне зображення">
    <ellipse cx="130" cy="171" rx="102" ry="7" fill="#eaf0e1"/>${pictures[kind]()}</svg>`;
}
