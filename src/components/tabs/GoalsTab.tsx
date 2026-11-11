'use client';

import React, { useState, useMemo } from 'react';
import { WorkoutGoal, WorkoutSession, UnitSystem } from '@/lib/types';
import { calculateGoalProgress } from '@/lib/goals';
import { formatWeight, lbsToKg, kgToLbs } from '@/lib/analytics';
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
  const [formMetric, setFormMetric] = useState<'1rm' | 'top_weight'>('1rm');
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
    const onTrack = progressList.filter((p) => !p.isAchieved && p.status === 'on_track').length;
    const avgProgress = total > 0
      ? Math.round(progressList.reduce((acc, p) => acc + p.progressPercent, 0) / total)
      : 0;

    return { total, achieved, onTrack, avgProgress };
  }, [progressList]);

  const openNewGoalModal = () => {
    setEditingGoal(null);
    const defaultEx = availableExercises.length > 0 ? availableExercises[0] : 'Développé couché';
    setFormExName(defaultEx);
    setFormMetric('1rm');
    setFormWeight(unit === 'kg' ? '80' : '175');
    setFormReps('8');
    setFormDate('2026-12-31');
    setFormStartWeight(unit === 'kg' ? '60' : '135');
    setFormNote('Avant 2027');
    setIsModalOpen(true);
  };

  const openEditModal = (goal: WorkoutGoal) => {
    setEditingGoal(goal);
    setFormExName(goal.exerciseName);
    setFormMetric(goal.targetMetric);
    setFormWeight(String(unit === 'kg' ? lbsToKg(goal.targetWeightLbs) : goal.targetWeightLbs));
    setFormReps(String(goal.targetReps || 8));
    setFormDate(goal.targetDate);
    setFormStartWeight(String(unit === 'kg' ? lbsToKg(goal.startWeightLbs) : goal.startWeightLbs));
    setFormNote(goal.note || '');
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawTargetWeight = parseFloat(formWeight);
    const rawStartWeight = parseFloat(formStartWeight);

    if (isNaN(rawTargetWeight) || rawTargetWeight <= 0) return;

    // Convert to lbs if entered in kg
    const targetWeightLbs = unit === 'kg' ? kgToLbs(rawTargetWeight) : rawTargetWeight;
    const startWeightLbs = !isNaN(rawStartWeight)
      ? (unit === 'kg' ? kgToLbs(rawStartWeight) : rawStartWeight)
      : targetWeightLbs * 0.8;

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
          <div className="text-xs font-mono text-zinc-500 uppercase">En bonne voie</div>
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
            const targetDisplay = unit === 'kg' ? `${lbsToKg(g.targetWeightLbs)} kg` : `${g.targetWeightLbs} lbs`;
            const currentDisplay = unit === 'kg' ? `${lbsToKg(item.currentValueLbs)} kg` : `${item.currentValueLbs} lbs`;
            const startDisplay = unit === 'kg' ? `${lbsToKg(item.startValueLbs)} kg` : `${item.startValueLbs} lbs`;
            const remainingDisplay = unit === 'kg' ? `${lbsToKg(item.remainingWeightLbs)} kg` : `${item.remainingWeightLbs} lbs`;

            let badgeStyle = 'bg-zinc-800 text-zinc-300 border-zinc-700';
            if (item.status === 'achieved') {
              badgeStyle = 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
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
                  <div className="flex items-center gap-3">
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
                      {g.targetMetric === '1rm' ? '(1RM)' : `(${g.targetReps || 8} réps)`}
                    </span>
                  </div>

                  <div className="p-2.5 rounded bg-zinc-950/70 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 block uppercase">Actuel</span>
                    <span className="text-sm font-semibold text-zinc-100">
                      {currentDisplay}
                    </span>
                  </div>

                  <div className="p-2.5 rounded bg-zinc-950/70 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 block uppercase">Reste</span>
                    <span className={`text-sm font-semibold ${item.isAchieved ? 'text-emerald-400' : 'text-zinc-200'}`}>
                      {item.isAchieved ? 'Atteint !' : `+${remainingDisplay}`}
                    </span>
                  </div>

                  <div className="p-2.5 rounded bg-zinc-950/70 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 block uppercase">Échéance</span>
                    <span className="text-xs font-semibold text-zinc-200">
                      {g.targetDate}
                    </span>
                    <span className="text-[10px] text-zinc-500 block mt-0.5">
                      {item.isAchieved && item.achievedDate
                        ? `Validé le ${item.achievedDate}`
                        : item.daysRemaining >= 0
                        ? `Dans ${item.daysRemaining} jour${item.daysRemaining > 1 ? 's' : ''}`
                        : 'Date dépassée'}
                    </span>
                  </div>
                </div>

                {/* Visual Progress Bar */}
                <div className="space-y-1.5 font-mono">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>Avancement : <strong className="text-zinc-200">{item.progressPercent}%</strong></span>
                    <span className="text-[11px] text-zinc-500">
                      Départ : {startDisplay} &rarr; Cible : {targetDisplay}
                    </span>
                  </div>

                  <div className="w-full h-2.5 rounded-full bg-zinc-950 border border-zinc-800 overflow-hidden">
                    <div
                      style={{ width: `${item.progressPercent}%` }}
                      className={`h-full transition-all duration-500 ${
                        item.isAchieved
                          ? 'bg-emerald-500'
                          : item.status === 'on_track'
                          ? 'bg-blue-500'
                          : 'bg-amber-500'
                      }`}
                    />
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
                <label className="text-zinc-400 text-[11px] uppercase">Exercice</label>
                <select
                  value={formExName}
                  onChange={(e) => setFormExName(e.target.value)}
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
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormMetric('1rm')}
                    className={`p-2 rounded border text-center transition-colors ${
                      formMetric === '1rm'
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-100 font-semibold'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    1RM Estimé
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormMetric('top_weight')}
                    className={`p-2 rounded border text-center transition-colors ${
                      formMetric === 'top_weight'
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-100 font-semibold'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    Top Set (Charge directe)
                  </button>
                </div>
              </div>

              {/* Target Weight & Reps */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-400 text-[11px] uppercase">
                    Charge Cible ({unit.toUpperCase()})
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={formWeight}
                    onChange={(e) => setFormWeight(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2 rounded focus:outline-none focus:border-zinc-700"
                    required
                  />
                </div>

                {formMetric === 'top_weight' ? (
                  <div className="space-y-1">
                    <label className="text-zinc-400 text-[11px] uppercase">Réps Cibles</label>
                    <input
                      type="number"
                      value={formReps}
                      onChange={(e) => setFormReps(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2 rounded focus:outline-none focus:border-zinc-700"
                      required
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-zinc-400 text-[11px] uppercase">Charge de Départ ({unit.toUpperCase()})</label>
                    <input
                      type="number"
                      step="0.5"
                      value={formStartWeight}
                      onChange={(e) => setFormStartWeight(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2 rounded focus:outline-none focus:border-zinc-700"
                    />
                  </div>
                )}
              </div>

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
