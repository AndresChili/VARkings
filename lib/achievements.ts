export interface AchievementStats {
  totalPredictions: number;
  exactPredictions: number;
  hasTournamentPrediction: boolean;
  groupPredictionsCount: number;
  friendsCount: number;
  groupsCreated: number;
  maxGroupMembers: number;
  totalPoints: number;
  totalXP: number;
  totalMatches: number;
  hasAvatar: boolean;
  currentStreak: number;
  maxStreak: number;
  totalDaysActive: number;
}

export type AchievementDifficulty = 'easy' | 'medium' | 'hard';

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  description: string;
  category: 'social' | 'predicciones' | 'grupos' | 'puntos' | 'perfil' | 'rachas';
  current: number;
  target: number;
  difficulty: AchievementDifficulty;
}

export function getAchievements(s: AchievementStats): Achievement[] {
  return [
    { id: 'primer-vaticinio',  emoji: '⚽', title: 'Primer Vaticinio',      description: 'Haz tu primera predicción de partido',                  category: 'predicciones', current: s.totalPredictions,               target: 1,   difficulty: 'easy'   },
    { id: 'adivino',           emoji: '🔮', title: 'Adivino',                description: 'Realiza 10 predicciones de partido',                    category: 'predicciones', current: s.totalPredictions,               target: 10,  difficulty: 'medium' },
    { id: 'maquina',           emoji: '🤖', title: 'Máquina Predictora',     description: 'Realiza 50 predicciones de partido',                    category: 'predicciones', current: s.totalPredictions,               target: 50,  difficulty: 'hard'   },
    { id: 'completista',       emoji: '🌍', title: 'Completista',            description: 'Predice todos los partidos del Mundial',                category: 'predicciones', current: s.totalPredictions,               target: s.totalMatches || 104, difficulty: 'hard'   },
    { id: 'ojo-halcon',        emoji: '🎯', title: 'Ojo de Halcón',          description: 'Acierta el marcador exacto de un partido (3 puntos)',   category: 'predicciones', current: s.exactPredictions,               target: 1,   difficulty: 'medium' },
    { id: 'hat-trick',         emoji: '💥', title: 'Hat-Trick de Aciertos',  description: 'Acierta 3 marcadores exactos',                          category: 'predicciones', current: s.exactPredictions,               target: 3,   difficulty: 'medium' },
    { id: 'gran-podio',        emoji: '🏆', title: 'El Gran Podio',          description: 'Completa tus predicciones del podio del torneo',        category: 'predicciones', current: s.hasTournamentPrediction ? 1 : 0, target: 1,   difficulty: 'easy'   },
    { id: 'estratega',         emoji: '🗺️', title: 'Gran Estratega',         description: 'Predice los clasificados de los 12 grupos',             category: 'predicciones', current: s.groupPredictionsCount,           target: 12,  difficulty: 'medium' },
    { id: 'primer-amigo',      emoji: '🤝', title: 'Primer Amigo',           description: 'Añade tu primer amigo en VARkings',                     category: 'social',       current: s.friendsCount,                   target: 1,   difficulty: 'easy'   },
    { id: 'pandilla',          emoji: '👥', title: 'La Pandilla',            description: 'Consigue 3 amigos en VARkings',                         category: 'social',       current: s.friendsCount,                   target: 3,   difficulty: 'medium' },
    { id: 'la-pena',           emoji: '🎉', title: 'La Peña',                description: 'Consigue 5 amigos en VARkings',                         category: 'social',       current: s.friendsCount,                   target: 5,   difficulty: 'medium' },
    { id: 'estrella-social',   emoji: '🌟', title: 'Estrella Social',        description: 'Consigue 10 amigos en VARkings',                        category: 'social',       current: s.friendsCount,                   target: 10,  difficulty: 'hard'   },
    { id: 'fundador',          emoji: '🏗️', title: 'Fundador',               description: 'Crea tu primera quiniela',                              category: 'grupos',       current: s.groupsCreated,                  target: 1,   difficulty: 'easy'   },
    { id: 'lider',             emoji: '👑', title: 'Jefe de Liga',           description: 'Sé admin de una quiniela con 5 o más miembros',         category: 'grupos',       current: s.maxGroupMembers,                target: 5,   difficulty: 'medium' },
    { id: 'gran-empresa',      emoji: '🏢', title: 'Gran Empresa',           description: 'Crea 3 quinielas diferentes',                           category: 'grupos',       current: s.groupsCreated,                  target: 3,   difficulty: 'hard'   },
    { id: 'despegando',        emoji: '🌱', title: 'Despegando',             description: 'Acumula 100 XP',                                        category: 'puntos',       current: s.totalXP,                        target: 100, difficulty: 'easy'   },
    { id: 'profesional',       emoji: '⭐', title: 'Profesional',            description: 'Acumula 600 XP',                                        category: 'puntos',       current: s.totalXP,                        target: 600, difficulty: 'medium' },
    { id: 'experto',           emoji: '⚡', title: 'Experto Mundial',        description: 'Acumula 1200 XP',                                       category: 'puntos',       current: s.totalXP,                        target: 1200, difficulty: 'hard'  },
    { id: 'leyenda',           emoji: '🔥', title: 'Leyenda Viviente',       description: 'Acumula 2200 XP',                                       category: 'puntos',       current: s.totalXP,                        target: 2200, difficulty: 'hard'  },
    { id: 'cara-conocida',     emoji: '📸', title: 'Cara Conocida',          description: 'Sube tu foto de perfil',                                category: 'perfil',       current: s.hasAvatar ? 1 : 0,              target: 1,   difficulty: 'easy'   },
    { id: 'primer-dia',        emoji: '🗓️', title: 'Primer Día',             description: 'Entra a VARkings por primera vez',                      category: 'rachas',       current: s.totalDaysActive,                target: 1,   difficulty: 'easy'   },
    { id: 'semana-total',      emoji: '📅', title: 'Primera Semana',         description: 'Juega durante 7 días en total',                         category: 'rachas',       current: s.totalDaysActive,                target: 7,   difficulty: 'medium' },
    { id: 'veterano',          emoji: '🦅', title: 'Veterano del Mundial',   description: 'Juega durante 30 días en total',                        category: 'rachas',       current: s.totalDaysActive,                target: 30,  difficulty: 'hard'   },
    { id: 'constante',         emoji: '🔥', title: 'Constante',              description: 'Entra 3 días seguidos',                                 category: 'rachas',       current: s.maxStreak,                      target: 3,   difficulty: 'easy'   },
    { id: 'semana-fuego',      emoji: '💥', title: 'Semana de Fuego',        description: 'Mantén una racha de 7 días',                            category: 'rachas',       current: s.maxStreak,                      target: 7,   difficulty: 'medium' },
    { id: 'quincenal',         emoji: '💪', title: 'Quincenal',              description: 'Mantén una racha de 14 días consecutivos',              category: 'rachas',       current: s.maxStreak,                      target: 14,  difficulty: 'hard'   },
    { id: 'mes-mundial',       emoji: '🏅', title: 'Mes Mundial',            description: 'Entra cada día durante 30 días seguidos',               category: 'rachas',       current: s.maxStreak,                      target: 30,  difficulty: 'hard'   },
  ];
}
