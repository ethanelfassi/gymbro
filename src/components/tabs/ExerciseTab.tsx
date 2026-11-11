'use client';

import React, { useState, useMemo } from 'react';
import { WorkoutSession, UnitSystem, WorkoutGoal } from '@/lib/types';
import { formatWeight, lbsToKg } from '@/lib/analytics';
import { calculateGoalProgress } from '@/lib/goals';
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
      topReps: number;
      topSetScore: number;
      est1rm: number;
      volume: number;
      sets: typeof sessions[0]['exercises'][0]['sets'];
    }[] = [];

    for (const s of sessions) {
      const ex = s.exercises.find((e) => e.name === currentEx);
      if (!ex || ex.sets.length === 0) continue;

      let est1rm = ex.topSet1rmLbs;
      let topWeight = ex.topSetWeightLbs;

      // Handle assisted exercises with bodyweight
      if (currentMeta.mechanic === 'assisted' && useEffectiveLoad) {
        topWeight = Math.max(0, bodyweightLbs - ex.topSetWeightLbs);
        est1rm = Math.round(topWeight * (1 + ex.topSetReps / 30));
      }

      const displayWeight = unit === 'kg' ? lbsToKg(topWeight) : topWeight;
      const topSetScore = Math.round(displayWeight * ex.topSetReps * 10) / 10;

      data.push({
        date: s.dateStr,
        topWeight: displayWeight,
        topReps: ex.topSetReps,
        topSetScore,
        est1rm: unit === 'kg' ? lbsToKg(est1rm) : est1rm,
        volume: unit === 'kg' ? lbsToKg(ex.totalVolumeLbs) : ex.totalVolumeLbs,
        sets: ex.sets,
      });
    }

    return data;
  }, [sessions, currentEx, currentMeta, useEffectiveLoad, bodyweightLbs, unit]);

  // Rep PRs calculation (1, 3, 5, 8, 10, 12 reps) - ranked by Charge * Réps
  const repRecords = useMemo(() => {
    const buckets = [1, 3, 5, 6, 8, 10, 12, 15];
    const bestByRep = new Map<number, { weight: number; reps: number; score: number; date: string }>();

    for (const d of exerciseData) {
      for (const st of d.sets) {
        if (st.isWarmup || st.reps <= 0) continue;
        let w = st.weightLbs;
        if (currentMeta.mechanic === 'assisted' && useEffectiveLoad) {
          w = Math.max(0, bodyweightLbs - st.weightLbs);
        }

        const score = w * st.reps;

        // Find nearest bucket
        for (const b of buckets) {
          if (st.reps >= b) {
            const current = bestByRep.get(b);
            if (!current || score > current.score || (score === current.score && w > current.weight)) {
              bestByRep.set(b, { weight: w, reps: st.reps, score, date: d.date });
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

  // Target value for chart reference line if metric aligns
  const targetValueForChart = useMemo(() => {
    if (!activeGoal) return null;
    if (metricView === '1rm' && activeGoal.targetMetric === '1rm') {
      return unit === 'kg' ? lbsToKg(activeGoal.targetWeightLbs) : activeGoal.targetWeightLbs;
    }
    if (metricView === 'top_set' && activeGoal.targetMetric === 'top_weight') {
      const load = unit === 'kg' ? lbsToKg(activeGoal.targetWeightLbs) : activeGoal.targetWeightLbs;
      return Math.round(load * (activeGoal.targetReps || 1) * 10) / 10;
    }
    return null;
  }, [activeGoal, metricView, unit]);

  const yDomain = useMemo(() => {
    if (exerciseData.length === 0) return ['auto', 'auto'];
    const key = metricView === '1rm' ? 'est1rm' : (metricView === 'top_set' ? 'topSetScore' : 'volume');
    const values = exerciseData.map((d) => d[key]);
    let minVal = Math.min(...values);
    let maxVal = Math.max(...values);
    if (targetValueForChart !== null) {
      minVal = Math.min(minVal, targetValueForChart);
      maxVal = Math.max(maxVal, targetValueForChart);
    }
    const padding = (maxVal - minVal) * 0.1 || 10;
    return [Math.max(0, Math.floor(minVal - padding)), Math.ceil(maxVal + padding)];
  }, [exerciseData, metricView, targetValueForChart]);

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
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-zinc-100">{currentEx}</h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
                {currentMeta.category} &bull; {currentMeta.primaryMuscle}
              </span>
            </div>
            <p className="text-xs text-zinc-500 font-mono mt-1">
              {exerciseData.length} séances enregistrées dans cette période
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Assisted toggle */}
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

            {/* Metric Switcher */}
            <div className="inline-flex rounded-md bg-zinc-950 border border-zinc-800 p-0.5 text-xs font-mono">
              <button
                onClick={() => setMetricView('1rm')}
                className={`px-2 py-1 rounded ${
                  metricView === '1rm' ? 'bg-zinc-800 text-zinc-100 font-medium' : 'text-zinc-400'
                }`}
              >
                1RM Estimé
              </button>
              <button
                onClick={() => setMetricView('top_set')}
                className={`px-2 py-1 rounded ${
                  metricView === 'top_set' ? 'bg-zinc-800 text-zinc-100 font-medium' : 'text-zinc-400'
                }`}
                title="Top Set trié par Charge × Réps"
              >
                Top Set (Charge &times; Réps)
              </button>
              <button
                onClick={() => setMetricView('volume')}
                className={`px-2 py-1 rounded ${
                  metricView === 'volume' ? 'bg-zinc-800 text-zinc-100 font-medium' : 'text-zinc-400'
                }`}
              >
                Volume Total
              </button>
            </div>
          </div>
        </div>

        {/* Active Goal Banner (if one exists for this exercise) */}
        {activeGoal && goalProgress && (
          <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-200">
                  Objectif Actif : {activeGoal.targetMetric === '1rm' ? '1RM Estimé' : `Top Set (${activeGoal.targetReps || 1} réps)`} &bull; {formatWeight(activeGoal.targetWeightLbs, unit)}
                </span>
                {activeGoal.note && (
                  <span className="text-[11px] text-zinc-400 font-mono">
                    ({activeGoal.note})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                    goalProgress.status === 'achieved'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-medium'
                      : goalProgress.status === 'on_track'
                      ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
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
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-zinc-400">
                  Actuel : <span className="text-zinc-100 font-semibold">{formatWeight(goalProgress.currentValueLbs, unit)}</span>
                  {' '}/ Cible : <span className="text-zinc-100 font-semibold">{formatWeight(goalProgress.targetValueLbs, unit)}</span>
                </span>
                <span className="font-semibold text-zinc-200">
                  {goalProgress.progressPercent}%
                  {goalProgress.remainingWeightLbs > 0 && (
                    <span className="text-zinc-500 font-normal ml-1">
                      (reste {formatWeight(goalProgress.remainingWeightLbs, unit)})
                    </span>
                  )}
                </span>
              </div>
              <div className="w-full bg-zinc-950 rounded-full h-2 overflow-hidden border border-zinc-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    goalProgress.isAchieved
                      ? 'bg-emerald-400'
                      : goalProgress.status === 'on_track'
                      ? 'bg-sky-400'
                      : 'bg-amber-400'
                  }`}
                  style={{ width: `${goalProgress.progressPercent}%` }}
                />
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
                          {metricView === 'top_set' ? (
                            <>
                              <div className="text-zinc-300">
                                Top Set : <span className="font-semibold text-zinc-100">{item.topWeight} {unit} &times; {item.topReps} réps</span>
                              </div>
                              <div className="text-[11px] text-zinc-400">
                                Score (Charge &times; Réps) : <span className="font-semibold text-emerald-400">{item.topSetScore} {unit}</span>
                              </div>
                              <div className="text-[10px] text-zinc-500">
                                1RM Estimé : {item.est1rm} {unit}
                              </div>
                            </>
                          ) : metricView === '1rm' ? (
                            <>
                              <div className="text-zinc-300">
                                1RM Estimé : <span className="font-semibold text-zinc-100">{item.est1rm} {unit}</span>
                              </div>
                              <div className="text-[11px] text-zinc-400">
                                Top Set : {item.topWeight} {unit} &times; {item.topReps} réps
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="text-zinc-300">
                                Volume séance : <span className="font-semibold text-zinc-100">{item.volume} {unit}</span>
                              </div>
                              <div className="text-[11px] text-zinc-400">
                                Top Set : {item.topWeight} {unit} &times; {item.topReps}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey={metricView === '1rm' ? 'est1rm' : (metricView === 'top_set' ? 'topSetScore' : 'volume')}
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
                        value: `Cible: ${targetValueForChart} ${unit}`,
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

        {/* Rep PRs Table */}
        <div className="p-5 rounded-lg bg-zinc-900/40 border border-zinc-800">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-zinc-400" />
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-200">
              Tableau des Records Personnels par Palier de Répétitions
            </h3>
          </div>

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
                      {unit === 'kg' ? `${lbsToKg(r.record.weight)} kg` : `${r.record.weight} lbs`}
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
                <div className="flex items-center justify-between text-zinc-400 border-b border-zinc-800/50 pb-1.5">
                  <span className="font-semibold text-zinc-200">{item.date}</span>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span>Top Set : <strong className="text-zinc-200">{item.topWeight} {unit}</strong> &times; {item.topReps} <span className="text-zinc-500">({item.topSetScore} {unit})</span></span>
                    <span>1RM: <strong className="text-zinc-200">{item.est1rm} {unit}</strong></span>
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
                      S{st.setIndex + 1}: {unit === 'kg' ? `${lbsToKg(st.weightLbs)}kg` : `${st.weightLbs}lbs`} &times; {st.reps}
                      {st.durationSeconds > 0 ? ` (${st.durationSeconds}s)` : ''}
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
