import { WorkoutGoal, GoalProgress, WorkoutSession } from './types';
import { getExerciseMeta } from './taxonomy';

const STORAGE_KEY = 'gymbro_workout_goals_v1';

export function getDefaultGoals(): WorkoutGoal[] {
  return [
    {
      id: 'goal-bench-2027',
      exerciseName: 'Développé couché',
      targetMetric: '1rm',
      targetWeightLbs: 175,
      targetDate: '2026-12-31',
      createdAt: '2026-08-01',
      startWeightLbs: 135,
      note: 'Objectif 175 lbs avant 2027',
    },
    {
      id: 'goal-lat-pulldown',
      exerciseName: 'Tirage vertical',
      targetMetric: 'top_weight',
      targetWeightLbs: 150,
      targetReps: 8,
      targetDate: '2026-12-31',
      createdAt: '2026-08-01',
      startWeightLbs: 120,
      note: '150 lbs × 8 réps avant 2027',
    },
    {
      id: 'goal-squat-2027',
      exerciseName: 'Squat',
      targetMetric: '1rm',
      targetWeightLbs: 185,
      targetDate: '2027-03-31',
      createdAt: '2026-08-01',
      startWeightLbs: 145,
      note: 'Viser 185 lbs au Squat',
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

  // Extract all sets of this exercise
  let bestValue = 0;
  let achievedDate: string | undefined = undefined;

  // We look chronologically to find best performance and when it was achieved
  for (const s of sessions) {
    const ex = s.exercises.find((e) => e.name === goal.exerciseName);
    if (!ex) continue;

    for (const st of ex.sets) {
      if (st.isWarmup) continue;

      let val = 0;
      if (goal.targetMetric === '1rm') {
        val = meta.mechanic === 'assisted'
          ? Math.round(Math.max(0, bodyweightLbs - st.weightLbs) * (1 + st.reps / 30))
          : st.estimated1rmLbs;
      } else {
        // 'top_weight'
        if (goal.targetReps && goal.targetReps > 1) {
          if (st.reps >= goal.targetReps) {
            val = meta.mechanic === 'assisted'
              ? Math.max(0, bodyweightLbs - st.weightLbs)
              : st.weightLbs;
          }
        } else {
          val = meta.mechanic === 'assisted'
            ? Math.max(0, bodyweightLbs - st.weightLbs)
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
