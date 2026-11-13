export type MovementType = 'Push' | 'Pull' | 'Legs' | 'Core' | 'Cardio';

export type MuscleGroup = 
  | 'Pectoraux'
  | 'Dos'
  | 'Épaules Latérales'
  | 'Épaules Antérieures'
  | 'Épaules Postérieures'
  | 'Triceps'
  | 'Biceps'
  | 'Avant-bras'
  | 'Quadriceps'
  | 'Ischios & Fessiers'
  | 'Mollets'
  | 'Abdominaux';

export type ExerciseMechanic = 'standard' | 'assisted' | 'bodyweight' | 'duration';

export interface ExerciseMeta {
  category: MovementType;
  mechanic: ExerciseMechanic;
  primaryMuscle: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
  linkedExercise?: string; // e.g. "Dips assistés" linked to "Dips"
}

export interface RawWorkoutRow {
  Date: string;
  Durée?: string;
  "Nom de la séance"?: string;
  "Nom de l'exercice"?: string;
  "Ordre des séries"?: string | number;
  Poids?: string | number;
  Réps?: string | number;
  Distance?: string | number;
  Secondes?: string | number;
  RPE?: string | number;
  Notes?: string;
}

export interface WorkoutSet {
  id: string;
  exerciseName: string;
  setIndex: number;
  weightLbs: number;
  weightKg: number;
  reps: number;
  durationSeconds: number;
  distance: number;
  isWarmup: boolean;
  estimated1rmLbs: number;
  estimated1rmKg: number;
  effectiveLoadLbs: number; // for bodyweight/assisted
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  dateStr: string; // "YYYY-MM-DD"
  rawDate: string; // ISO / liftoff date string
  timestamp: number;
  durationMinutes: number;
  sessionTitle?: string;
  detectedType: MovementType | 'Upper' | 'Full Body' | 'Cardio';
  exercises: {
    name: string;
    sets: WorkoutSet[];
    meta: ExerciseMeta;
    totalVolumeLbs: number;
    effectiveSetsCount: number;
    topSetWeightLbs: number;
    topSetReps: number;
    topSet1rmLbs: number;
    topSetScoreLbs: number;
    topSetDurationSeconds: number;
    totalDurationSeconds: number;
  }[];
  totalEffectiveSets: number;
  totalVolumeLbs: number;
  isCardioOnly: boolean;
}

export type TimePeriodFilter = 'all' | 'block_2026' | 'block_2024_2025' | '90d' | '30d';
export type UnitSystem = 'lbs' | 'kg';

export type GoalMetric = '1rm' | 'top_weight' | 'reps' | 'duration';

export interface WorkoutGoal {
  id: string;
  exerciseName: string;
  targetMetric: GoalMetric;
  targetWeightLbs: number;
  targetReps?: number; // e.g. 8 réps pour un objectif de série
  targetDate: string; // "YYYY-MM-DD", e.g. "2026-12-31"
  createdAt: string; // "YYYY-MM-DD"
  startWeightLbs: number; // Valeur au point de départ
  note?: string; // ex. "Avant 2027"
}

export interface GoalProgress {
  goal: WorkoutGoal;
  currentValueLbs: number;
  startValueLbs: number;
  targetValueLbs: number;
  progressPercent: number; // 0 to 100
  remainingWeightLbs: number;
  daysRemaining: number;
  isAchieved: boolean;
  achievedDate?: string;
  status: 'achieved' | 'on_track' | 'behind' | 'expired';
  statusLabel: string;
}
