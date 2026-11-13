'use client';

import React, { useState, useMemo } from 'react';
import { WorkoutSession, UnitSystem, WorkoutGoal } from '@/lib/types';
import { formatWeight, lbsToKg, estimate1rm } from '@/lib/analytics';
import { calculateGoalProgress, formatGoalValue, formatGoalMetricLabel, formatGoalPace } from '@/lib/goals';
import { getExerciseMeta } from '@/lib/taxonomy';
import { Search, Trophy, History, FileText, Target } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';

interface ExerciseTabProps {
  sessions: WorkoutSession[];
  unit: UnitSystem;
  bodyweightLbs: number;
  selectedExerciseName?: string;
  onSelectExercise: (name: string) => void;
  allExerciseNotes?: Map<string, string[]>;
  goals?: WorkoutGoal[];
}

export const ExerciseTab: React.FC<ExerciseTabProps> = ({
  sessions,
  unit,
  bodyweightLbs,
  selectedExerciseName,
  onSelectExercise,
  allExerciseNotes,
  goals,
}) => {
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<string>('Tous');
  const [metricView, setMetricView] = useState<'1rm' | 'top_set' | 'volume'>('1rm');
  const [useEffectiveLoad, setUseEffectiveLoad] = useState<boolean>(true);

  // Collect all unique exercises with their occurrence counts
  const exerciseList = useMemo(() => {
    const countMap = new Map<string, { count: number; lastDate: string }>();

    for (const s of sessions) {
      for (const ex of s.exercises) {
        if (ex.meta.category === 'Cardio') continue;
        const existing = countMap.get(ex.name) || { count: 0, lastDate: s.dateStr };
        countMap.set(ex.name, {
          count: existing.count + 1,
          lastDate: s.dateStr,
        });
      }
    }

    const list = Array.from(countMap.entries()).map(([name, data]) => ({
      name,
      meta: getExerciseMeta(name),
      count: data.count,
      lastDate: data.lastDate,
    }));

    // Sort by count descending
    list.sort((a, b) => b.count - a.count);
    return list;
  }, [sessions]);

  // Selected exercise (default to top exercise if none selected)
  const currentEx = selectedExerciseName || (exerciseList.length > 0 ? exerciseList[0].name : '');
  const currentMeta = useMemo(() => getExerciseMeta(currentEx), [currentEx]);

  // Filtered exercise options for sidebar/dropdown
  const filteredExercises = useMemo(() => {
    return exerciseList.filter((item) => {
      const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;
      if (muscleFilter === 'Tous') return true;
      if (muscleFilter === 'Pectoraux' && item.meta.primaryMuscle === 'Pectoraux') return true;
      if (muscleFilter === 'Dos' && item.meta.primaryMuscle === 'Dos') return true;
      if (muscleFilter === 'Épaules' && item.meta.primaryMuscle.includes('Épaules')) return true;
      if (muscleFilter === 'Bras' && (item.meta.primaryMuscle === 'Biceps' || item.meta.primaryMuscle === 'Triceps' || item.meta.primaryMuscle === 'Avant-bras')) return true;
      if (muscleFilter === 'Jambes' && (item.meta.primaryMuscle === 'Quadriceps' || item.meta.primaryMuscle === 'Ischios & Fessiers' || item.meta.primaryMuscle === 'Mollets')) return true;
      return false;
    });
  }, [exerciseList, search, muscleFilter]);

  // Historical data points for selected exercise
  const exerciseData = useMemo(() => {
    if (!currentEx) return [];

    const data: {
      date: string;
      topWeight: number;
      rawTopWeight: number;
      topReps: number;
      topSetScore: number;
      est1rm: number;
      volume: number;
      topDuration: number;
      totalDuration: number;
      workingSetsCount: number;
      sets: typeof sessions[0]['exercises'][0]['sets'];
    }[] = [];

    for (const s of sessions) {
      const ex = s.exercises.find((e) => e.name === currentEx);
      if (!ex || ex.sets.length === 0) continue;

      const workingSets = ex.sets.filter((st) => !st.isWarmup);
      const setsToUse = workingSets.length > 0 ? workingSets : ex.sets;
      const topDuration = ex.topSetDurationSeconds || Math.max(0, ...setsToUse.map((st) => st.durationSeconds));
      const totalDuration = ex.totalDurationSeconds || setsToUse.reduce((acc, st) => acc + st.durationSeconds, 0);

      if (currentMeta.mechanic === 'duration') {
        data.push({
          date: s.dateStr,
          topWeight: 0,
          rawTopWeight: 0,
          topReps: ex.topSetReps,
          topSetScore: topDuration,
          est1rm: topDuration,
          volume: totalDuration,
          topDuration,
          totalDuration,
          workingSetsCount: setsToUse.length,
          sets: ex.sets,
        });
        continue;
      }

      let est1rm = ex.topSet1rmLbs;
      let topWeight = ex.topSetWeightLbs;
      let rawVolumeLbs = ex.totalVolumeLbs;

      if (currentMeta.mechanic === 'assisted') {
        if (useEffectiveLoad) {
          topWeight = Math.max(5, bodyweightLbs - ex.topSetWeightLbs);
          est1rm = estimate1rm(topWeight, ex.topSetReps);
          rawVolumeLbs = setsToUse.reduce(
            (acc, st) => acc + Math.max(5, bodyweightLbs - st.weightLbs) * st.reps,
            0
          );
        } else {
          topWeight = ex.topSetWeightLbs;
          est1rm = estimate1rm(topWeight, ex.topSetReps);
          rawVolumeLbs = setsToUse.reduce((acc, st) => acc + st.weightLbs * st.reps, 0);
        }
      } else if (currentMeta.mechanic === 'bodyweight') {
        if (useEffectiveLoad) {
          topWeight = bodyweightLbs + ex.topSetWeightLbs;
          est1rm = estimate1rm(topWeight, ex.topSetReps);
          rawVolumeLbs = setsToUse.reduce(
            (acc, st) => acc + (bodyweightLbs + st.weightLbs) * st.reps,
            0
          );
        } else {
          topWeight = ex.topSetWeightLbs;
          est1rm = topWeight > 0 ? estimate1rm(topWeight, ex.topSetReps) : ex.topSetReps;
          rawVolumeLbs = setsToUse.reduce(
            (acc, st) => acc + (st.weightLbs > 0 ? st.weightLbs * st.reps : st.reps),
            0
          );
        }
      }

      const displayWeight = unit === 'kg' ? lbsToKg(topWeight) : topWeight;
      const topSetScore =
        displayWeight > 0
          ? Math.round(displayWeight * ex.topSetReps * 10) / 10
          : ex.topSetReps;

      data.push({
        date: s.dateStr,
        topWeight: displayWeight,
        rawTopWeight: ex.topSetWeightLbs,
        topReps: ex.topSetReps,
        topSetScore,
        est1rm:
          currentMeta.mechanic === 'bodyweight' && !useEffectiveLoad && ex.topSetWeightLbs === 0
            ? ex.topSetReps
            : unit === 'kg'
            ? lbsToKg(est1rm)
            : est1rm,
        volume:
          currentMeta.mechanic === 'bodyweight' && !useEffectiveLoad && ex.topSetWeightLbs === 0
            ? rawVolumeLbs
            : unit === 'kg'
            ? lbsToKg(rawVolumeLbs)
            : rawVolumeLbs,
        topDuration,
        totalDuration,
        workingSetsCount: setsToUse.length,
        sets: ex.sets,
      });
    }

    return data;
  }, [sessions, currentEx, currentMeta, useEffectiveLoad, bodyweightLbs, unit]);

  // Rep PRs calculation (1, 3, 5, 6, 8, 10, 12, 15 reps) - ranked by Charge * Réps
  const repRecords = useMemo(() => {
    const buckets = [1, 3, 5, 6, 8, 10, 12, 15];
    const bestByRep = new Map<
      number,
      { weight: number; rawWeight: number; reps: number; score: number; date: string }
    >();

    for (const d of exerciseData) {
      for (const st of d.sets) {
        if (st.isWarmup || st.reps <= 0) continue;
        let w = st.weightLbs;
        let scoreWeight = st.weightLbs;
        if (currentMeta.mechanic === 'assisted') {
          scoreWeight = Math.max(5, bodyweightLbs - st.weightLbs);
          w = useEffectiveLoad ? scoreWeight : st.weightLbs;
        } else if (currentMeta.mechanic === 'bodyweight') {
          scoreWeight = bodyweightLbs + st.weightLbs;
          w = useEffectiveLoad ? scoreWeight : st.weightLbs;
        }

        const score = scoreWeight * st.reps;

        // Find nearest bucket
        for (const b of buckets) {
          if (st.reps >= b) {
            const current = bestByRep.get(b);
            if (!current || score > current.score || (score === current.score && w > current.weight)) {
              bestByRep.set(b, {
                weight: w,
                rawWeight: st.weightLbs,
                reps: st.reps,
                score,
                date: d.date,
              });
            }
          }
        }
      }
    }

    return buckets.map((b) => ({
      repCount: b,
      record: bestByRep.get(b),
    }));
  }, [exerciseData, currentMeta, useEffectiveLoad, bodyweightLbs]);

  // Duration records (for duration exercises like Dead Hang)
  const durationRecords = useMemo(() => {
    let maxDuration = 0;
    let maxDurationDate = '';
    let maxSessionTotal = 0;
    let maxSessionDate = '';
    let setsOver30s = 0;
    let totalCumulativeSec = 0;

    for (const d of exerciseData) {
      if (d.totalDuration > maxSessionTotal) {
        maxSessionTotal = d.totalDuration;
        maxSessionDate = d.date;
      }
      for (const st of d.sets) {
        if (st.isWarmup) continue;
        totalCumulativeSec += st.durationSeconds;
        if (st.durationSeconds >= 30) setsOver30s++;
        if (st.durationSeconds > maxDuration) {
          maxDuration = st.durationSeconds;
          maxDurationDate = d.date;
        }
      }
    }

    return {
      maxDuration,
      maxDurationDate,
      maxSessionTotal,
      maxSessionDate,
      setsOver30s,
      totalCumulativeSec,
    };
  }, [exerciseData]);

  // Extract unique notes for this exercise (including machine notes from any log)
  const exerciseNotes = useMemo(() => {
    const fromMap = allExerciseNotes?.get(currentEx) || [];
    const set = new Set<string>(fromMap);
    for (const d of exerciseData) {
      for (const st of d.sets) {
        if (st.notes && st.notes.trim()) {
          set.add(st.notes.trim());
        }
      }
    }
    return Array.from(set);
  }, [exerciseData, allExerciseNotes, currentEx]);

  // Active goal for this exercise if configured
  const activeGoal = useMemo(() => {
    return goals?.find((g) => g.exerciseName === currentEx);
  }, [goals, currentEx]);

  const goalProgress = useMemo(() => {
    if (!activeGoal) return null;
    return calculateGoalProgress(activeGoal, sessions, bodyweightLbs);
  }, [activeGoal, sessions, bodyweightLbs]);

  // Active chart data key
  const chartDataKey = useMemo(() => {
    if (currentMeta.mechanic === 'duration') {
      if (metricView === '1rm') return 'topDuration' as const;
      if (metricView === 'top_set') return 'totalDuration' as const;
      return 'workingSetsCount' as const;
    }
    if (metricView === '1rm') return 'est1rm' as const;
    if (metricView === 'top_set') return 'topSetScore' as const;
    return 'volume' as const;
  }, [currentMeta.mechanic, metricView]);

  // Target value for chart reference line if metric aligns
  const targetValueForChart = useMemo(() => {
    if (!activeGoal) return null;
    if (currentMeta.mechanic === 'duration' && activeGoal.targetMetric === 'duration') {
      if (metricView === '1rm') return activeGoal.targetWeightLbs;
      return null;
    }
    if (activeGoal.targetMetric === 'reps' && !useEffectiveLoad) {
      if (metricView === 'top_set' || metricView === '1rm') {
        return activeGoal.targetWeightLbs;
      }
      return null;
    }
    if (metricView === '1rm' && activeGoal.targetMetric === '1rm') {
      return unit === 'kg' ? lbsToKg(activeGoal.targetWeightLbs) : activeGoal.targetWeightLbs;
    }
    if (metricView === 'top_set' && activeGoal.targetMetric === 'top_weight') {
      const load = unit === 'kg' ? lbsToKg(activeGoal.targetWeightLbs) : activeGoal.targetWeightLbs;
      return Math.round(load * (activeGoal.targetReps || 1) * 10) / 10;
    }
    return null;
  }, [activeGoal, metricView, unit, currentMeta.mechanic, useEffectiveLoad]);

  const yDomain = useMemo(() => {
    if (exerciseData.length === 0) return ['auto', 'auto'];
    const values = exerciseData.map((d) => d[chartDataKey]);
    let minVal = Math.min(...values);
    let maxVal = Math.max(...values);
    if (targetValueForChart !== null) {
      minVal = Math.min(minVal, targetValueForChart);
      maxVal = Math.max(maxVal, targetValueForChart);
    }
    const padding = (maxVal - minVal) * 0.1 || 5;
    return [Math.max(0, Math.floor(minVal - padding)), Math.ceil(maxVal + padding)];
  }, [exerciseData, chartDataKey, targetValueForChart]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      
      {/* Left Column: Exercise Selector */}
      <div className="lg:col-span-1 space-y-3">
        <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-2">
          
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un exercice..."
              className="w-full bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 pl-8 pr-3 py-1.5 rounded focus:outline-none focus:border-zinc-700"
            />
          </div>

          {/* Muscle Filters */}
          <div className="flex flex-wrap gap-1 text-[11px]">
            {['Tous', 'Pectoraux', 'Dos', 'Épaules', 'Bras', 'Jambes'].map((m) => (
              <button
                key={m}
                onClick={() => setMuscleFilter(m)}
                className={`px-2 py-0.5 rounded font-mono ${
                  muscleFilter === m
                    ? 'bg-zinc-700 text-zinc-100 font-medium'
                    : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Exercise list */}
          <div className="max-h-[500px] overflow-y-auto space-y-1 pr-1 pt-1">
            {filteredExercises.map((item) => {
              const isSelected = item.name === currentEx;
              return (
                <button
                  key={item.name}
                  onClick={() => onSelectExercise(item.name)}
                  className={`w-full text-left p-2 rounded text-xs transition-colors flex items-center justify-between ${
                    isSelected
                      ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 font-medium'
                      : 'hover:bg-zinc-800/50 text-zinc-300'
                  }`}
                >
                  <div className="truncate mr-2">
                    <div className="truncate">{item.name}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      {item.meta.primaryMuscle}
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-zinc-500 shrink-0">
                    {item.count} s.
                  </div>
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* Right Column: Deep-Dive Chart, Records & Log */}
      <div className="lg:col-span-3 space-y-6">
        
        {/* Header of Exercise */}
        <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-zinc-100">{currentEx}</h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
                {currentMeta.category} &bull; {currentMeta.primaryMuscle}
              </span>
            </div>
            <p className="text-xs text-zinc-500 font-mono mt-1">
              {exerciseData.length} séances enregistrées dans cette période
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Assisted / Bodyweight toggle */}
            {currentMeta.mechanic === 'assisted' && (
              <button
                onClick={() => setUseEffectiveLoad(!useEffectiveLoad)}
                className={`px-2.5 py-1 rounded text-xs font-mono border transition-colors ${
                  useEffectiveLoad
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-200'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                }`}
                title="Déduire l'assistance du poids de corps pour afficher la charge réelle soulevée"
              >
                Charge nette (PDC - Assistance)
              </button>
            )}
            {currentMeta.mechanic === 'bodyweight' && (
              <button
                onClick={() => setUseEffectiveLoad(!useEffectiveLoad)}
                className={`px-2.5 py-1 rounded text-xs font-mono border transition-colors ${
                  useEffectiveLoad
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-200'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                }`}
                title="Inclure le poids de corps dans le calcul de charge et de 1RM"
              >
                Charge totale (PDC inclus)
              </button>
            )}

            {/* Metric Switcher */}
            <div className="inline-flex flex-wrap rounded-md bg-zinc-950 border border-zinc-800 p-0.5 text-xs font-mono">
              <button
                onClick={() => setMetricView('1rm')}
                className={`px-2 py-1 rounded ${
                  metricView === '1rm' ? 'bg-zinc-800 text-zinc-100 font-medium' : 'text-zinc-400'
                }`}
              >
                {currentMeta.mechanic === 'duration' ? 'Meilleure Série (sec)' : '1RM Estimé'}
              </button>
              <button
                onClick={() => setMetricView('top_set')}
                className={`px-2 py-1 rounded ${
                  metricView === 'top_set' ? 'bg-zinc-800 text-zinc-100 font-medium' : 'text-zinc-400'
                }`}
                title={
                  currentMeta.mechanic === 'duration'
                    ? 'Durée cumulée sur toute la séance'
                    : 'Top Set trié par Charge × Réps'
                }
              >
                {currentMeta.mechanic === 'duration'
                  ? 'Temps Cumulé (sec)'
                  : currentMeta.mechanic === 'bodyweight' && !useEffectiveLoad
                  ? 'Top Set (Réps)'
                  : 'Top Set (Charge × Réps)'}
              </button>
              <button
                onClick={() => setMetricView('volume')}
                className={`px-2 py-1 rounded ${
                  metricView === 'volume' ? 'bg-zinc-800 text-zinc-100 font-medium' : 'text-zinc-400'
                }`}
              >
                {currentMeta.mechanic === 'duration' ? 'Séries Effectives' : 'Volume Total'}
              </button>
            </div>
          </div>
        </div>

        {/* Active Goal Banner (if one exists for this exercise) */}
        {activeGoal && goalProgress && (
          <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Target className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-200">
                  Objectif Actif : {formatGoalMetricLabel(activeGoal)} &bull; {formatGoalValue(activeGoal.targetWeightLbs, activeGoal.targetMetric, unit)}
                </span>
                {activeGoal.note && (
                  <span className="text-[11px] text-zinc-400 font-mono">
                    ({activeGoal.note})
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                    goalProgress.status === 'achieved'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-medium'
                      : goalProgress.status === 'ahead'
                      ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                      : goalProgress.status === 'on_track'
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                      : goalProgress.status === 'behind'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}
                >
                  {goalProgress.statusLabel}
                </span>
                <span className="text-xs font-mono text-zinc-400">
                  {goalProgress.daysRemaining >= 0
                    ? `${goalProgress.daysRemaining} j restants (avant le ${activeGoal.targetDate})`
                    : `Échéance dépassée (${Math.abs(goalProgress.daysRemaining)} j)`}
                </span>
              </div>
            </div>

            {/* Progress Bar & Numeric readout */}
            <div className="space-y-1.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-mono">
                <span className="text-zinc-400">
                  Actuel : <span className="text-zinc-100 font-semibold">{formatGoalValue(goalProgress.currentValueLbs, activeGoal.targetMetric, unit)}</span>
                  {' '}/ Cible : <span className="text-zinc-100 font-semibold">{formatGoalValue(goalProgress.targetValueLbs, activeGoal.targetMetric, unit)}</span>
                </span>
                <span className="font-semibold text-zinc-200">
                  {goalProgress.progressPercent}%
                  {goalProgress.remainingWeightLbs > 0 && (
                    <span className="text-zinc-500 font-normal ml-1">
                      (reste {formatGoalValue(goalProgress.remainingWeightLbs, activeGoal.targetMetric, unit)} &bull; requis : {formatGoalPace(goalProgress.requiredWeeklyPace, activeGoal.targetMetric, unit)})
                    </span>
                  )}
                </span>
              </div>
              <div className="relative w-full bg-zinc-950 rounded-full h-2 overflow-hidden border border-zinc-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    goalProgress.isAchieved
                      ? 'bg-emerald-400'
                      : goalProgress.status === 'ahead'
                      ? 'bg-sky-400'
                      : goalProgress.status === 'on_track'
                      ? 'bg-blue-400'
                      : 'bg-amber-400'
                  }`}
                  style={{ width: `${goalProgress.progressPercent}%` }}
                />
                {!goalProgress.isAchieved && goalProgress.daysRemaining >= 0 && (
                  <div
                    style={{ left: `${goalProgress.timeElapsedPercent}%` }}
                    className="absolute top-0 bottom-0 w-0.5 bg-zinc-200/80"
                    title={`Temps écoulé : ${goalProgress.timeElapsedPercent}%`}
                  />
                )}
              </div>
              <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                <span>Temps écoulé : {goalProgress.timeElapsedPercent}% ({goalProgress.scheduleDelta >= 0 ? `+${goalProgress.scheduleDelta}% d'avance` : `${goalProgress.scheduleDelta}% vs calendrier`})</span>
                {goalProgress.projectedDate && !goalProgress.isAchieved && (
                  <span>Projection : {goalProgress.projectedDate}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Progression Chart */}
        <div className="p-5 rounded-lg bg-zinc-900/40 border border-zinc-800">
          <div className="h-72 w-full" style={{ minHeight: 288 }}>
            {exerciseData.length > 1 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={exerciseData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F242E" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#525B6C"
                    fontSize={11}
                    fontFamily="monospace"
                    tickFormatter={(val) => val.slice(5)} // MM-DD
                  />
                  <YAxis
                    stroke="#525B6C"
                    fontSize={11}
                    fontFamily="monospace"
                    domain={yDomain as any}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      const item = payload[0].payload;
                      return (
                        <div className="p-2.5 rounded bg-[#12151B] border border-[#262D38] text-xs font-mono space-y-1 shadow-lg">
                          <div className="font-semibold text-zinc-200 border-b border-zinc-800 pb-1">
                            Séance du {label}
                          </div>
                          {currentMeta.mechanic === 'duration' ? (
                            <>
                              <div className="text-zinc-300">
                                Meilleure série : <span className="font-semibold text-zinc-100">{item.topDuration} sec</span>
                              </div>
                              <div className="text-[11px] text-zinc-400">
                                Temps cumulé : <span className="font-semibold text-emerald-400">{item.totalDuration} sec</span>
                              </div>
                              <div className="text-[10px] text-zinc-500">
                                Séries : {item.workingSetsCount}
                              </div>
                            </>
                          ) : metricView === 'top_set' ? (
                            <>
                              <div className="text-zinc-300">
                                Top Set :{' '}
                                <span className="font-semibold text-zinc-100">
                                  {item.topWeight > 0 ? `${item.topWeight} ${unit}` : 'PDC'} &times; {item.topReps} réps
                                </span>
                              </div>
                              <div className="text-[11px] text-zinc-400">
                                Score (Charge &times; Réps) : <span className="font-semibold text-emerald-400">{item.topSetScore} {item.topWeight > 0 ? unit : 'réps'}</span>
                              </div>
                              <div className="text-[10px] text-zinc-500">
                                1RM Estimé : {item.est1rm} {item.topWeight > 0 ? unit : 'réps'}
                              </div>
                            </>
                          ) : metricView === '1rm' ? (
                            <>
                              <div className="text-zinc-300">
                                {item.topWeight > 0 ? '1RM Estimé' : 'Top Réps'} :{' '}
                                <span className="font-semibold text-zinc-100">
                                  {item.est1rm} {item.topWeight > 0 ? unit : 'réps'}
                                </span>
                              </div>
                              <div className="text-[11px] text-zinc-400">
                                Top Set : {item.topWeight > 0 ? `${item.topWeight} ${unit}` : 'PDC'} &times; {item.topReps} réps
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="text-zinc-300">
                                Volume séance : <span className="font-semibold text-zinc-100">{item.volume} {item.topWeight > 0 ? unit : 'réps'}</span>
                              </div>
                              <div className="text-[11px] text-zinc-400">
                                Top Set : {item.topWeight > 0 ? `${item.topWeight} ${unit}` : 'PDC'} &times; {item.topReps}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey={chartDataKey}
                    stroke="#38BDF8"
                    strokeWidth={2}
                    dot={{ fill: '#38BDF8', r: 3 }}
                    activeDot={{ r: 5, fill: '#FFFFFF' }}
                  />
                  {targetValueForChart !== null && (
                    <ReferenceLine
                      y={targetValueForChart}
                      stroke="#F59E0B"
                      strokeDasharray="4 4"
                      label={{
                        value: `Cible: ${targetValueForChart} ${
                          currentMeta.mechanic === 'duration'
                            ? 'sec'
                            : activeGoal?.targetMetric === 'reps' && !useEffectiveLoad
                            ? 'réps'
                            : unit
                        }`,
                        fill: '#F59E0B',
                        fontSize: 10,
                        fontFamily: 'monospace',
                        position: 'right',
                      }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-zinc-500 font-mono">
                Pas assez de données pour tracer la courbe sur cette période
              </div>
            )}
          </div>
        </div>

        {/* Machine Notes if present */}
        {exerciseNotes.length > 0 && (
          <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs font-mono space-y-2">
            <div className="flex items-center gap-2 text-zinc-400 font-semibold uppercase text-[11px] tracking-wider">
              <FileText className="w-3.5 h-3.5 text-zinc-400" />
              <span>Notes & Réglages Machines Récents</span>
            </div>
            <div className="space-y-1.5 pt-1">
              {exerciseNotes.map((note, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded bg-zinc-950 border border-zinc-800/60 text-zinc-300 whitespace-pre-line text-[11px]"
                >
                  {note}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rep PRs / Duration PRs Table */}
        <div className="p-5 rounded-lg bg-zinc-900/40 border border-zinc-800">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-zinc-400" />
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-200">
              {currentMeta.mechanic === 'duration'
                ? 'Records de Maintien & Endurance'
                : 'Tableau des Records Personnels par Palier de Répétitions'}
            </h3>
          </div>

          {currentMeta.mechanic === 'duration' ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
              <div className="p-2.5 rounded bg-zinc-900/80 border border-zinc-800/80">
                <div className="text-[11px] text-zinc-500">Record Absolu</div>
                <div className="mt-1 font-semibold text-zinc-100">
                  {durationRecords.maxDuration} sec
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  {durationRecords.maxDurationDate ? durationRecords.maxDurationDate.slice(2) : '—'}
                </div>
              </div>
              <div className="p-2.5 rounded bg-zinc-900/80 border border-zinc-800/80">
                <div className="text-[11px] text-zinc-500">Cumul Séance Max</div>
                <div className="mt-1 font-semibold text-zinc-100">
                  {durationRecords.maxSessionTotal} sec
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  {durationRecords.maxSessionDate ? durationRecords.maxSessionDate.slice(2) : '—'}
                </div>
              </div>
              <div className="p-2.5 rounded bg-zinc-900/80 border border-zinc-800/80">
                <div className="text-[11px] text-zinc-500">Séries &ge; 30s</div>
                <div className="mt-1 font-semibold text-zinc-100">
                  {durationRecords.setsOver30s}
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  Total : {durationRecords.totalCumulativeSec}s
                </div>
              </div>
              <div className="p-2.5 rounded bg-zinc-900/80 border border-zinc-800/80">
                <div className="text-[11px] text-zinc-500">Palier 60 sec</div>
                <div className="mt-1 font-semibold text-zinc-100">
                  {Math.min(100, Math.round((durationRecords.maxDuration / 60) * 100))}%
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  {durationRecords.maxDuration >= 60 ? 'Validé' : `Reste ${60 - durationRecords.maxDuration}s`}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
              {repRecords.map((r) => (
                <div
                  key={r.repCount}
                  className="p-2.5 rounded bg-zinc-900/80 border border-zinc-800/80"
                >
                  <div className="text-[11px] text-zinc-500">{r.repCount} RM</div>
                  {r.record ? (
                    <div className="mt-1">
                      <div className="font-semibold text-zinc-100">
                        {currentMeta.mechanic === 'bodyweight' && r.record.rawWeight === 0
                          ? useEffectiveLoad
                            ? `PDC (${unit === 'kg' ? `${lbsToKg(r.record.weight)} kg` : `${r.record.weight} lbs`})`
                            : 'PDC'
                          : unit === 'kg'
                          ? `${lbsToKg(r.record.weight)} kg`
                          : `${r.record.weight} lbs`}
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">
                        {r.record.reps} réps &bull; {r.record.date.slice(2)}
                      </div>
                    </div>
                  ) : (
                    <div className="text-zinc-600 mt-1">&mdash;</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Complete Historical Sessions for this Exercise */}
        <div className="p-5 rounded-lg bg-zinc-900/40 border border-zinc-800 space-y-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-zinc-400" />
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-200">
              Historique Détaillé Série par Série
            </h3>
          </div>

          <div className="space-y-2">
            {exerciseData.slice().reverse().map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded bg-zinc-900/60 border border-zinc-800/70 text-xs font-mono space-y-1.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-zinc-400 border-b border-zinc-800/50 pb-1.5">
                  <span className="font-semibold text-zinc-200">{item.date}</span>
                  <div className="flex flex-wrap items-center gap-3 text-[11px]">
                    {currentMeta.mechanic === 'duration' ? (
                      <>
                        <span>Meilleure série : <strong className="text-zinc-200">{item.topDuration}s</strong></span>
                        <span>Cumul : <strong className="text-zinc-200">{item.totalDuration}s</strong></span>
                      </>
                    ) : (
                      <>
                        <span>
                          Top Set :{' '}
                          <strong className="text-zinc-200">
                            {item.topWeight > 0 ? `${item.topWeight} ${unit}` : 'PDC'}
                          </strong>{' '}
                          &times; {item.topReps}{' '}
                          {item.topWeight > 0 && (
                            <span className="text-zinc-500">({item.topSetScore} {unit})</span>
                          )}
                        </span>
                        <span>
                          1RM: <strong className="text-zinc-200">{item.est1rm} {item.topWeight > 0 ? unit : 'réps'}</strong>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-0.5">
                  {item.sets.map((st, sIdx) => (
                    <span
                      key={sIdx}
                      className={`px-2 py-0.5 rounded text-[11px] border ${
                        st.isWarmup
                          ? 'bg-zinc-950 border-zinc-800 text-zinc-500'
                          : 'bg-zinc-800/80 border-zinc-700/80 text-zinc-200'
                      }`}
                      title={st.isWarmup ? 'Série d’échauffement' : 'Série de travail'}
                    >
                      S{st.setIndex + 1}:{' '}
                      {st.durationSeconds > 0 ? (
                        `${st.durationSeconds}s`
                      ) : currentMeta.mechanic === 'bodyweight' && st.weightLbs === 0 ? (
                        `PDC × ${st.reps}`
                      ) : currentMeta.mechanic === 'assisted' ? (
                        `-${unit === 'kg' ? `${lbsToKg(st.weightLbs)}kg` : `${st.weightLbs}lbs`} × ${st.reps}`
                      ) : (
                        `${unit === 'kg' ? `${lbsToKg(st.weightLbs)}kg` : `${st.weightLbs}lbs`} × ${st.reps}`
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
