import { WorkoutGoal, GoalProgress, WorkoutSession, UnitSystem } from './types';
import { getExerciseMeta } from './taxonomy';
import { formatWeight } from './analytics';

const STORAGE_KEY = 'gymbro_workout_goals_v1';

export function formatGoalValue(
  valLbs: number,
  metric: WorkoutGoal['targetMetric'],
  unit: UnitSystem
): string {
  if (metric === 'reps') {
    return `${Math.round(valLbs)} réps`;
  }
  if (metric === 'duration') {
    return `${Math.round(valLbs)} sec`;
  }
  return formatWeight(valLbs, unit);
}

export function formatGoalMetricLabel(goal: WorkoutGoal): string {
  if (goal.targetMetric === '1rm') return '1RM Estimé';
  if (goal.targetMetric === 'reps') return 'Série Max (PDC)';
  if (goal.targetMetric === 'duration') return 'Temps de maintien';
  return `Top Set (${goal.targetReps || 8} réps)`;
}

export function getDefaultGoals(): WorkoutGoal[] {
  return [
    {
      id: 'goal-bench-dec2026',
      exerciseName: 'Développé couché',
      targetMetric: 'top_weight',
      targetWeightLbs: 140,
      targetReps: 8,
      targetDate: '2026-12-31',
      createdAt: '2026-08-01',
      startWeightLbs: 105,
      note: 'Passer 140 lbs × 8 réps (actuel : 125 lbs × 12)',
    },
    {
      id: 'goal-chest-press-dec2026',
      exerciseName: 'Presse pectorale',
      targetMetric: 'top_weight',
      targetWeightLbs: 150,
      targetReps: 10,
      targetDate: '2026-12-31',
      createdAt: '2026-08-01',
      startWeightLbs: 120,
      note: 'Valider 150 lbs × 10 réps (actuel : 135×12 et 150×6)',
    },
    {
      id: 'goal-incline-machine-dec2026',
      exerciseName: 'Développé incliné à la machine',
      targetMetric: 'top_weight',
      targetWeightLbs: 145,
      targetReps: 8,
      targetDate: '2026-12-31',
      createdAt: '2026-08-01',
      startWeightLbs: 110,
      note: 'Monter à 145 lbs × 8 réps (actuel : 130 lbs × 9)',
    },
    {
      id: 'goal-lat-pulldown-dec2026',
      exerciseName: 'Tirage vertical',
      targetMetric: 'top_weight',
      targetWeightLbs: 135,
      targetReps: 10,
      targetDate: '2026-12-31',
      createdAt: '2026-08-01',
      startWeightLbs: 105,
      note: 'Maîtriser 135 lbs × 10 réps (actuel : 120×12 et 135×6)',
    },
    {
      id: 'goal-tbar-dec2026',
      exerciseName: 'Tirage T-bar avec support poitrine',
      targetMetric: 'top_weight',
      targetWeightLbs: 105,
      targetReps: 10,
      targetDate: '2026-12-31',
      createdAt: '2026-08-01',
      startWeightLbs: 80,
      note: 'Franchir le cap des 105 lbs × 10 réps (actuel : 92.5 lbs × 10)',
    },
    {
      id: 'goal-squat-dec2026',
      exerciseName: 'Squat',
      targetMetric: 'top_weight',
      targetWeightLbs: 165,
      targetReps: 8,
      targetDate: '2026-12-31',
      createdAt: '2026-08-01',
      startWeightLbs: 125,
      note: 'Atteindre 165 lbs × 8 réps au Squat (actuel : 145 lbs × 10)',
    },
    {
      id: 'goal-shoulder-press-dec2026',
      exerciseName: 'Développé épaules à la machine',
      targetMetric: 'top_weight',
      targetWeightLbs: 105,
      targetReps: 10,
      targetDate: '2026-12-31',
      createdAt: '2026-08-01',
      startWeightLbs: 75,
      note: 'Passer sur le palier 105 lbs × 10 réps (actuel : 90 lbs × 12)',
    },
    {
      id: 'goal-ez-curl-dec2026',
      exerciseName: 'Curl à la barre EZ',
      targetMetric: 'top_weight',
      targetWeightLbs: 70,
      targetReps: 8,
      targetDate: '2026-12-31',
      createdAt: '2026-08-01',
      startWeightLbs: 50,
      note: 'Valider 70 lbs × 8 réps propres (actuel : 60 lbs × 10)',
    },
    {
      id: 'goal-dips-dec2026',
      exerciseName: 'Dips',
      targetMetric: 'reps',
      targetWeightLbs: 15,
      targetDate: '2026-12-31',
      createdAt: '2026-08-01',
      startWeightLbs: 6,
      note: 'Enchaîner 15 Dips stricts au poids du corps (record récent : 10 réps)',
    },
    {
      id: 'goal-deadhang-dec2026',
      exerciseName: 'Dead Hang',
      targetMetric: 'duration',
      targetWeightLbs: 60,
      targetDate: '2026-12-31',
      createdAt: '2026-08-01',
      startWeightLbs: 15,
      note: 'Tenir 1 minute complète (60s) en Dead Hang (actuel : 40s)',
    },
  ];
}

export function loadGoalsFromStorage(): WorkoutGoal[] {
  if (typeof window === 'undefined') return getDefaultGoals();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const defaults = getDefaultGoals();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
      return defaults;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : getDefaultGoals();
  } catch (err) {
    console.error('Failed to load goals from storage:', err);
    return getDefaultGoals();
  }
}

export function saveGoalsToStorage(goals: WorkoutGoal[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  } catch (err) {
    console.error('Failed to save goals to storage:', err);
  }
}

export function calculateGoalProgress(
  goal: WorkoutGoal,
  sessions: WorkoutSession[],
  bodyweightLbs: number = 170
): GoalProgress {
  const meta = getExerciseMeta(goal.exerciseName);

  // Filter sessions starting from createdAt so current block goals track the active block
  const relevant = goal.createdAt
    ? sessions.filter((s) => s.dateStr >= goal.createdAt)
    : sessions;
  const sessionsToScan = relevant.length > 0 ? relevant : sessions;

  // Extract all sets of this exercise
  let bestValue = 0;
  let achievedDate: string | undefined = undefined;

  // We look chronologically to find best performance and when it was achieved
  for (const s of sessionsToScan) {
    const ex = s.exercises.find((e) => e.name === goal.exerciseName);
    if (!ex) continue;

    for (const st of ex.sets) {
      if (st.isWarmup) continue;

      let val = 0;
      if (goal.targetMetric === 'duration') {
        val = st.durationSeconds;
      } else if (goal.targetMetric === 'reps') {
        val = st.reps;
      } else if (goal.targetMetric === '1rm') {
        val = meta.mechanic === 'assisted'
          ? Math.round(Math.max(5, bodyweightLbs - st.weightLbs) * (1 + st.reps / 30))
          : st.estimated1rmLbs;
      } else {
        // 'top_weight'
        if (goal.targetReps && goal.targetReps > 1) {
          if (st.reps >= goal.targetReps) {
            val = meta.mechanic === 'assisted'
              ? Math.max(5, bodyweightLbs - st.weightLbs)
              : st.weightLbs;
          }
        } else {
          val = meta.mechanic === 'assisted'
            ? Math.max(5, bodyweightLbs - st.weightLbs)
            : st.weightLbs;
        }
      }

      if (val > bestValue) {
        bestValue = val;
        if (val >= goal.targetWeightLbs && !achievedDate) {
          achievedDate = s.dateStr;
        }
      }
    }
  }

  const startVal = goal.startWeightLbs;
  const targetVal = goal.targetWeightLbs;
  const isAchieved = bestValue >= targetVal;

  // Calculate percentage
  let progressPercent = 0;
  if (targetVal <= startVal) {
    progressPercent = isAchieved ? 100 : 0;
  } else {
    progressPercent = Math.min(100, Math.max(0, Math.round(((bestValue - startVal) / (targetVal - startVal)) * 100)));
  }

  const remainingWeightLbs = Math.max(0, Math.round((targetVal - bestValue) * 10) / 10);

  // Calculate days remaining
  // Use today or latest session date
  const now = new Date();
  const target = new Date(goal.targetDate + 'T23:59:59');
  const diffTime = target.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Determine status
  let status: GoalProgress['status'] = 'on_track';
  let statusLabel = 'En bonne voie';

  if (isAchieved) {
    status = 'achieved';
    statusLabel = 'Objectif atteint';
  } else if (daysRemaining < 0) {
    status = 'expired';
    statusLabel = 'Échéance dépassée';
  } else if (progressPercent >= 50 || daysRemaining > 60) {
    status = 'on_track';
    statusLabel = 'En bonne voie';
  } else {
    status = 'behind';
    statusLabel = 'À accélérer';
  }

  return {
    goal,
    currentValueLbs: bestValue,
    startValueLbs: startVal,
    targetValueLbs: targetVal,
    progressPercent,
    remainingWeightLbs,
    daysRemaining,
    isAchieved,
    achievedDate,
    status,
    statusLabel,
  };
}
