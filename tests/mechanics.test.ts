import { describe, expect, test } from 'vitest';
import {
  airSpeed, atmosphere, benzenePressure, deformation, elementaryCharge,
  fork, freshExperiment, gravity, hangingMass, hydrogenReadings, modes, perform,
  phaseShift, plateLoadPosition, plateProfile, resonance, saturationPressure, specimenSize, stokesMotion, stokesSpeed, tick, vaporFromWetBulb, wheelMotion,
} from '../src/mechanics/model';
import type { ModeKey } from '../src/mechanics/model';

const setup = (key: ModeKey) => freshExperiment(modes.find(mode => mode.key === key)!, false);

describe('Measurements in mechanics and molecular physics', () => {
  test('elastic indicator is linear with load, reversible, and reads less away from midspan', () => {
    const wire = setup('stretch');
    expect(deformation('stretch', wire)).toBe(0);
    wire.values.load = 1;
    expect(deformation('stretch', wire)).toBeCloseTo(.1082, 3);
    wire.values.load = 2;
    expect(deformation('stretch', wire)).toBeCloseTo(.2165, 3);
    const plate = setup('bend');
    plate.values.load = 2.5;
    const central = deformation('bend', plate);
    expect(central).toBeCloseTo(2.61, 2);
    plate.values.offset = 15;
    expect(deformation('bend', plate)).toBeLessThan(central);
    plate.values.offset = -15;
    expect(deformation('bend', plate)).toBeCloseTo(deformation('bend', { ...plate, values: { ...plate.values, offset: 15 } }), 7);
  });

  test('the bending profile is flat unloaded and has a continuous slope through a displaced load', () => {
    const plate = setup('bend');
    expect(plateProfile(plate, .25)).toEqual({ deflection: 0, slope: 0 });

    plate.values.load = 2.5;
    const middle = plateProfile(plate, .5);
    expect(middle.slope).toBe(0);
    expect(plateProfile(plate, .25).deflection / middle.deflection).toBeCloseTo(11 / 16);
    expect(plateProfile(plate, .75).deflection).toBeCloseTo(plateProfile(plate, .25).deflection);

    plate.values.offset = -15;
    expect(plateProfile(plate, 0).deflection).toBe(0);
    expect(plateProfile(plate, 1).deflection).toBe(0);
    expect(plateProfile(plate, .5).slope).toBeLessThan(0);
    const load = plateLoadPosition(plate);
    expect(plateProfile(plate, load + 1e-7).slope).toBeCloseTo(plateProfile(plate, load).slope, 5);
  });

  test('wheel keeps rotating while the weight rises and friction correction recovers the ring inertia', () => {
    const wheel = setup('flywheel');
    const withWheel = wheelMotion(wheel);
    const h = wheel.values.height / 100;
    wheel.elapsed = withWheel.fallTime;
    const atBottom = wheelMotion(wheel);
    expect(atBottom.height).toBeCloseTo(0, 8);
    wheel.elapsed += withWheel.riseTime / 2;
    expect(wheelMotion(wheel).angle).toBeGreaterThan(atBottom.angle);
    expect(wheelMotion(wheel).height).toBeGreaterThan(0);

    wheel.attached = false;
    const bareAxle = wheelMotion(wheel);
    const estimate = (m: ReturnType<typeof wheelMotion>) => 2 * m.rebound * m.fallTime ** 2 / (h + m.rebound);
    const corrected = hangingMass * .018 ** 2 * gravity / (2 * h) * (estimate(withWheel) - estimate(bareAxle));
    expect(corrected).toBeCloseTo(.0218752, 8);
    expect(withWheel.fallTime).toBeGreaterThan(bareAxle.fallTime);
  });

  test('the wall decreases terminal speed and changing the diameter changes sedimentation', () => {
    expect(stokesSpeed(5, 2.5)).toBeCloseTo(1.141, 2);
    expect(stokesSpeed(5, 2.5)).toBeLessThan(stokesSpeed(5, 100));
    expect(stokesSpeed(4.8, 2.5)).toBeLessThan(stokesSpeed(5, 2.5));
    const ball = setup('stokes');
    const initial = stokesMotion(ball);
    expect(specimenSize('stokes', ball)).toBeCloseTo(4.82);
    ball.values.point = 3;
    expect(specimenSize('stokes', ball)).toBeCloseTo(4.85);
    expect(stokesMotion(ball).speed).toBe(initial.speed);
    ball.values.ball = 2;
    expect(stokesMotion(ball).speed).toBeGreaterThan(initial.speed);
  });

  test('half a wavelength inverts the trace and opening a quarter-wave column raises the level', () => {
    const phase = setup('phase');
    const before = phaseShift(phase);
    phase.values.microphone += 50 * airSpeed / phase.values.frequency;
    expect(phaseShift(phase) - before).toBeCloseTo(Math.PI, 8);

    const tube = setup('resonance');
    const baseline = resonance(tube);
    tube.values.column = 25 * airSpeed / fork.frequency;
    expect(resonance(tube)).toBeGreaterThan(baseline * 4);
  });

  test('venting requires the first equilibrium and the second head is smaller and positive', () => {
    const gas = setup('gas');
    perform('gas', gas, 'pump');
    perform('gas', gas, 'vent');
    expect(gas.stage).toBe('pumped');
    tick('gas', gas, 8);
    expect(gas.pressure).toBe(4);
    perform('gas', gas, 'vent');
    expect(gas.pressure).toBe(0);
    tick('gas', gas, 8);
    expect(gas.stage).toBe('settled');
    expect(4 / (4 - gas.pressure)).toBeCloseTo(1.4, 2);
  });

  test('saturation curves match reference magnitudes and wet-bulb depression lowers vapor pressure', () => {
    expect(saturationPressure(20)).toBeCloseTo(2.339, 3);
    expect(saturationPressure(30)).toBeCloseTo(4.247, 2);
    expect(benzenePressure(20)).toBeCloseTo(10.0, 1);
    expect(benzenePressure(50)).toBeCloseTo(36.2, 0);
    expect(vaporFromWetBulb(24, 24, atmosphere)).toBeCloseTo(saturationPressure(24), 8);
    expect(vaporFromWetBulb(24, 19, atmosphere)).toBeLessThan(saturationPressure(19));
  });

  test('one modeled electrolysis run recovers Boltzmann’s constant from measured quantities', () => {
    const cell = setup('electrolysis');
    cell.elapsed = 160;
    const { volume, height, vapor } = hydrogenReadings(cell);
    expect(volume).toBeGreaterThan(5);
    expect(volume).toBeLessThan(6);
    const p = (atmosphere - vapor) * 1000 + 1100 * gravity * height / 100;
    const result = 2 * elementaryCharge * p * volume * 1e-6 / (cell.values.current * cell.elapsed * 295.15);
    expect(result / 1.380649e-23).toBeCloseTo(1, 7);
  });
});
