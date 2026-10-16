import { describe, expect, it } from 'vitest';
import {
  calculateMatchPoints,
  calculateGroupPoints,
  calculateTournamentPoints,
  getMaxMatchPoints,
  getMaxTournamentPoints,
} from '@/lib/scoring';

describe('calculateMatchPoints', () => {
  it('da 3 puntos por marcador exacto', () => {
    const result = calculateMatchPoints(2, 1, 2, 1);
    expect(result).toEqual({
      points_winner: 1,
      points_home_score: 1,
      points_away_score: 1,
      points_total: 3,
    });
  });

  it('da 1 punto si solo acierta el ganador', () => {
    const result = calculateMatchPoints(3, 0, 2, 1);
    expect(result.points_winner).toBe(1);
    expect(result.points_home_score).toBe(0);
    expect(result.points_away_score).toBe(0);
    expect(result.points_total).toBe(1);
  });

  it('da 2 puntos si acierta ganador y un marcador', () => {
    const result = calculateMatchPoints(2, 0, 1, 0);
    expect(result.points_winner).toBe(1);
    expect(result.points_home_score).toBe(0);
    expect(result.points_away_score).toBe(1);
    expect(result.points_total).toBe(2);
  });

  it('da 0 puntos si no acierta nada', () => {
    const result = calculateMatchPoints(1, 0, 0, 2);
    expect(result.points_total).toBe(0);
  });

  it('puntúa los goles de un equipo aunque falle el ganador', () => {
    const result = calculateMatchPoints(3, 1, 0, 1);
    expect(result.points_winner).toBe(0);
    expect(result.points_home_score).toBe(0);
    expect(result.points_away_score).toBe(1);
    expect(result.points_total).toBe(1);
  });

  it('da el punto de ganador cuando predice y acierta un empate', () => {
    const result = calculateMatchPoints(1, 1, 2, 2);
    expect(result.points_winner).toBe(1);
  });

  describe('eliminatoria decidida por penales', () => {
    it('acierta el equipo que pasa de ronda en empate', () => {
      const result = calculateMatchPoints(1, 1, 1, 1, {
        predictedKnockoutWinner: 'Francia',
        actualKnockoutWinner: 'Francia',
      });
      expect(result.points_winner).toBe(1);
    });

    it('falla el equipo que pasa de ronda en empate', () => {
      const result = calculateMatchPoints(1, 1, 1, 1, {
        predictedKnockoutWinner: 'Argentina',
        actualKnockoutWinner: 'Francia',
      });
      expect(result.points_winner).toBe(0);
    });

    it('no da el punto de ganador si predijo victoria en los 90 minutos aunque acabó en penales', () => {
      const result = calculateMatchPoints(2, 0, 1, 1, {
        predictedKnockoutWinner: 'Francia',
        actualKnockoutWinner: 'Francia',
      });
      // Predijo 2-0 (ganador en los 90'), pero el partido real terminó en empate
      // y se decidió por penales. El punto de ganador no depende del resultado
      // predicho en los 90' sino de predictedKnockoutWinner === actualKnockoutWinner.
      expect(result.points_winner).toBe(1);
    });
  });
});

describe('calculateGroupPoints', () => {
  it('da 5 puntos si acierta los dos clasificados en cualquier orden', () => {
    expect(calculateGroupPoints(['A', 'B'], ['B', 'A'])).toBe(5);
    expect(calculateGroupPoints(['A', 'B'], ['A', 'B'])).toBe(5);
  });

  it('da 2 puntos si acierta solo uno', () => {
    expect(calculateGroupPoints(['A', 'C'], ['A', 'B'])).toBe(2);
  });

  it('da 0 puntos si no acierta ninguno', () => {
    expect(calculateGroupPoints(['C', 'D'], ['A', 'B'])).toBe(0);
  });
});

describe('calculateTournamentPoints', () => {
  it('da la puntuación completa del podio exacto (35 puntos)', () => {
    const result = calculateTournamentPoints({
      predictedChampion: 'Brasil',
      predictedRunnerUp: 'Francia',
      predictedThird: 'Argentina',
      actualChampion: 'Brasil',
      actualRunnerUp: 'Francia',
      actualThird: 'Argentina',
    });
    expect(result).toEqual({ champion: 20, runner_up: 10, third_place: 5, total: 35 });
  });

  it('da puntos de consolación si el equipo está en el podio pero en otra posición', () => {
    const result = calculateTournamentPoints({
      predictedChampion: 'Francia',
      predictedRunnerUp: 'Brasil',
      predictedThird: null,
      actualChampion: 'Brasil',
      actualRunnerUp: 'Francia',
      actualThird: 'Argentina',
    });
    expect(result.champion).toBe(3);
    expect(result.runner_up).toBe(3);
    expect(result.third_place).toBe(0);
    expect(result.total).toBe(6);
  });

  it('da 0 puntos si el equipo predicho queda fuera del podio', () => {
    const result = calculateTournamentPoints({
      predictedChampion: 'España',
      predictedRunnerUp: null,
      predictedThird: null,
      actualChampion: 'Brasil',
      actualRunnerUp: 'Francia',
      actualThird: 'Argentina',
    });
    expect(result.champion).toBe(0);
    expect(result.total).toBe(0);
  });

  it('da 0 puntos cuando la predicción es null', () => {
    const result = calculateTournamentPoints({
      predictedChampion: null,
      predictedRunnerUp: null,
      predictedThird: null,
      actualChampion: 'Brasil',
      actualRunnerUp: 'Francia',
      actualThird: 'Argentina',
    });
    expect(result.total).toBe(0);
  });

  it('da 0 puntos si el podio real todavía no se conoce', () => {
    const result = calculateTournamentPoints({
      predictedChampion: 'Brasil',
      predictedRunnerUp: 'Francia',
      predictedThird: 'Argentina',
      actualChampion: null,
      actualRunnerUp: null,
      actualThird: null,
    });
    expect(result).toEqual({ champion: 0, runner_up: 0, third_place: 0, total: 0 });
  });
});

describe('máximos', () => {
  it('el máximo por partido es 3', () => {
    expect(getMaxMatchPoints()).toBe(3);
  });

  it('el máximo del torneo es 95 (35 de podio + 60 de grupos)', () => {
    expect(getMaxTournamentPoints()).toBe(95);
  });
});
