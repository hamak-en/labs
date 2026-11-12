import {generatorRange} from './config';
// One fixed tube for lab 5; this value is not exposed as a student answer.
export const tubeSensitivity = 1; // mm/V
// The graticule and both rendering backends use the same physical calibration.
export const scopeScale = {
  centerX: 360, centerY: 240,
  width: 240, height: 190,
  columns: 10, rows: 8,
  voltsPerXDivision: 1, voltsPerYDivision: 2, sensitivityMmPerDivision:20,
  millisecondsPerDivision: 2,
  referenceVolts: 4, referenceHz: 50,
} as const;

export const scopePixelsPerVoltX = scopeScale.width / scopeScale.columns / scopeScale.voltsPerXDivision;
export const scopePixelsPerVoltY = scopeScale.height / scopeScale.rows / scopeScale.voltsPerYDivision;
export const scopeSweepPhasePerHalfWidth = Math.PI * scopeScale.referenceHz
  * scopeScale.columns * scopeScale.millisecondsPerDivision / 1000;

export const scopePixelsPerMillimetreX = scopeScale.width / scopeScale.columns / scopeScale.sensitivityMmPerDivision;
// Sample each period at least 24 times, with a baseline of 700 trace segments.
export const scopeTraceSegments=Math.max(700,Math.ceil(generatorRange.max*scopeScale.columns*scopeScale.millisecondsPerDivision/1000*24));
