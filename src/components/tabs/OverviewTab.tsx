'use client';

import React, { useMemo, useState } from 'react';
import { WorkoutSession, UnitSystem, WorkoutGoal } from '@/lib/types';
import { formatWeight, lbsToKg } from '@/lib/analytics';
import { calculateGoalProgress, formatGoalValue, formatGoalMetricLabel } from '@/lib/goals';
import {
  Activity,
  Clock,
  Dumbbell,
  Award,
  ArrowUpRight,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Layers,
  Target,
} from 'lucide-react';

interface OverviewTabProps {
  sessions: WorkoutSession[];
  allSessions: WorkoutSession[];
  unit: UnitSystem;
  onSelectExercise: (exName: string) => void;
  onSelectSession: (sessionId: string) => void;
  goals?: WorkoutGoal[];
  onNavigateToGoals?: () => void;
  bodyweightLbs?: number;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  sessions,
  allSessions,
  unit,
  onSelectExercise,
  onSelectSession,
  goals,
  onNavigateToGoals,
  bodyweightLbs,
}) => {
  // Calendar view mode: monthly interactive calendar (default) vs annual heatmap
  const [calendarMode, setCalendarMode] = useState<'month' | 'year'>('month');

  // Find the latest session date to initialize the month view
  const latestDate = useMemo(() => {
    if (allSessions.length === 0) return new Date();
    const lastSession = allSessions[allSessions.length - 1];
    return new Date(lastSession.timestamp);
  }, [allSessions]);

  // Current viewed month and year (0-indexed month)
  const [viewDate, setViewDate] = useState<Date>(() => {
    if (allSessions.length === 0) return new Date();
    const last = allSessions[allSessions.length - 1];
    const d = new Date(last.timestamp);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // Metrics computation for filtered sessions
  const stats = useMemo(() => {
    const muscuSessions = sessions.filter((s) => !s.isCardioOnly);
    const sessionCount = muscuSessions.length;

    let totalVolume = 0;
    let totalEffectiveSets = 0;
    let totalDurationMinutes = 0;

    for (const s of muscuSessions) {
      totalVolume += s.totalVolumeLbs;
      totalEffectiveSets += s.totalEffectiveSets;
      totalDurationMinutes += s.durationMinutes;
    }

    const avgDuration = sessionCount > 0 ? Math.round(totalDurationMinutes / sessionCount) : 0;

    // Calculate weeks span
    let setsPerWeek = 0;
    let sessionsPerWeek = 0;
    if (sessionCount > 1) {
      const firstTs = muscuSessions[0].timestamp;
      const lastTs = muscuSessions[muscuSessions.length - 1].timestamp;
      const daysDiff = Math.max(7, (lastTs - firstTs) / (1000 * 3600 * 24));
      const weeks = daysDiff / 7;
      setsPerWeek = Math.round((totalEffectiveSets / weeks) * 10) / 10;
      sessionsPerWeek = Math.round((sessionCount / weeks) * 10) / 10;
    } else if (sessionCount === 1) {
      setsPerWeek = totalEffectiveSets;
      sessionsPerWeek = 1;
    }

    return {
      sessionCount,
      totalVolume,
      totalEffectiveSets,
      avgDuration,
      setsPerWeek,
      sessionsPerWeek,
    };
  }, [sessions]);

  // Comparison between Block 2026 and Block 2024-2025
  const comparison = useMemo(() => {
    const block2024 = allSessions.filter(
      (s) => s.timestamp < new Date('2025-06-01').getTime() && !s.isCardioOnly
    );
    const block2026 = allSessions.filter(
      (s) => s.timestamp >= new Date('2026-08-01').getTime() && !s.isCardioOnly
    );

    const getBlockStats = (b: WorkoutSession[]) => {
      if (b.length === 0) return { count: 0, avgDur: 0, freq: 0, avgVol: 0 };
      const days = Math.max(7, (b[b.length - 1].timestamp - b[0].timestamp) / (1000 * 3600 * 24));
      const weeks = days / 7;
      const totalDur = b.reduce((acc, s) => acc + s.durationMinutes, 0);
      const totalVol = b.reduce((acc, s) => acc + s.totalVolumeLbs, 0);
      return {
        count: b.length,
        avgDur: Math.round(totalDur / b.length),
        freq: Math.round((b.length / weeks) * 10) / 10,
        avgVol: Math.round(totalVol / b.length),
      };
    };

    return {
      b24: getBlockStats(block2024),
      b26: getBlockStats(block2026),
    };
  }, [allSessions]);

  // Extract recent PRs across all sessions
  const prs = useMemo(() => {
    const records: {
      date: string;
      exercise: string;
      weightLbs: number;
      reps: number;
      est1rmLbs: number;
    }[] = [];

    const exerciseBest1rm = new Map<string, number>();

    for (const s of allSessions) {
      for (const ex of s.exercises) {
        if (ex.meta.mechanic === 'duration') continue;
        for (const st of ex.sets) {
          if (st.isWarmup || st.estimated1rmLbs <= 0) continue;
          const currentBest = exerciseBest1rm.get(ex.name) || 0;
          if (st.estimated1rmLbs > currentBest) {
            exerciseBest1rm.set(ex.name, st.estimated1rmLbs);
            records.push({
              date: s.dateStr,
              exercise: ex.name,
              weightLbs: st.weightLbs,
              reps: st.reps,
              est1rmLbs: st.estimated1rmLbs,
            });
          }
        }
      }
    }

    return records.slice(-6).reverse();
  }, [allSessions]);

  // Goals preview
  const goalPreviews = useMemo(() => {
    if (!goals || goals.length === 0) return [];
    return goals.map((g) => calculateGoalProgress(g, allSessions, bodyweightLbs || 170));
  }, [goals, allSessions, bodyweightLbs]);

  // Session Map by Date String ("YYYY-MM-DD")
  const sessionByDate = useMemo(() => {
    const map = new Map<string, WorkoutSession>();
    for (const s of allSessions) {
      map.set(s.dateStr, s);
    }
    return map;
  }, [allSessions]);

  // Monthly Calendar computation
  const monthData = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    // First day of this month
    const firstDay = new Date(year, month, 1);
    // Number of days in this month
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();

    // Day of week for day 1 (0 = Sunday -> convert to Monday = 0)
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6; // Sunday is 6th index

    // Month label in French (e.g. "Novembre 2026")
    const monthName = firstDay.toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    });
    const formattedMonthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    // Days array
    const days: {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      session?: WorkoutSession;
    }[] = [];

    // Previous month padding days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dNum = prevMonthLastDay - i;
      const prevDate = new Date(year, month - 1, dNum);
      const dStr = prevDate.toISOString().split('T')[0];
      days.push({
        dateStr: dStr,
        dayNumber: dNum,
        isCurrentMonth: false,
        session: sessionByDate.get(dStr),
      });
    }

    // Current month days
    let sessionsInThisMonth = 0;
    for (let d = 1; d <= totalDays; d++) {
      const padM = String(month + 1).padStart(2, '0');
      const padD = String(d).padStart(2, '0');
      const dStr = `${year}-${padM}-${padD}`;
      const session = sessionByDate.get(dStr);
      if (session) sessionsInThisMonth++;

      days.push({
        dateStr: dStr,
        dayNumber: d,
        isCurrentMonth: true,
        session,
      });
    }

    // Trailing days padding to complete final row of 7
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      const dStr = nextDate.toISOString().split('T')[0];
      days.push({
        dateStr: dStr,
        dayNumber: i,
        isCurrentMonth: false,
        session: sessionByDate.get(dStr),
      });
    }

    return {
      monthName: formattedMonthName,
      days,
      sessionsCount: sessionsInThisMonth,
    };
  }, [viewDate, sessionByDate]);

  // Navigate months
  const handlePrevMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleResetToLatestMonth = () => {
    setViewDate(new Date(latestDate.getFullYear(), latestDate.getMonth(), 1));
  };

  // Annual Heatmap Weeks computation (for the year mode)
  const heatmapWeeks = useMemo(() => {
    if (allSessions.length === 0) return [];
    const endDate = new Date('2026-11-07');
    const startDate = new Date('2024-07-28');

    const weeks: { date: string; session?: WorkoutSession; inRange: boolean }[][] = [];
    let currentWeek: { date: string; session?: WorkoutSession; inRange: boolean }[] = [];

    const cursor = new Date(startDate);
    const dayOfWeek = cursor.getDay();
    cursor.setDate(cursor.getDate() - dayOfWeek);

    while (cursor <= endDate) {
      const dStr = cursor.toISOString().split('T')[0];
      const session = sessionByDate.get(dStr);
      currentWeek.push({
        date: dStr,
        session,
        inRange: cursor >= startDate && cursor <= endDate,
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return weeks;
  }, [allSessions, sessionByDate]);

  return (
    <div className="space-y-6">
      
      {/* Primary KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Card 1: Sessions */}
        <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-xs font-mono uppercase tracking-wider">Séances</span>
            <Activity className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="text-2xl font-mono font-semibold text-zinc-100 num-tabular">
            {stats.sessionCount}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1 font-mono">
            {stats.sessionsPerWeek > 0 ? `~${stats.sessionsPerWeek} séances / sem.` : 'Sur la période'}
          </p>
        </div>

        {/* Card 2: Séries Effectives / Semaine */}
        <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-xs font-mono uppercase tracking-wider">Séries effectives</span>
            <Dumbbell className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="text-2xl font-mono font-semibold text-zinc-100 num-tabular">
            {stats.setsPerWeek}
            <span className="text-xs font-normal text-zinc-500 ml-1">/ sem</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1 font-mono">
            {stats.totalEffectiveSets} séries totales de travail
          </p>
        </div>

        {/* Card 3: Tonnage Global */}
        <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-xs font-mono uppercase tracking-wider">Volume déplacé</span>
            <TrendingUp className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="text-2xl font-mono font-semibold text-zinc-100 num-tabular">
            {unit === 'kg'
              ? `${(lbsToKg(stats.totalVolume) / 1000).toFixed(1)} t`
              : `${(stats.totalVolume / 1000).toFixed(1)}k lbs`}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1 font-mono">
            {formatWeight(stats.totalVolume, unit)} au total
          </p>
        </div>

        {/* Card 4: Durée Moyenne */}
        <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-xs font-mono uppercase tracking-wider">Durée moyenne</span>
            <Clock className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="text-2xl font-mono font-semibold text-zinc-100 num-tabular">
            {stats.avgDuration}
            <span className="text-xs font-normal text-zinc-500 ml-1">min</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1 font-mono">
            Séances de musculation
          </p>
        </div>

      </div>

      {/* Interactive Calendar Section */}
      <div className="p-3 sm:p-5 rounded-lg bg-zinc-900/40 border border-zinc-800">
        
        {/* Calendar Header with Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-semibold tracking-wide text-zinc-200 uppercase">
                Calendrier d'Entraînement
              </h2>
            </div>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">
              Cliquez sur n'importe quelle séance pour accéder directement à son détail
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle: Monthly vs Annual */}
            <div className="inline-flex rounded-md bg-zinc-950 border border-zinc-800 p-0.5 text-xs font-mono">
              <button
                onClick={() => setCalendarMode('month')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  calendarMode === 'month'
                    ? 'bg-zinc-800 text-zinc-100 font-medium'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Mois
              </button>
              <button
                onClick={() => setCalendarMode('year')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  calendarMode === 'year'
                    ? 'bg-zinc-800 text-zinc-100 font-medium'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Vue Globale (Année)
              </button>
            </div>

            {/* Split Legend */}
            <div className="hidden lg:flex items-center gap-3 text-[11px] font-mono text-zinc-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500/80" />
                <span>Push</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/80" />
                <span>Pull</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/80" />
                <span>Legs</span>
              </div>
            </div>
          </div>
        </div>

        {calendarMode === 'month' ? (
          <div className="space-y-3">
            
            {/* Month Selector Bar */}
            <div className="flex items-center justify-between p-2 rounded-md bg-zinc-950 border border-zinc-800/80 text-xs font-mono">
              <button
                onClick={handlePrevMonth}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1"
                title="Mois précédent"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Précédent</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-100 text-sm">
                  {monthData.monthName}
                </span>
                <span className="text-[11px] text-zinc-500">
                  ({monthData.sessionsCount} séance{monthData.sessionsCount > 1 ? 's' : ''})
                </span>
                {viewDate.getMonth() !== latestDate.getMonth() && (
                  <button
                    onClick={handleResetToLatestMonth}
                    className="text-[10px] text-zinc-400 underline underline-offset-2 hover:text-zinc-200 ml-1"
                  >
                    Dernière séance
                  </button>
                )}
              </div>

              <button
                onClick={handleNextMonth}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1"
                title="Mois suivant"
              >
                <span className="hidden sm:inline">Suivant</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Days of week header */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center text-[10px] sm:text-[11px] font-mono font-medium text-zinc-500 uppercase py-1">
              <div>Lun</div>
              <div>Mar</div>
              <div>Mer</div>
              <div>Jeu</div>
              <div>Ven</div>
              <div>Sam</div>
              <div>Dim</div>
            </div>

            {/* Monthly Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {monthData.days.map((day, idx) => {
                const s = day.session;

                if (!day.isCurrentMonth) {
                  return (
                    <div
                      key={idx}
                      className="min-h-[60px] sm:min-h-[84px] p-1 sm:p-2 min-w-0 overflow-hidden rounded border border-zinc-900 bg-zinc-950/30 text-zinc-700 font-mono text-[11px] sm:text-xs"
                    >
                      <span>{day.dayNumber}</span>
                    </div>
                  );
                }

                if (!s) {
                  return (
                    <div
                      key={idx}
                      className="min-h-[60px] sm:min-h-[84px] p-1 sm:p-2 min-w-0 overflow-hidden rounded border border-zinc-800/40 bg-zinc-950/60 text-zinc-500 font-mono text-[11px] sm:text-xs flex flex-col justify-between hover:border-zinc-800 transition-colors"
                    >
                      <span>{day.dayNumber}</span>
                    </div>
                  );
                }

                // Split colors
                let badgeStyle = 'bg-zinc-800 text-zinc-200 border-zinc-700';
                let cellHoverBorder = 'hover:border-zinc-600';
                if (s.detectedType === 'Push') {
                  badgeStyle = 'bg-blue-950/90 text-blue-300 border-blue-800/90';
                  cellHoverBorder = 'hover:border-blue-500';
                } else if (s.detectedType === 'Pull') {
                  badgeStyle = 'bg-emerald-950/90 text-emerald-300 border-emerald-800/90';
                  cellHoverBorder = 'hover:border-emerald-500';
                } else if (s.detectedType === 'Legs') {
                  badgeStyle = 'bg-amber-950/90 text-amber-300 border-amber-800/90';
                  cellHoverBorder = 'hover:border-amber-500';
                } else if (s.detectedType === 'Cardio') {
                  badgeStyle = 'bg-purple-950/90 text-purple-300 border-purple-800/90';
                  cellHoverBorder = 'hover:border-purple-500';
                }

                return (
                  <div
                    key={idx}
                    onClick={() => onSelectSession(s.id)}
                    className={`min-h-[60px] sm:min-h-[84px] p-1 sm:p-2 min-w-0 overflow-hidden rounded border border-zinc-800 bg-zinc-900/90 cursor-pointer transition-all flex flex-col justify-between group ${cellHoverBorder}`}
                    title={`Cliquer pour ouvrir la séance : ${s.detectedType} (${s.durationMinutes} min, ${s.exercises.length} exercices)`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 min-w-0">
                      <span className="font-mono text-[11px] sm:text-xs font-semibold text-zinc-200 leading-none">
                        {day.dayNumber}
                      </span>
                      <span
                        className={`text-[8px] sm:text-[9px] font-mono px-1 sm:px-1.5 py-0 rounded border font-semibold truncate max-w-full text-center leading-tight ${badgeStyle}`}
                      >
                        {s.detectedType}
                      </span>
                    </div>

                    <div className="sm:hidden text-[9px] font-mono text-zinc-400 truncate mt-0.5">
                      {s.durationMinutes}m
                    </div>

                    <div className="hidden sm:block text-[10px] font-mono text-zinc-400 space-y-0.5 mt-1">
                      <div className="text-zinc-300 truncate">
                        {s.durationMinutes}m &bull; {s.exercises.length} exos
                      </div>
                      <div className="text-zinc-500 truncate group-hover:text-blue-400 transition-colors">
                        Voir la séance &rarr;
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        ) : (
          /* Annual Heatmap View */
          <div>
            <div className="overflow-x-auto pb-2">
              <div className="inline-flex gap-1">
                {heatmapWeeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-1">
                    {week.map((day, dIdx) => {
                      const s = day.session;
                      let bgClass = 'bg-zinc-900/60 border border-zinc-800/40';

                      if (s) {
                        if (s.detectedType === 'Push') bgClass = 'bg-blue-600 border border-blue-500';
                        else if (s.detectedType === 'Pull') bgClass = 'bg-emerald-600 border border-emerald-500';
                        else if (s.detectedType === 'Legs') bgClass = 'bg-amber-600 border border-amber-500';
                        else bgClass = 'bg-zinc-400 border border-zinc-300';
                      }

                      return (
                        <div
                          key={dIdx}
                          onClick={() => s && onSelectSession(s.id)}
                          className={`w-3 h-3 rounded-sm transition-transform hover:scale-125 cursor-pointer ${bgClass}`}
                          title={
                            s
                              ? `${day.date} : ${s.detectedType} (${s.durationMinutes} min) - Cliquer pour ouvrir`
                              : day.date
                          }
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Active Goals Preview */}
      {goalPreviews.length > 0 && (
        <div className="p-5 rounded-lg bg-zinc-900/40 border border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-zinc-300" />
              <h2 className="text-sm font-semibold tracking-wide text-zinc-200 uppercase">
                Objectifs en cours
              </h2>
            </div>
            {onNavigateToGoals && (
              <button
                onClick={onNavigateToGoals}
                className="text-xs font-mono text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors"
              >
                <span>Gérer les objectifs</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {goalPreviews.slice(0, 6).map((gp) => (
              <div
                key={gp.goal.id}
                onClick={() => onSelectExercise(gp.goal.exerciseName)}
                className="p-3 rounded-md bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-xs text-zinc-200 truncate">
                    {gp.goal.exerciseName}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${
                      gp.status === 'achieved'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : gp.status === 'ahead'
                        ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                        : gp.status === 'on_track'
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                        : gp.status === 'behind'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    }`}
                  >
                    {gp.statusLabel}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                    <span>
                      {formatGoalValue(gp.currentValueLbs, gp.goal.targetMetric, unit)} &rarr;{' '}
                      <span className="text-zinc-200 font-semibold">
                        {formatGoalValue(gp.targetValueLbs, gp.goal.targetMetric, unit)}
                      </span>
                    </span>
                    <span className="text-zinc-300 font-semibold">{gp.progressPercent}%</span>
                  </div>
                  <div className="relative w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden border border-zinc-800">
                    <div
                      className={`h-full ${
                        gp.isAchieved
                          ? 'bg-emerald-400'
                          : gp.status === 'ahead'
                          ? 'bg-sky-400'
                          : gp.status === 'on_track'
                          ? 'bg-blue-400'
                          : 'bg-amber-400'
                      }`}
                      style={{ width: `${gp.progressPercent}%` }}
                    />
                    {!gp.isAchieved && gp.daysRemaining >= 0 && (
                      <div
                        style={{ left: `${gp.timeElapsedPercent}%` }}
                        className="absolute top-0 bottom-0 w-0.5 bg-zinc-200/75"
                        title={`Temps écoulé : ${gp.timeElapsedPercent}%`}
                      />
                    )}
                  </div>
                </div>

                <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                  <span>
                    {formatGoalMetricLabel(gp.goal)} &bull;{' '}
                    {gp.scheduleDelta >= 0 ? `+${gp.scheduleDelta}%` : `${gp.scheduleDelta}%`} vs temps
                  </span>
                  <span>{gp.daysRemaining >= 0 ? `${gp.daysRemaining} j restants` : 'Dépassé'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two Column Section: Block Comparison & Recent PRs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Block Comparison */}
        <div className="p-5 rounded-lg bg-zinc-900/40 border border-zinc-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold tracking-wide text-zinc-200 uppercase">
                Comparatif des Blocs
              </h2>
              <span className="text-xs font-mono text-zinc-500">2026 vs 2024-2025</span>
            </div>
            <p className="text-xs text-zinc-400 mb-4">
              Comparaison entre ton cycle initial de 2024-2025 et ton bloc de reprise régulier depuis août 2026.
            </p>

            <div className="border border-zinc-800 rounded-md overflow-hidden text-xs">
              <table className="w-full text-left font-mono">
                <thead className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="py-2 px-3 font-medium">Métrique</th>
                    <th className="py-2 px-3 font-medium text-right">Bloc 2024-25</th>
                    <th className="py-2 px-3 font-medium text-right text-zinc-200">Reprise 2026</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                  <tr>
                    <td className="py-2.5 px-3 text-zinc-400">Total séances</td>
                    <td className="py-2.5 px-3 text-right">{comparison.b24.count}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-zinc-100">{comparison.b26.count}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 text-zinc-400">Fréquence moyenne</td>
                    <td className="py-2.5 px-3 text-right">{comparison.b24.freq} s/sem</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-emerald-400">{comparison.b26.freq} s/sem</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 text-zinc-400">Durée moyenne</td>
                    <td className="py-2.5 px-3 text-right">{comparison.b24.avgDur} min</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-zinc-100">{comparison.b26.avgDur} min</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 text-zinc-400">Tonnage moyen / séance</td>
                    <td className="py-2.5 px-3 text-right">{formatWeight(comparison.b24.avgVol, unit)}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-zinc-100">{formatWeight(comparison.b26.avgVol, unit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[11px] text-zinc-500 font-mono mt-3">
            La reprise de 2026 affiche une fréquence très stable de 3 à 4 séances par semaine avec des séries d'intensité plus ciblées.
          </p>
        </div>

        {/* Recent PRs Feed */}
        <div className="p-5 rounded-lg bg-zinc-900/40 border border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold tracking-wide text-zinc-200 uppercase">
              Derniers Records Battus (PRs)
            </h2>
            <Award className="w-4 h-4 text-zinc-500" />
          </div>
          <p className="text-xs text-zinc-400 mb-4">
            Meilleurs 1RM estimés enregistrés au fil de tes entraînements.
          </p>

          <div className="space-y-2">
            {prs.map((pr, idx) => (
              <div
                key={idx}
                onClick={() => onSelectExercise(pr.exercise)}
                className="p-2.5 rounded-md bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900 transition-colors cursor-pointer flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-medium text-zinc-200 flex items-center gap-1.5">
                    <span>{pr.exercise}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500" />
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                    {pr.date} &bull; Série : {pr.weightLbs > 0 ? formatWeight(pr.weightLbs, unit) : 'PDC'} &times; {pr.reps} réps
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-zinc-500 font-mono block">1RM estimé</span>
                  <span className="font-mono font-semibold text-zinc-100">
                    {formatWeight(pr.est1rmLbs, unit)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
