import { describe, expect, it } from 'vitest';
import { getLevel, getLevelProgress, LEVEL_THRESHOLDS } from '@/lib/xp';

describe('getLevel', () => {
  it('devuelve nivel 1 con 0 XP', () => {
    expect(getLevel(0)).toBe(1);
  });

  it('devuelve nivel 1 justo antes del umbral de nivel 2', () => {
    expect(getLevel(LEVEL_THRESHOLDS[1] - 1)).toBe(1);
  });

  it('sube de nivel justo en el umbral', () => {
    expect(getLevel(LEVEL_THRESHOLDS[1])).toBe(2);
  });

  it('devuelve nivel 20 con el XP máximo de la tabla', () => {
    expect(getLevel(LEVEL_THRESHOLDS[19])).toBe(20);
  });

  it('se mantiene en nivel 20 por encima del umbral máximo', () => {
    expect(getLevel(10000)).toBe(20);
  });
});

describe('getLevelProgress', () => {
  it('calcula el progreso dentro de un nivel intermedio', () => {
    const progress = getLevelProgress(LEVEL_THRESHOLDS[2] + 10);
    expect(progress.level).toBe(3);
    expect(progress.xpInLevel).toBe(10);
    expect(progress.xpNeeded).toBe(LEVEL_THRESHOLDS[3] - LEVEL_THRESHOLDS[2]);
    expect(progress.totalXP).toBe(LEVEL_THRESHOLDS[2] + 10);
  });

  it('da 100% de progreso en nivel 20 sin dividir por xpNeeded = 0', () => {
    const progress = getLevelProgress(LEVEL_THRESHOLDS[19] + 500);
    expect(progress.level).toBe(20);
    expect(progress.percent).toBe(100);
  });

  it('no supera el 100% de progreso dentro de un nivel', () => {
    const progress = getLevelProgress(LEVEL_THRESHOLDS[1]);
    expect(progress.percent).toBe(0);
  });
});
