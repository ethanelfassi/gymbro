'use client';

import React, { useMemo, useState } from 'react';
import { WorkoutSession, MuscleGroup } from '@/lib/types';
import { computeMuscleVolumeDistribution } from '@/lib/analytics';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

interface MuscleBalanceTabProps {
  sessions: WorkoutSession[];
}

export const MuscleBalanceTab: React.FC<MuscleBalanceTabProps> = ({ sessions }) => {
  const [hoveredMuscle, setHoveredMuscle] = useState<MuscleGroup | null>(null);

  // Compute total duration in weeks for average weekly volume
  const weeksCount = useMemo(() => {
    if (sessions.length <= 1) return 1;
    const firstTs = sessions[0].timestamp;
    const lastTs = sessions[sessions.length - 1].timestamp;
    const days = Math.max(7, (lastTs - firstTs) / (1000 * 3600 * 24));
    return Math.max(1, days / 7);
  }, [sessions]);

  // Overall muscle distribution
  const muscleDistribution = useMemo(() => {
    return computeMuscleVolumeDistribution(sessions);
  }, [sessions]);

  // Radar chart formatted data
  const radarData = useMemo(() => {
    const list: { muscle: MuscleGroup; setsPerWeek: number; totalSets: number }[] = [
      { muscle: 'Pectoraux', setsPerWeek: 0, totalSets: 0 },
      { muscle: 'Dos', setsPerWeek: 0, totalSets: 0 },
      { muscle: 'Épaules Latérales', setsPerWeek: 0, totalSets: 0 },
      { muscle: 'Épaules Antérieures', setsPerWeek: 0, totalSets: 0 },
      { muscle: 'Épaules Postérieures', setsPerWeek: 0, totalSets: 0 },
      { muscle: 'Triceps', setsPerWeek: 0, totalSets: 0 },
      { muscle: 'Biceps', setsPerWeek: 0, totalSets: 0 },
      { muscle: 'Quadriceps', setsPerWeek: 0, totalSets: 0 },
      { muscle: 'Ischios & Fessiers', setsPerWeek: 0, totalSets: 0 },
      { muscle: 'Mollets', setsPerWeek: 0, totalSets: 0 },
      { muscle: 'Abdominaux', setsPerWeek: 0, totalSets: 0 },
    ];

    return list.map((item) => {
      const stats = muscleDistribution[item.muscle] || { effectiveSets: 0 };
      const weekly = Math.round((stats.effectiveSets / weeksCount) * 10) / 10;
      return {
        muscle: item.muscle,
        setsPerWeek: weekly,
        totalSets: Math.round(stats.effectiveSets),
      };
    });
  }, [muscleDistribution, weeksCount]);

  // PPL Split distribution
  const splitBreakdown = useMemo(() => {
    let push = 0;
    let pull = 0;
    let legs = 0;

    for (const s of sessions) {
      if (s.detectedType === 'Push') push++;
      else if (s.detectedType === 'Pull') pull++;
      else if (s.detectedType === 'Legs') legs++;
    }

    const total = push + pull + legs;
    if (total === 0) return { push: 33, pull: 33, legs: 33, pushCount: 0, pullCount: 0, legsCount: 0 };

    return {
      push: Math.round((push / total) * 100),
      pull: Math.round((pull / total) * 100),
      legs: Math.round((legs / total) * 100),
      pushCount: push,
      pullCount: pull,
      legsCount: legs,
    };
  }, [sessions]);

  // Helper to color anatomical map paths based on weekly volume
  const getVolumeColor = (muscle: MuscleGroup) => {
    const stats = muscleDistribution[muscle];
    const weekly = stats ? stats.effectiveSets / weeksCount : 0;
    const isHovered = hoveredMuscle === muscle;

    if (isHovered) return '#38BDF8'; // cyan highlight on hover
    if (weekly >= 12) return '#059669'; // optimal high (emerald)
    if (weekly >= 6) return '#2563EB'; // good maintenance/moderate (blue)
    if (weekly > 0) return '#475569'; // light/low
    return '#1E293B'; // none
  };

  return (
    <div className="space-y-6">
      
      {/* Split PPL Overview */}
      <div className="p-5 rounded-lg bg-zinc-900/40 border border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-zinc-200 uppercase">
              Répartition du Split d'Entraînement
            </h2>
            <p className="text-xs text-zinc-500 font-mono">
              Équilibre Push / Pull / Legs calculé automatiquement
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-mono">
            <span className="text-blue-400">Push: {splitBreakdown.push}% ({splitBreakdown.pushCount} s.)</span>
            <span className="text-emerald-400">Pull: {splitBreakdown.pull}% ({splitBreakdown.pullCount} s.)</span>
            <span className="text-amber-400">Legs: {splitBreakdown.legs}% ({splitBreakdown.legsCount} s.)</span>
          </div>
        </div>

        {/* Proportional bar */}
        <div className="w-full h-3 rounded-full bg-zinc-950 overflow-hidden flex border border-zinc-800">
          <div style={{ width: `${splitBreakdown.push}%` }} className="bg-blue-600 transition-all" />
          <div style={{ width: `${splitBreakdown.pull}%` }} className="bg-emerald-600 transition-all" />
          <div style={{ width: `${splitBreakdown.legs}%` }} className="bg-amber-600 transition-all" />
        </div>
      </div>

      {/* Anatomical Body Map & Radar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Anatomical Silhouette Map */}
        <div className="p-5 rounded-lg bg-zinc-900/40 border border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-200">
              Carte Anatomique d'Impact Musculaire
            </h3>
            <span className="text-[11px] font-mono text-zinc-500">
              Survolez une zone pour inspecter
            </span>
          </div>
          <p className="text-xs text-zinc-500 mb-4">
            Pondération anatomique : 1.0 série pour le muscle primaire, 0.5 pour les synergistes.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 py-4">
            
            {/* Front View */}
            <div className="flex flex-col items-center">
              <span className="text-[11px] font-mono text-zinc-500 mb-2 uppercase">Vue Face</span>
              <svg width="150" height="280" viewBox="0 0 160 300" className="drop-shadow-md">
                {/* Head */}
                <ellipse cx="80" cy="25" rx="14" ry="18" fill="#1E293B" />
                {/* Neck */}
                <rect x="74" y="42" width="12" height="12" fill="#1E293B" />
                
                {/* Pectoraux */}
                <path
                  d="M 52 64 C 52 56, 76 56, 78 64 L 78 88 C 72 88, 52 82, 52 64 Z"
                  fill={getVolumeColor('Pectoraux')}
                  onMouseEnter={() => setHoveredMuscle('Pectoraux')}
                  onMouseLeave={() => setHoveredMuscle(null)}
                  className="cursor-pointer transition-colors"
                />
                <path
                  d="M 108 64 C 108 56, 84 56, 82 64 L 82 88 C 88 88, 108 82, 108 64 Z"
                  fill={getVolumeColor('Pectoraux')}
                  onMouseEnter={() => setHoveredMuscle('Pectoraux')}
                  onMouseLeave={() => setHoveredMuscle(null)}
                  className="cursor-pointer transition-colors"
                />

                {/* Épaules Antérieures / Latérales */}
                <ellipse
                  cx="44"
                  cy="64"
                  rx="9"
                  ry="12"
                  fill={getVolumeColor('Épaules Latérales')}
                  onMouseEnter={() => setHoveredMuscle('Épaules Latérales')}
                  onMouseLeave={() => setHoveredMuscle(null)}
                  className="cursor-pointer transition-colors"
                />
                <ellipse
                  cx="116"
                  cy="64"
                  rx="9"
                  ry="12"
                  fill={getVolumeColor('Épaules Latérales')}
                  onMouseEnter={() => setHoveredMuscle('Épaules Latérales')}
                  onMouseLeave={() => setHoveredMuscle(null)}
                  className="cursor-pointer transition-colors"
                />

                {/* Biceps */}
                <path
                  d="M 36 78 C 34 88, 36 102, 42 108 L 48 104 C 44 96, 44 86, 46 76 Z"
                  fill={getVolumeColor('Biceps')}
                  onMouseEnter={() => setHoveredMuscle('Biceps')}
                  onMouseLeave={() => setHoveredMuscle(null)}
                  className="cursor-pointer transition-colors"
                />
                <path
                  d="M 124 78 C 126 88, 124 102, 118 108 L 112 104 C 116 96, 116 86, 114 76 Z"
                  fill={getVolumeColor('Biceps')}
                  onMouseEnter={() => setHoveredMuscle('Biceps')}
                  onMouseLeave={() => setHoveredMuscle(null)}
                  className="cursor-pointer transition-colors"
                />

                {/* Avant-bras */}
                <path
                  d="M 30 114 C 26 130, 24 148, 22 156 L 30 158 C 34 146, 38 132, 40 114 Z"
                  fill={getVolumeColor('Avant-bras')}
                  onMouseEnter={() => setHoveredMuscle('Avant-bras')}
                  onMouseLeave={() => setHoveredMuscle(null)}
                  className="cursor-pointer transition-colors"
                />
                <path
                  d="M 130 114 C 134 130, 136 148, 138 156 L 130 158 C 126 146, 122 132, 120 114 Z"
                  fill={getVolumeColor('Avant-bras')}
                  onMouseEnter={() => setHoveredMuscle('Avant-bras')}
                  onMouseLeave={() => setHoveredMuscle(null)}
                  className="cursor-pointer transition-colors"
                />

                {/* Abdominaux */}
                <rect
                  x="68"
                  y="92"
                  width="24"
                  height="42"
                  rx="3"
                  fill={getVolumeColor('Abdominaux')}
                  onMouseEnter={() => setHoveredMuscle('Abdominaux')}
                  onMouseLeave={() => setHoveredMuscle(null)}
                  className="cursor-pointer transition-colors"
                />

                {/* Quadriceps */}
                <path
                  d="M 54 145 C 50 175, 52 205, 58 215 L 76 215 C 78 190, 78 165, 78 145 Z"
                  fill={getVolumeColor('Quadriceps')}
                  onMouseEnter={() => setHoveredMuscle('Quadriceps')}
                  onMouseLeave={() => setHoveredMuscle(null)}
                  className="cursor-pointer transition-colors"
                />
                <path
                  d="M 106 145 C 110 175, 108 205, 102 215 L 84 215 C 82 190, 82 165, 82 145 Z"
                  fill={getVolumeColor('Quadriceps')}
                  onMouseEnter={() => setHoveredMuscle('Quadriceps')}
                  onMouseLeave={() => setHoveredMuscle(null)}
                  className="cursor-pointer transition-colors"
                />

                {/* Mollets */}
                <path
                  d="M 56 226 C 52 245, 52 265, 56 275 L 68 275 C 70 262, 70 245, 68 226 Z"
                  fill={getVolumeColor('Mollets')}
                  onMouseEnter={() => setHoveredMuscle('Mollets')}
                  onMouseLeave={() => setHoveredMuscle(null)}
                  className="cursor-pointer transition-colors"
                />
                <path
                  d="M 104 226 C 108 245, 108 265, 104 275 L 92 275 C 90 262, 90 245, 92 226 Z"
                  fill={getVolumeColor('Mollets')}
                  onMouseEnter={() => setHoveredMuscle('Mollets')}
                  onMouseLeave={() => setHoveredMuscle(null)}
                  className="cursor-pointer transition-colors"
                />
              </svg>
            </div>

            {/* Back View */}
            <div className="flex flex-col items-center">
              <span className="text-[11px] font-mono text-zinc-500 mb-2 uppercase">Vue Dos</span>
              <svg width="150" height="280" viewBox="0 0 160 300" className="drop-shadow-md">
                {/* Head */}
                <ellipse cx="80" cy="25" rx="14" ry="18" fill="#1E293B" />
                {/* Neck */}
                <rect x="74" y="42" width="12" height="12" fill="#1E293B" />

                {/* Dos (Dorsaux + Trapèzes) */}
                <path
                  d="M 54 58 L 106 58 L 98 120 L 80 128 L 62 120 Z"
                  fill={getVolumeColor('Dos')}
                  onMouseEnter={() => setHoveredMuscle('Dos')}
                  onMouseLeave={() => setHoveredMuscle(null)}
                  className="cursor-pointer transition-colors"
                />

                {/* Épaules Postérieures */}
                <ellipse
                  cx="44"
                  cy="64"
                  rx="9"
                  ry="12"
                  fill={getVolumeColor('Épaules Postérieures')}
                  onMouseEnter={() => setHoveredMuscle('Épaules Postérieures')}
                  onMouseLeave={() => setHoveredMuscle(null)}
                  className="cursor-pointer transition-colors"
                />
                <ellipse
                  cx="116"
                  cy="64"
                  rx="9"
                  ry="12"
                  fill={getVolumeColor('Épaules Postérieures')}
                  onMouseEnter={() => setHoveredMuscle('Épaules Postérieures')}
                  onMouseLeave={() => setHoveredMuscle(null)}
                  className="cursor-pointer transition-colors"
                />

                {/* Triceps */}
                <path
                  d="M 36 78 C 34 88, 36 102, 42 108 L 48 104 C 44 96, 44 86, 46 76 Z"
                  fill={getVolumeColor('Triceps')}
                  onMouseEnter={() => setHoveredMuscle('Triceps')}
                  onMouseLeave={() => setHoveredMuscle(null)}
                  className="cursor-pointer transition-colors"
                />
                <path
                  d="M 124 78 C 126 88, 124 102, 118 108 L 112 104 C 116 96, 116 86, 114 76 Z"
                  fill={getVolumeColor('Triceps')}
                  onMouseEnter={() => setHoveredMuscle('Triceps')}
                  onMouseLeave={() => setHoveredMuscle(null)}
                  className="cursor-pointer transition-colors"
                />

                {/* Ischios & Fessiers */}
                <path
                  d="M 54 135 C 50 165, 52 195, 58 215 L 76 215 C 78 190, 78 165, 78 135 Z"
                  fill={getVolumeColor('Ischios & Fessiers')}
                  onMouseEnter={() => setHoveredMuscle('Ischios & Fessiers')}
                  onMouseLeave={() => setHoveredMuscle(null)}
                  className="cursor-pointer transition-colors"
                />
                <path
                  d="M 106 135 C 110 165, 108 195, 102 215 L 84 215 C 82 190, 82 165, 82 135 Z"
                  fill={getVolumeColor('Ischios & Fessiers')}
                  onMouseEnter={() => setHoveredMuscle('Ischios & Fessiers')}
                  onMouseLeave={() => setHoveredMuscle(null)}
                  className="cursor-pointer transition-colors"
                />

                {/* Mollets */}
                <path
                  d="M 56 226 C 52 245, 52 265, 56 275 L 68 275 C 70 262, 70 245, 68 226 Z"
                  fill={getVolumeColor('Mollets')}
                  onMouseEnter={() => setHoveredMuscle('Mollets')}
                  onMouseLeave={() => setHoveredMuscle(null)}
                  className="cursor-pointer transition-colors"
                />
                <path
                  d="M 104 226 C 108 245, 108 265, 104 275 L 92 275 C 90 262, 90 245, 92 226 Z"
                  fill={getVolumeColor('Mollets')}
                  onMouseEnter={() => setHoveredMuscle('Mollets')}
                  onMouseLeave={() => setHoveredMuscle(null)}
                  className="cursor-pointer transition-colors"
                />
              </svg>
            </div>

          </div>

          {/* Hover readout indicator */}
          <div className="mt-2 p-2.5 rounded bg-zinc-950 border border-zinc-800 text-xs font-mono flex items-center justify-between">
            <span className="text-zinc-400">
              {hoveredMuscle ? `Groupe ciblé : ${hoveredMuscle}` : 'Survolez un groupe musculaire'}
            </span>
            {hoveredMuscle && muscleDistribution[hoveredMuscle] && (
              <span className="font-semibold text-zinc-100">
                {(muscleDistribution[hoveredMuscle].effectiveSets / weeksCount).toFixed(1)} séries / sem ({Math.round(muscleDistribution[hoveredMuscle].effectiveSets)} tot.)
              </span>
            )}
          </div>
        </div>

        {/* Radar Chart */}
        <div className="p-5 rounded-lg bg-zinc-900/40 border border-zinc-800 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-200 mb-1">
              Radar d'Équilibre du Volume Hebdomadaire
            </h3>
            <p className="text-xs text-zinc-500 mb-4">
              Moyenne de séries effectives par semaine par groupe musculaire
            </p>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="75%">
                  <PolarGrid stroke="#272D38" />
                  <PolarAngleAxis
                    dataKey="muscle"
                    tick={{ fill: '#8E99A8', fontSize: 10, fontFamily: 'monospace' }}
                  />
                  <PolarRadiusAxis stroke="#3D4554" fontSize={10} fontFamily="monospace" />
                  <Radar
                    name="Séries/semaine"
                    dataKey="setsPerWeek"
                    stroke="#10B981"
                    fill="#10B981"
                    fillOpacity={0.25}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#12151B',
                      borderColor: '#262D38',
                      borderRadius: '6px',
                      fontSize: '11px',
                      color: '#E2E8F0',
                      fontFamily: 'monospace',
                    }}
                    formatter={(val: number) => [`${val} séries / sem.`, 'Volume']}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Summary table */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4 text-[11px] font-mono">
            {radarData.slice(0, 6).map((item) => (
              <div key={item.muscle} className="p-1.5 rounded bg-zinc-950 border border-zinc-800/80">
                <span className="text-zinc-500 block truncate">{item.muscle}</span>
                <span className="font-semibold text-zinc-200">{item.setsPerWeek} s/sem</span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
