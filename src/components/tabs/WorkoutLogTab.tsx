'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { WorkoutSession, UnitSystem } from '@/lib/types';
import { formatWeight, lbsToKg } from '@/lib/analytics';
import { ChevronDown, ChevronRight, Clock, Dumbbell, Calendar, FileText, CornerDownRight } from 'lucide-react';

interface WorkoutLogTabProps {
  sessions: WorkoutSession[];
  unit: UnitSystem;
  onSelectExercise: (name: string) => void;
  targetSessionId?: string | null;
  onClearTargetSession?: () => void;
}

export const WorkoutLogTab: React.FC<WorkoutLogTabProps> = ({
  sessions,
  unit,
  onSelectExercise,
  targetSessionId,
  onClearTargetSession,
}) => {
  const [splitFilter, setSplitFilter] = useState<string>('Tous');
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);

  // Reverse chronological order
  const chronologicalSessions = useMemo(() => {
    return sessions.slice().reverse();
  }, [sessions]);

  // Initial expand of latest 3
  useEffect(() => {
    if (chronologicalSessions.length > 0 && !targetSessionId) {
      const initial = new Set<string>();
      chronologicalSessions.slice(0, 3).forEach((s) => initial.add(s.id));
      setExpandedSessions(initial);
    }
  }, [chronologicalSessions, targetSessionId]);

  // Handle targetSessionId when user clicks from calendar
  useEffect(() => {
    if (targetSessionId) {
      // Find the target session to check if filter matches
      const target = sessions.find((s) => s.id === targetSessionId);
      if (target && splitFilter !== 'Tous' && target.detectedType !== splitFilter) {
        setSplitFilter('Tous');
      }

      setExpandedSessions((prev) => {
        const next = new Set(prev);
        next.add(targetSessionId);
        return next;
      });

      setActiveHighlightId(targetSessionId);

      // Scroll smoothly to target element
      setTimeout(() => {
        const el = document.getElementById(`session-${targetSessionId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);

      // Clear highlight after 5 seconds
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => {
        setActiveHighlightId(null);
        if (onClearTargetSession) onClearTargetSession();
      }, 5000);
    }

    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, [targetSessionId, sessions, splitFilter, onClearTargetSession]);

  const toggleSession = (id: string) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredSessions = useMemo(() => {
    if (splitFilter === 'Tous') return chronologicalSessions;
    return chronologicalSessions.filter((s) => s.detectedType === splitFilter);
  }, [chronologicalSessions, splitFilter]);

  return (
    <div className="space-y-6">
      
      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-zinc-900/60 border border-zinc-800">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold tracking-wide text-zinc-200 uppercase">
            Journal Chronologique des Séances
          </h2>
          <span className="text-xs font-mono text-zinc-500">
            ({filteredSessions.length} séances)
          </span>
        </div>

        {/* Split selector */}
        <div className="flex flex-wrap gap-1 text-xs font-mono">
          {['Tous', 'Push', 'Pull', 'Legs', 'Upper', 'Cardio'].map((type) => (
            <button
              key={type}
              onClick={() => setSplitFilter(type)}
              className={`px-2.5 py-1 rounded transition-colors ${
                splitFilter === type
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 font-medium'
                  : 'bg-zinc-950 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Workout Sessions List */}
      <div className="space-y-3">
        {filteredSessions.map((session) => {
          const isExpanded = expandedSessions.has(session.id);
          const isTargeted = activeHighlightId === session.id;

          let splitBadgeColor = 'bg-zinc-800 text-zinc-300 border-zinc-700';
          if (session.detectedType === 'Push') splitBadgeColor = 'bg-blue-950/70 text-blue-300 border-blue-800/80';
          else if (session.detectedType === 'Pull') splitBadgeColor = 'bg-emerald-950/70 text-emerald-300 border-emerald-800/80';
          else if (session.detectedType === 'Legs') splitBadgeColor = 'bg-amber-950/70 text-amber-300 border-amber-800/80';
          else if (session.detectedType === 'Cardio') splitBadgeColor = 'bg-purple-950/70 text-purple-300 border-purple-800/80';

          return (
            <div
              key={session.id}
              id={`session-${session.id}`}
              className={`rounded-lg transition-all duration-300 overflow-hidden ${
                isTargeted
                  ? 'bg-zinc-900 border-2 border-blue-500/80 shadow-lg shadow-blue-500/10 ring-2 ring-blue-500/20'
                  : 'bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {/* Session Header Card */}
              <div
                onClick={() => toggleSession(session.id)}
                className="p-4 cursor-pointer hover:bg-zinc-900/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono"
              >
                <div className="flex items-center gap-3">
                  <button className="text-zinc-500 hover:text-zinc-300">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-zinc-100 text-sm">
                        {session.dateStr}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] border shrink-0 ${splitBadgeColor}`}>
                        {session.detectedType}
                      </span>
                      {session.sessionTitle && (
                        <span className="text-[11px] text-zinc-400 italic truncate max-w-full">
                          &ldquo;{session.sessionTitle}&rdquo;
                        </span>
                      )}
                      {isTargeted && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-200 border border-blue-700 flex items-center gap-1">
                          <CornerDownRight className="w-3 h-3" /> Sélectionnée depuis le calendrier
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-500 flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-600" />
                        {session.durationMinutes} min
                      </span>
                      <span>&bull;</span>
                      <span>{session.exercises.length} exercices</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <div>
                    <div className="text-[10px] text-zinc-500">Volume de travail</div>
                    <div className="font-semibold text-zinc-200">
                      {formatWeight(session.totalVolumeLbs, unit)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-500">Séries effectives</div>
                    <div className="font-semibold text-zinc-200">
                      {session.totalEffectiveSets} séries
                    </div>
                  </div>
                </div>
              </div>

              {/* Session Details when expanded */}
              {isExpanded && (
                <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/60 space-y-4">
                  {session.exercises.map((ex, exIdx) => (
                    <div
                      key={exIdx}
                      className="p-3 rounded bg-zinc-900/60 border border-zinc-800/70 text-xs font-mono space-y-2"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <button
                          onClick={() => onSelectExercise(ex.name)}
                          className="font-semibold text-zinc-200 hover:text-blue-400 transition-colors text-left"
                        >
                          {ex.name}
                        </button>
                        <div className="text-[11px] text-zinc-500 flex flex-wrap items-center gap-3">
                          {ex.meta.mechanic === 'duration' ? (
                            <span>Meilleure série : <strong className="text-zinc-200">{ex.topSetDurationSeconds}s</strong></span>
                          ) : ex.meta.mechanic === 'bodyweight' && ex.topSetWeightLbs === 0 ? (
                            <>
                              <span>Top Set : <strong className="text-zinc-200">PDC</strong> &times; {ex.topSetReps} réps</span>
                              <span>1RM: <strong className="text-zinc-200">{formatWeight(ex.topSet1rmLbs, unit)}</strong></span>
                            </>
                          ) : ex.meta.mechanic === 'assisted' ? (
                            <>
                              <span>Top Set : <strong className="text-zinc-200">-{formatWeight(ex.topSetWeightLbs, unit)} (assist.)</strong> &times; {ex.topSetReps}</span>
                              <span>1RM net: <strong className="text-zinc-200">{formatWeight(ex.topSet1rmLbs, unit)}</strong></span>
                            </>
                          ) : (
                            <>
                              <span>Top Set : <strong className="text-zinc-200">{unit === 'kg' ? `${lbsToKg(ex.topSetWeightLbs)} kg` : `${ex.topSetWeightLbs} lbs`}</strong> &times; {ex.topSetReps}</span>
                              <span>1RM: <strong className="text-zinc-200">{formatWeight(ex.topSet1rmLbs, unit)}</strong></span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Sets list */}
                      <div className="flex flex-wrap gap-2">
                        {ex.sets.map((st, sIdx) => (
                          <div
                            key={sIdx}
                            className={`px-2.5 py-1 rounded text-[11px] border flex items-center gap-1.5 ${
                              st.isWarmup
                                ? 'bg-zinc-950 border-zinc-800 text-zinc-500'
                                : 'bg-zinc-800/90 border-zinc-700 text-zinc-200'
                            }`}
                          >
                            <span className="text-zinc-500 font-semibold">S{st.setIndex + 1}:</span>
                            {st.distance > 0 ? (
                              <span>{st.distance} km</span>
                            ) : st.durationSeconds > 0 ? (
                              <span>{st.durationSeconds}s</span>
                            ) : ex.meta.mechanic === 'bodyweight' && st.weightLbs === 0 ? (
                              <span>PDC &times; {st.reps}</span>
                            ) : ex.meta.mechanic === 'assisted' ? (
                              <span>
                                -{unit === 'kg' ? `${lbsToKg(st.weightLbs)} kg` : `${st.weightLbs} lbs`} &times; {st.reps}
                              </span>
                            ) : (
                              <span>
                                {unit === 'kg' ? `${lbsToKg(st.weightLbs)} kg` : `${st.weightLbs} lbs`} &times; {st.reps}
                              </span>
                            )}
                            {st.isWarmup && (
                              <span className="text-[9px] text-zinc-500 uppercase ml-0.5">Échauff.</span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Notes if any */}
                      {ex.sets.some((s) => s.notes) && (
                        <div className="mt-1 p-2 rounded bg-zinc-950 border border-zinc-800/50 text-[11px] text-zinc-400 space-y-1">
                          <div className="flex items-center gap-1.5 text-zinc-500 font-semibold text-[10px] uppercase">
                            <FileText className="w-3 h-3" />
                            <span>Notes de séance</span>
                          </div>
                          {Array.from(new Set(ex.sets.map((s) => s.notes).filter(Boolean))).map((note, nIdx) => (
                            <p key={nIdx} className="whitespace-pre-line text-zinc-300">
                              {note}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
};
