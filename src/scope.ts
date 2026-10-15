// The graticule and both rendering backends use the same physical calibration.
export const scopeScale = {
  centerX: 360, centerY: 240,
  width: 240, height: 190,
  columns: 10, rows: 8,
  voltsPerXDivision: 1, voltsPerYDivision: 2,
  millisecondsPerDivision: 2,
  referenceVolts: 4, referenceHz: 50,
} as const;

export const scopePixelsPerVoltX = scopeScale.width / scopeScale.columns / scopeScale.voltsPerXDivision;
export const scopePixelsPerVoltY = scopeScale.height / scopeScale.rows / scopeScale.voltsPerYDivision;
export const scopeSweepPhasePerHalfWidth = Math.PI * scopeScale.referenceHz
  * scopeScale.columns * scopeScale.millisecondsPerDivision / 1000;
