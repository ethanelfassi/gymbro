'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { WorkoutGoal, WorkoutSession, UnitSystem, GoalMetric } from '@/lib/types';
import { calculateGoalProgress, formatGoalValue, formatGoalMetricLabel, formatGoalPace } from '@/lib/goals';
import { getExerciseMeta, getMechanicLabel } from '@/lib/taxonomy';
import { lbsToKg, kgToLbs } from '@/lib/analytics';
import {
  Target,
  Plus,
  CheckCircle2,
  Clock,
  TrendingUp,
  Trash2,
  Edit2,
  ArrowUpRight,
  AlertCircle,
  X,
  Calendar,
} from 'lucide-react';

interface GoalsTabProps {
  goals: WorkoutGoal[];
  sessions: WorkoutSession[];
  unit: UnitSystem;
  bodyweightLbs: number;
  onSelectExercise: (name: string) => void;
  onSaveGoal: (goal: WorkoutGoal) => void;
  onDeleteGoal: (goalId: string) => void;
}

export const GoalsTab: React.FC<GoalsTabProps> = ({
  goals,
  sessions,
  unit,
  bodyweightLbs,
  onSelectExercise,
  onSaveGoal,
  onDeleteGoal,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<WorkoutGoal | null>(null);

  // Form State
  const [formExName, setFormExName] = useState<string>('');
  const [formMetric, setFormMetric] = useState<GoalMetric>('1rm');
  const [formWeight, setFormWeight] = useState<string>('150');
  const [formReps, setFormReps] = useState<string>('8');
  const [formDate, setFormDate] = useState<string>('2026-12-31');
  const [formStartWeight, setFormStartWeight] = useState<string>('130');
  const [formNote, setFormNote] = useState<string>('');

  // Extract list of all unique exercise names from sessions
  const availableExercises = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions) {
      for (const ex of s.exercises) {
        if (ex.meta.category !== 'Cardio') {
          set.add(ex.name);
        }
      }
    }
    return Array.from(set).sort();
  }, [sessions]);

  // Compute progress for each goal
  const progressList = useMemo(() => {
    return goals.map((g) => calculateGoalProgress(g, sessions, bodyweightLbs));
  }, [goals, sessions, bodyweightLbs]);

  // High-level statistics
  const stats = useMemo(() => {
    const total = progressList.length;
    const achieved = progressList.filter((p) => p.isAchieved).length;
    const onTrack = progressList.filter((p) => !p.isAchieved && (p.status === 'on_track' || p.status === 'ahead')).length;
    const avgProgress = total > 0
      ? Math.round(progressList.reduce((acc, p) => acc + p.progressPercent, 0) / total)
      : 0;

    return { total, achieved, onTrack, avgProgress };
  }, [progressList]);

  const selectedMeta = useMemo(
    () => getExerciseMeta(formExName || 'Développé couché'),
    [formExName]
  );

  const allowedMetrics = useMemo<GoalMetric[]>(() => {
    if (selectedMeta.mechanic === 'duration') return ['duration'];
    if (selectedMeta.mechanic === 'bodyweight') return ['reps', 'top_weight'];
    return ['top_weight', '1rm'];
  }, [selectedMeta.mechanic]);

  const computeExerciseDefaults = useCallback(
    (exName: string, overrideMetric?: GoalMetric) => {
      const meta = getExerciseMeta(exName);
      const blockSessions = sessions.filter((s) => s.dateStr >= '2026-08-01');
      const pool = blockSessions.length > 0 ? blockSessions : sessions;

      const defaultMetric: GoalMetric =
        overrideMetric ||
        (meta.mechanic === 'duration'
          ? 'duration'
          : meta.mechanic === 'bodyweight'
          ? 'reps'
          : 'top_weight');

      const exEntries: {
        topWeight: number;
        sets: WorkoutSession['exercises'][0]['sets'];
      }[] = [];

      for (const s of pool) {
        const found = s.exercises.find((e) => e.name === exName);
        if (found && found.sets.length > 0) {
          exEntries.push({ topWeight: found.topSetWeightLbs, sets: found.sets });
        }
      }

      const toDisplayWeight = (lbs: number) =>
        unit === 'kg' ? lbsToKg(lbs) : Math.round(lbs * 10) / 10;

      if (defaultMetric === 'duration') {
        const firstEntry = exEntries[0];
        const firstSec = firstEntry
          ? Math.max(0, ...firstEntry.sets.map((st) => st.durationSeconds))
          : 15;
        const maxSec = exEntries.reduce(
          (acc, e) => Math.max(acc, ...e.sets.map((st) => st.durationSeconds)),
          0
        );
        const startVal = firstSec > 0 ? firstSec : 15;
        const targetVal = Math.max(startVal + 15, (maxSec > 0 ? maxSec : 30) + 15);
        return {
          metric: defaultMetric,
          start: String(startVal),
          target: String(targetVal),
          reps: '8',
        };
      }

      if (defaultMetric === 'reps') {
        const firstEntry = exEntries[0];
        const firstReps = firstEntry
          ? Math.max(0, ...firstEntry.sets.filter((st) => !st.isWarmup).map((st) => st.reps))
          : 6;
        const maxReps = exEntries.reduce(
          (acc, e) =>
            Math.max(acc, ...e.sets.filter((st) => !st.isWarmup).map((st) => st.reps)),
          0
        );
        const startVal = firstReps > 0 ? firstReps : 6;
        const targetVal = Math.max(startVal + 3, (maxReps > 0 ? maxReps : 8) + 4);
        return {
          metric: defaultMetric,
          start: String(startVal),
          target: String(targetVal),
          reps: String(targetVal),
        };
      }

      if (meta.mechanic === 'assisted') {
        if (defaultMetric === '1rm') {
          const calcNet1rm = (w: number, r: number) =>
            Math.round(Math.max(5, bodyweightLbs - w) * (1 + r / 30));
          const firstEntry = exEntries[0];
          const first1rm = firstEntry
            ? Math.max(
                0,
                ...firstEntry.sets
                  .filter((st) => !st.isWarmup)
                  .map((st) => calcNet1rm(st.weightLbs, st.reps))
              )
            : 95;
          const max1rm = exEntries.reduce(
            (acc, e) =>
              Math.max(
                acc,
                ...e.sets
                  .filter((st) => !st.isWarmup)
                  .map((st) => calcNet1rm(st.weightLbs, st.reps))
              ),
            0
          );
          const startLbs = first1rm > 0 ? first1rm : 95;
          const targetLbs = Math.max(startLbs + 15, (max1rm > 0 ? max1rm : 110) + 15);
          return {
            metric: defaultMetric,
            start: String(toDisplayWeight(startLbs)),
            target: String(toDisplayWeight(targetLbs)),
            reps: '8',
          };
        }

        // Assistance machine weight (lower = harder)
        const firstEntry = exEntries[0];
        const firstAssist = firstEntry
          ? Math.max(
              ...firstEntry.sets
                .filter((st) => !st.isWarmup)
                .map((st) => st.weightLbs)
            )
          : 90;
        const workingAssists = exEntries.flatMap((e) =>
          e.sets.filter((st) => !st.isWarmup).map((st) => st.weightLbs)
        );
        const minAssist = workingAssists.length > 0 ? Math.min(...workingAssists) : 75;
        const startLbs = Number.isFinite(firstAssist) && firstAssist > 0 ? firstAssist : 90;
        const targetLbs = Math.max(0, Math.round((minAssist - 20) * 10) / 10);
        return {
          metric: defaultMetric,
          start: String(toDisplayWeight(startLbs)),
          target: String(toDisplayWeight(targetLbs)),
          reps: '8',
        };
      }

      // Standard or weighted bodyweight
      if (defaultMetric === '1rm') {
        const firstEntry = exEntries[0];
        const first1rm = firstEntry
          ? Math.max(
              0,
              ...firstEntry.sets
                .filter((st) => !st.isWarmup)
                .map((st) => st.estimated1rmLbs)
            )
          : 120;
        const max1rm = exEntries.reduce(
          (acc, e) =>
            Math.max(
              acc,
              ...e.sets
                .filter((st) => !st.isWarmup)
                .map((st) => st.estimated1rmLbs)
            ),
          0
        );
        const startLbs = first1rm > 0 ? first1rm : 120;
        const targetLbs = Math.max(startLbs + 15, (max1rm > 0 ? max1rm : 140) + 20);
        return {
          metric: defaultMetric,
          start: String(toDisplayWeight(startLbs)),
          target: String(toDisplayWeight(targetLbs)),
          reps: '8',
        };
      }

      const firstTop = exEntries[0]?.topWeight ?? (meta.mechanic === 'bodyweight' ? 0 : 100);
      const maxTop = exEntries.reduce((acc, e) => Math.max(acc, e.topWeight), 0);
      const startLbs = meta.mechanic === 'bodyweight' ? firstTop : firstTop > 0 ? firstTop : 100;
      const targetLbs =
        meta.mechanic === 'bodyweight'
          ? (maxTop > 0 ? maxTop + 10 : 15)
          : Math.max(startLbs + 15, (maxTop > 0 ? maxTop : 115) + 15);
      return {
        metric: defaultMetric,
        start: String(toDisplayWeight(startLbs)),
        target: String(toDisplayWeight(targetLbs)),
        reps: '8',
      };
    },
    [sessions, unit, bodyweightLbs]
  );

  const openNewGoalModal = () => {
    setEditingGoal(null);
    const defaultEx = availableExercises.length > 0 ? availableExercises[0] : 'Développé couché';
    const defaults = computeExerciseDefaults(defaultEx);
    setFormExName(defaultEx);
    setFormMetric(defaults.metric);
    setFormWeight(defaults.target);
    setFormReps(defaults.reps);
    setFormDate('2026-12-31');
    setFormStartWeight(defaults.start);
    setFormNote('Avant 2027');
    setIsModalOpen(true);
  };

  const openEditModal = (goal: WorkoutGoal) => {
    const isWeightMetric = goal.targetMetric === '1rm' || goal.targetMetric === 'top_weight';
    setEditingGoal(goal);
    setFormExName(goal.exerciseName);
    setFormMetric(goal.targetMetric);
    setFormWeight(String(isWeightMetric && unit === 'kg' ? lbsToKg(goal.targetWeightLbs) : goal.targetWeightLbs));
    setFormReps(String(goal.targetReps || 8));
    setFormDate(goal.targetDate);
    setFormStartWeight(String(isWeightMetric && unit === 'kg' ? lbsToKg(goal.startWeightLbs) : goal.startWeightLbs));
    setFormNote(goal.note || '');
    setIsModalOpen(true);
  };

  const handleExerciseChange = (nextEx: string) => {
    setFormExName(nextEx);
    if (!editingGoal) {
      const defaults = computeExerciseDefaults(nextEx);
      setFormMetric(defaults.metric);
      setFormWeight(defaults.target);
      setFormReps(defaults.reps);
      setFormStartWeight(defaults.start);
    } else {
      const nextMeta = getExerciseMeta(nextEx);
      const nextAllowed: GoalMetric[] =
        nextMeta.mechanic === 'duration'
          ? ['duration']
          : nextMeta.mechanic === 'bodyweight'
          ? ['reps', 'top_weight']
          : ['top_weight', '1rm'];
      if (!nextAllowed.includes(formMetric)) {
        const defaults = computeExerciseDefaults(nextEx);
        setFormMetric(defaults.metric);
        setFormWeight(defaults.target);
        setFormReps(defaults.reps);
        setFormStartWeight(defaults.start);
      }
    }
  };

  const handleMetricChange = (nextMetric: GoalMetric) => {
    if (nextMetric === formMetric) return;
    if (!editingGoal) {
      const defaults = computeExerciseDefaults(formExName, nextMetric);
      setFormMetric(defaults.metric);
      setFormWeight(defaults.target);
      setFormReps(defaults.reps);
      setFormStartWeight(defaults.start);
    } else {
      setFormMetric(nextMetric);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawTargetWeight = parseFloat(formWeight);
    const rawStartWeight = parseFloat(formStartWeight);

    const allowZeroTarget =
      formMetric === 'top_weight' &&
      (selectedMeta.mechanic === 'assisted' || selectedMeta.mechanic === 'bodyweight');

    if (
      isNaN(rawTargetWeight) ||
      rawTargetWeight < 0 ||
      (!allowZeroTarget && rawTargetWeight === 0)
    ) {
      return;
    }

    const isWeightMetric = formMetric === '1rm' || formMetric === 'top_weight';

    // Convert to lbs only for weight-based metrics if entered in kg
    const targetWeightLbs = isWeightMetric && unit === 'kg' ? kgToLbs(rawTargetWeight) : rawTargetWeight;
    const fallbackStartLbs =
      selectedMeta.mechanic === 'assisted' && formMetric === 'top_weight'
        ? targetWeightLbs + 20
        : targetWeightLbs * 0.8;
    const startWeightLbs = !isNaN(rawStartWeight)
      ? (isWeightMetric && unit === 'kg' ? kgToLbs(rawStartWeight) : rawStartWeight)
      : fallbackStartLbs;

    const goalToSave: WorkoutGoal = {
      id: editingGoal ? editingGoal.id : `goal-${Date.now()}`,
      exerciseName: formExName,
      targetMetric: formMetric,
      targetWeightLbs: Math.round(targetWeightLbs * 10) / 10,
      targetReps: formMetric === 'top_weight' ? parseInt(formReps, 10) || 8 : undefined,
      targetDate: formDate,
      createdAt: editingGoal ? editingGoal.createdAt : new Date().toISOString().split('T')[0],
      startWeightLbs: Math.round(startWeightLbs * 10) / 10,
      note: formNote.trim() || undefined,
    };

    onSaveGoal(goalToSave);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header & New Goal CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-lg bg-zinc-900/60 border border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-zinc-300" />
            <h2 className="text-base font-semibold tracking-wide text-zinc-100 uppercase">
              Objectifs & Cibles de Performance
            </h2>
          </div>
          <p className="text-xs text-zinc-500 font-mono mt-1">
            Fixe des cibles précises et mesure ton avancement séance après séance
          </p>
        </div>

        <button
          onClick={openNewGoalModal}
          className="px-3.5 py-2 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-semibold font-mono flex items-center gap-2 shadow-sm transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvel Objectif</span>
        </button>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800">
          <div className="text-xs font-mono text-zinc-500 uppercase">Objectifs totaux</div>
          <div className="text-2xl font-mono font-semibold text-zinc-100 mt-1">
            {stats.total}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800">
          <div className="text-xs font-mono text-zinc-500 uppercase">En bonne voie / Avance</div>
          <div className="text-2xl font-mono font-semibold text-blue-400 mt-1">
            {stats.onTrack}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800">
          <div className="text-xs font-mono text-zinc-500 uppercase">Atteints</div>
          <div className="text-2xl font-mono font-semibold text-emerald-400 mt-1">
            {stats.achieved}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800">
          <div className="text-xs font-mono text-zinc-500 uppercase">Avancement moyen</div>
          <div className="text-2xl font-mono font-semibold text-zinc-100 mt-1">
            {stats.avgProgress}%
          </div>
        </div>
      </div>

      {/* Goals List */}
      <div className="space-y-4">
        {progressList.length === 0 ? (
          <div className="p-8 rounded-lg bg-zinc-900/30 border border-zinc-800 text-center font-mono text-xs text-zinc-500 space-y-3">
            <div>Aucun objectif enregistré pour le moment.</div>
            <button
              onClick={openNewGoalModal}
              className="text-zinc-200 underline underline-offset-2 hover:text-white"
            >
              Créer ton premier objectif
            </button>
          </div>
        ) : (
          progressList.map((item) => {
            const g = item.goal;
            const targetDisplay = formatGoalValue(g.targetWeightLbs, g.targetMetric, unit, item.mechanic);
            const currentDisplay = formatGoalValue(item.currentValueLbs, g.targetMetric, unit, item.mechanic);
            const startDisplay = formatGoalValue(item.startValueLbs, g.targetMetric, unit, item.mechanic);
            const remainingDisplay = formatGoalValue(item.remainingWeightLbs, g.targetMetric, unit, item.mechanic);
            const metricLabel = formatGoalMetricLabel(g);

            let badgeStyle = 'bg-zinc-800 text-zinc-300 border-zinc-700';
            if (item.status === 'achieved') {
              badgeStyle = 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
            } else if (item.status === 'ahead') {
              badgeStyle = 'bg-sky-950/80 text-sky-300 border-sky-800';
            } else if (item.status === 'on_track') {
              badgeStyle = 'bg-blue-950/80 text-blue-300 border-blue-800';
            } else if (item.status === 'behind') {
              badgeStyle = 'bg-amber-950/80 text-amber-300 border-amber-800';
            } else if (item.status === 'expired') {
              badgeStyle = 'bg-rose-950/80 text-rose-300 border-rose-800';
            }

            return (
              <div
                key={g.id}
                className="p-5 rounded-lg bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700/80 transition-colors space-y-4"
              >
                {/* Header: Exercise title, status badge & action buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => onSelectExercise(g.exerciseName)}
                      className="font-semibold text-zinc-100 text-base hover:text-blue-400 flex items-center gap-1.5 transition-colors text-left"
                    >
                      <span>{g.exerciseName}</span>
                      <ArrowUpRight className="w-4 h-4 text-zinc-500" />
                    </button>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${badgeStyle}`}>
                      {item.statusLabel}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-950 border border-zinc-800 text-zinc-400">
                      {getMechanicLabel(item.mechanic)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() => openEditModal(g)}
                      className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                      title="Modifier cet objectif"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteGoal(g.id)}
                      className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-rose-400 transition-colors"
                      title="Supprimer cet objectif"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Target Metric Readout & Key Values */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                  <div className="p-2.5 rounded bg-zinc-950/70 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 block uppercase">Cible</span>
                    <span className="text-sm font-semibold text-zinc-100">
                      {targetDisplay}
                    </span>
                    <span className="text-[10px] text-zinc-500 ml-1">
                      ({metricLabel})
                    </span>
                  </div>

                  <div className="p-2.5 rounded bg-zinc-950/70 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 block uppercase">Actuel</span>
                    <span className="text-sm font-semibold text-zinc-100">
                      {currentDisplay}
                    </span>
                  </div>

                  <div className="p-2.5 rounded bg-zinc-950/70 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 block uppercase">Reste &amp; Rythme</span>
                    <span className={`text-sm font-semibold ${item.isAchieved ? 'text-emerald-400' : 'text-zinc-200'}`}>
                      {item.isAchieved
                        ? 'Atteint !'
                        : item.remainingWeightLbs <= 0
                        ? `Valider ${g.targetReps || 8} réps`
                        : item.mechanic === 'assisted' && g.targetMetric !== '1rm'
                        ? remainingDisplay
                        : `+${remainingDisplay}`}
                    </span>
                    {!item.isAchieved && item.daysRemaining >= 0 && item.remainingWeightLbs > 0 && (
                      <span className="text-[10px] text-zinc-500 block mt-0.5">
                        Requis : {formatGoalPace(item.requiredWeeklyPace, g.targetMetric, unit, item.mechanic)}
                      </span>
                    )}
                  </div>

                  <div className="p-2.5 rounded bg-zinc-950/70 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 block uppercase">Échéance &amp; Proj.</span>
                    <span className="text-xs font-semibold text-zinc-200">
                      {g.targetDate}
                    </span>
                    <span className="text-[10px] text-zinc-500 block mt-0.5">
                      {item.isAchieved && item.achievedDate
                        ? `Validé le ${item.achievedDate}`
                        : item.projectedDate && item.daysRemaining >= 0
                        ? `Proj. : ${item.projectedDate} (${item.daysRemaining}j)`
                        : item.daysRemaining >= 0
                        ? `Dans ${item.daysRemaining} jour${item.daysRemaining > 1 ? 's' : ''}`
                        : 'Date dépassée'}
                    </span>
                  </div>
                </div>

                {/* Visual Progress Bar with Temporal Benchmark Marker */}
                <div className="space-y-1.5 font-mono">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-zinc-400">
                    <span>
                      Avancement : <strong className="text-zinc-200">{item.progressPercent}%</strong>{' '}
                      <span className="text-[11px] text-zinc-500">
                        (Temps écoulé : {item.timeElapsedPercent}% &bull;{' '}
                        <span
                          className={
                            item.scheduleDelta >= 10
                              ? 'text-sky-400'
                              : item.scheduleDelta >= -10
                              ? 'text-zinc-400'
                              : 'text-amber-400'
                          }
                        >
                          {item.scheduleDelta >= 0 ? `+${item.scheduleDelta}% d'avance` : `${item.scheduleDelta}% vs calendrier`}
                        </span>
                        )
                      </span>
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      Départ : {startDisplay} &rarr; Cible : {targetDisplay}
                    </span>
                  </div>

                  <div className="relative w-full h-2.5 rounded-full bg-zinc-950 border border-zinc-800 overflow-hidden">
                    <div
                      style={{ width: `${item.progressPercent}%` }}
                      className={`h-full transition-all duration-500 ${
                        item.isAchieved
                          ? 'bg-emerald-500'
                          : item.status === 'ahead'
                          ? 'bg-sky-400'
                          : item.status === 'on_track'
                          ? 'bg-blue-500'
                          : 'bg-amber-500'
                      }`}
                    />
                    {!item.isAchieved && item.daysRemaining >= 0 && (
                      <div
                        style={{ left: `${item.timeElapsedPercent}%` }}
                        className="absolute top-0 bottom-0 w-0.5 bg-zinc-200/80"
                        title={`Temps écoulé depuis le ${item.effectiveStartDate} : ${item.timeElapsedPercent}%`}
                      />
                    )}
                  </div>
                </div>

                {/* Optional Note */}
                {g.note && (
                  <div className="text-xs text-zinc-400 font-mono italic pt-1 border-t border-zinc-800/60">
                    Note : &ldquo;{g.note}&rdquo;
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal / Formulaire d'ajout / édition */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0E1116] border border-zinc-800 rounded-lg shadow-xl overflow-hidden font-mono text-xs">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h3 className="font-semibold uppercase tracking-wider text-zinc-100">
                {editingGoal ? 'Modifier l’objectif' : 'Nouvel objectif'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="p-4 space-y-4">
              
              {/* Exercise Selector */}
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-zinc-400 text-[11px] uppercase">Exercice</label>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-300">
                    {getMechanicLabel(selectedMeta.mechanic)}
                  </span>
                </div>
                <select
                  value={formExName}
                  onChange={(e) => handleExerciseChange(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2 rounded focus:outline-none focus:border-zinc-700"
                >
                  {availableExercises.map((ex) => (
                    <option key={ex} value={ex}>
                      {ex}
                    </option>
                  ))}
                </select>
              </div>

              {/* Metric Type */}
              <div className="space-y-1">
                <label className="text-zinc-400 text-[11px] uppercase">Type de métrique</label>
                <div className={`grid gap-2 ${allowedMetrics.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {allowedMetrics.map((m) => {
                    const label =
                      m === 'duration'
                        ? 'Durée (sec)'
                        : m === 'reps'
                        ? 'Répétitions (PDC)'
                        : m === '1rm'
                        ? selectedMeta.mechanic === 'assisted'
                          ? '1RM Net Estimé'
                          : '1RM Estimé'
                        : selectedMeta.mechanic === 'assisted'
                        ? 'Assistance (-Charge × Réps)'
                        : selectedMeta.mechanic === 'bodyweight'
                        ? 'Top Set Lesté (+Charge)'
                        : 'Top Set (Charge × Réps)';
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleMetricChange(m)}
                        className={`p-2 rounded border text-center transition-colors ${
                          formMetric === m
                            ? 'bg-zinc-800 border-zinc-700 text-zinc-100 font-semibold'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Weight / Reps / Duration & Start Value */}
              <div className={`grid gap-3 ${formMetric === 'top_weight' ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2'}`}>
                <div className="space-y-1">
                  <label className="text-zinc-400 text-[11px] uppercase">
                    {formMetric === 'reps'
                      ? 'Réps Cibles'
                      : formMetric === 'duration'
                      ? 'Durée Cible (sec)'
                      : selectedMeta.mechanic === 'assisted' && formMetric === 'top_weight'
                      ? `Assist. Cible (${unit.toUpperCase()})`
                      : selectedMeta.mechanic === 'bodyweight' && formMetric === 'top_weight'
                      ? `Lest Cible (${unit.toUpperCase()})`
                      : `Charge Cible (${unit.toUpperCase()})`}
                  </label>
                  <input
                    type="number"
                    min={
                      selectedMeta.mechanic === 'assisted' || selectedMeta.mechanic === 'bodyweight'
                        ? '0'
                        : '0.5'
                    }
                    step={formMetric === 'reps' || formMetric === 'duration' ? '1' : '0.5'}
                    value={formWeight}
                    onChange={(e) => setFormWeight(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2 rounded focus:outline-none focus:border-zinc-700"
                    required
                  />
                </div>

                {formMetric === 'top_weight' && (
                  <div className="space-y-1">
                    <label className="text-zinc-400 text-[11px] uppercase">Réps Cibles</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={formReps}
                      onChange={(e) => setFormReps(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2 rounded focus:outline-none focus:border-zinc-700"
                      required
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-zinc-400 text-[11px] uppercase">
                    {formMetric === 'reps'
                      ? 'Départ (réps)'
                      : formMetric === 'duration'
                      ? 'Départ (sec)'
                      : selectedMeta.mechanic === 'assisted' && formMetric === 'top_weight'
                      ? `Assist. Départ (${unit.toUpperCase()})`
                      : selectedMeta.mechanic === 'bodyweight' && formMetric === 'top_weight'
                      ? `Lest Départ (${unit.toUpperCase()})`
                      : `Départ (${unit.toUpperCase()})`}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step={formMetric === 'reps' || formMetric === 'duration' ? '1' : '0.5'}
                    value={formStartWeight}
                    onChange={(e) => setFormStartWeight(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2 rounded focus:outline-none focus:border-zinc-700"
                    required
                  />
                </div>
              </div>

              {selectedMeta.mechanic === 'assisted' && formMetric === 'top_weight' && (
                <p className="text-[11px] text-zinc-400 bg-zinc-950/80 border border-zinc-800/80 p-2 rounded">
                  Plus l&apos;assistance est basse, plus l&apos;exercice est difficile (0 = sans assistance au poids du corps).
                </p>
              )}

              {/* Target Date */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-zinc-400 text-[11px] uppercase">Date Cible / Deadline</label>
                  <div className="flex gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setFormDate('2026-12-31')}
                      className="text-zinc-400 hover:text-zinc-200 underline"
                    >
                      Fin 2026
                    </button>
                    <span>&bull;</span>
                    <button
                      type="button"
                      onClick={() => setFormDate('2027-03-31')}
                      className="text-zinc-400 hover:text-zinc-200 underline"
                    >
                      Mars 2027
                    </button>
                  </div>
                </div>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2 rounded focus:outline-none focus:border-zinc-700"
                  required
                />
              </div>

              {/* Note */}
              <div className="space-y-1">
                <label className="text-zinc-400 text-[11px] uppercase">Note / Description (optionnel)</label>
                <input
                  type="text"
                  placeholder="ex: Passer 175 lbs avant 2027"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2 rounded focus:outline-none focus:border-zinc-700"
                />
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-semibold transition-colors"
                >
                  Enregistrer
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
