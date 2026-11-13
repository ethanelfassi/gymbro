'use client';

import React, { useMemo, useState } from 'react';
import { WorkoutSession, UnitSystem } from '@/lib/types';
import { analyzeExerciseProgression, computeIntraSessionFatigue, formatWeight, lbsToKg } from '@/lib/analytics';
import { Zap, TrendingUp, AlertCircle, ArrowRight, BatteryCharging, Filter } from 'lucide-react';

interface ProgressionTabProps {
  sessions: WorkoutSession[];
  unit: UnitSystem;
  bodyweightLbs?: number;
  onSelectExercise: (name: string) => void;
}

export const ProgressionTab: React.FC<ProgressionTabProps> = ({
  sessions,
  unit,
  bodyweightLbs = 170,
  onSelectExercise,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'progression' | 'plateau' | 'regression'>('all');

  // Compute progressive overload analysis for all exercises active in these sessions
  const progressionData = useMemo(() => {
    // Unique exercise names
    const names = new Set<string>();
    for (const s of sessions) {
      for (const ex of s.exercises) {
        if (ex.meta.category !== 'Cardio') {
          names.add(ex.name);
        }
      }
    }

    const analyses = Array.from(names)
      .map((name) => analyzeExerciseProgression(name, sessions, bodyweightLbs))
      .filter((a): a is NonNullable<typeof a> => a !== null && a.totalSessionsCount >= 2);

    // Sort: plateau / progression first, then by sessions count
    analyses.sort((a, b) => b.totalSessionsCount - a.totalSessionsCount);

    return analyses;
  }, [sessions, bodyweightLbs]);

  // Intra-session fatigue data
  const fatigueData = useMemo(() => {
    const list = computeIntraSessionFatigue(sessions);
    // Take the last 15 entries
    return list.slice(-15).reverse();
  }, [sessions]);

  const filteredAnalyses = useMemo(() => {
    if (statusFilter === 'all') return progressionData;
    return progressionData.filter((item) => item.status === statusFilter);
  }, [progressionData, statusFilter]);

  return (
    <div className="space-y-6">
      
      {/* Surcharge Progressive Matrix */}
      <div className="p-5 rounded-lg bg-zinc-900/40 border border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-semibold tracking-wide text-zinc-200 uppercase">
                Diagnostic Mathématique de Surcharge Progressive
              </h2>
            </div>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">
              Analyse objective des 3 à 5 dernières séances &bull; Objectifs calculés en double progression
            </p>
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded border border-zinc-800 text-xs font-mono">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-1 rounded ${statusFilter === 'all' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500'}`}
            >
              Tous ({progressionData.length})
            </button>
            <button
              onClick={() => setStatusFilter('progression')}
              className={`px-2 py-1 rounded ${statusFilter === 'progression' ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-500'}`}
            >
              Progression
            </button>
            <button
              onClick={() => setStatusFilter('plateau')}
              className={`px-2 py-1 rounded ${statusFilter === 'plateau' ? 'bg-zinc-800 text-amber-400' : 'text-zinc-500'}`}
            >
              Plateau
            </button>
            <button
              onClick={() => setStatusFilter('regression')}
              className={`px-2 py-1 rounded ${statusFilter === 'regression' ? 'bg-zinc-800 text-rose-400' : 'text-zinc-500'}`}
            >
              Baisse
            </button>
          </div>
        </div>

        {/* Overload Table */}
        <div className="border border-zinc-800 rounded-md overflow-hidden text-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono">
              <thead className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800 text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 font-medium">Exercice</th>
                  <th className="py-2.5 px-3 font-medium">Dernier Top Set</th>
                  <th className="py-2.5 px-3 font-medium">Statut & Évolution</th>
                  <th className="py-2.5 px-3 font-medium">Objectif Prochaine Séance</th>
                  <th className="py-2.5 px-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {filteredAnalyses.map((item) => {
                  let statusBadge = (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700">
                      Maintien
                    </span>
                  );
                  if (item.status === 'progression') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-emerald-950/70 text-emerald-300 border border-emerald-800/80">
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                        Progression
                      </span>
                    );
                  } else if (item.status === 'plateau') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-amber-950/70 text-amber-300 border border-amber-800/80">
                        <AlertCircle className="w-3 h-3 text-amber-400" />
                        Plateau
                      </span>
                    );
                  } else if (item.status === 'regression') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-rose-950/70 text-rose-300 border border-rose-800/80">
                        Baisse
                      </span>
                    );
                  }

                  return (
                    <tr key={item.exerciseName} className="hover:bg-zinc-900/50 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-zinc-200">{item.exerciseName}</div>
                        <div className="text-[10px] text-zinc-500">{item.primaryMuscle} &bull; {item.totalSessionsCount} séances</div>
                      </td>

                      <td className="py-2.5 px-3">
                        {item.mechanic === 'duration' ? (
                          <>
                            <div className="font-semibold text-zinc-100">
                              {item.lastTopSetDurationSeconds} sec
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              Record : {item.historicalMaxDurationSeconds} sec ({item.lastSessionDate.slice(5)})
                            </div>
                          </>
                        ) : item.mechanic === 'bodyweight' ? (
                          <>
                            <div className="font-semibold text-zinc-100">
                              {item.lastTopSetWeight > 0 ? `+${formatWeight(item.lastTopSetWeight, unit)}` : 'PDC'} &times; {item.lastTopSetReps} réps
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              Charge eff. : {formatWeight(item.lastEffectiveLoadLbs, unit)} ({item.lastSessionDate.slice(5)})
                            </div>
                          </>
                        ) : item.mechanic === 'assisted' ? (
                          <>
                            <div className="font-semibold text-zinc-100">
                              -{formatWeight(item.lastTopSetWeight, unit)} (assist.) &times; {item.lastTopSetReps}
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              Charge nette : {formatWeight(item.lastEffectiveLoadLbs, unit)} ({item.lastSessionDate.slice(5)})
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="font-semibold text-zinc-100">
                              {unit === 'kg' ? `${lbsToKg(item.lastTopSetWeight)} kg` : `${item.lastTopSetWeight} lbs`} &times; {item.lastTopSetReps}
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              1RM: {formatWeight(item.lastEstimated1rm, unit)} ({item.lastSessionDate.slice(5)})
                            </div>
                          </>
                        )}
                      </td>

                      <td className="py-2.5 px-3">
                        {statusBadge}
                        <div className="text-[10px] text-zinc-400 mt-1 max-w-xs truncate">
                          {item.statusReason}
                        </div>
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="text-zinc-100 font-medium">
                          {item.mechanic === 'duration' ? (
                            item.nextSessionGoal.targetReps
                          ) : item.mechanic === 'bodyweight' && item.nextSessionGoal.targetWeightLbs === 0 ? (
                            <>PDC &bull; {item.nextSessionGoal.targetReps}</>
                          ) : item.mechanic === 'assisted' ? (
                            <>-{formatWeight(item.nextSessionGoal.targetWeightLbs, unit)} (assist.) &bull; {item.nextSessionGoal.targetReps}</>
                          ) : (
                            <>{unit === 'kg' ? `${lbsToKg(item.nextSessionGoal.targetWeightLbs)} kg` : `${item.nextSessionGoal.targetWeightLbs} lbs`} &bull; {item.nextSessionGoal.targetReps}</>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-500 max-w-sm">
                          {item.nextSessionGoal.rationale}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => onSelectExercise(item.exerciseName)}
                          className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[11px] border border-zinc-800 inline-flex items-center gap-1 transition-colors"
                        >
                          Courbe
                          <ArrowRight className="w-3 h-3 text-zinc-500" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Intra-Session Fatigue & Drop-Off */}
      <div className="p-5 rounded-lg bg-zinc-900/40 border border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <BatteryCharging className="w-4 h-4 text-zinc-400" />
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-200">
              Analyse de Fatigue Intra-Séance (Drop-Off de Répétitions)
            </h3>
          </div>
          <span className="text-xs font-mono text-zinc-500">1ère série vs dernière série</span>
        </div>
        <p className="text-xs text-zinc-500 mb-4">
          Une chute de répétitions supérieure à -25% à charge identique indique une haute proximité avec l'échec musculaire dès la première série (RIR proche de 0).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
          {fatigueData.map((f, idx) => (
            <div
              key={idx}
              className="p-3 rounded bg-zinc-900/60 border border-zinc-800/80 space-y-1.5"
            >
              <div className="flex items-center justify-between text-zinc-300">
                <span className="font-semibold truncate mr-2">{f.exerciseName}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    f.dropOffPercentage <= -30
                      ? 'bg-rose-950 text-rose-300 border border-rose-800'
                      : f.dropOffPercentage <= -15
                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                      : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  {f.dropOffPercentage > 0 ? `+${f.dropOffPercentage}%` : `${f.dropOffPercentage}%`}
                </span>
              </div>

              <div className="text-[11px] text-zinc-400 flex items-center justify-between">
                <span>Séance du {f.date}</span>
                <span>{f.workingSetsCount} séries</span>
              </div>

              <div className="text-[10px] text-zinc-500 border-t border-zinc-800/60 pt-1">
                S1: {f.firstWorkingSetReps} réps &rarr; S{f.workingSetsCount}: {f.lastWorkingSetReps} réps ({f.firstWorkingSetWeight > 0 ? formatWeight(f.firstWorkingSetWeight, unit) : 'PDC'})
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
