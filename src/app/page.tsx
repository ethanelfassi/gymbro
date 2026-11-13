'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { WorkoutSession, TimePeriodFilter, UnitSystem, WorkoutGoal } from '@/lib/types';
import { cleanAndParseLiftoffCSV, filterSessionsByPeriod, extractAllExerciseNotes } from '@/lib/analytics';
import { Header } from '@/components/Header';
import { Navigation, ActiveTab } from '@/components/Navigation';
import { OverviewTab } from '@/components/tabs/OverviewTab';
import { ExerciseTab } from '@/components/tabs/ExerciseTab';
import { MuscleBalanceTab } from '@/components/tabs/MuscleBalanceTab';
import { ProgressionTab } from '@/components/tabs/ProgressionTab';
import { WorkoutLogTab } from '@/components/tabs/WorkoutLogTab';
import { GoalsTab } from '@/components/tabs/GoalsTab';
import { UploadCloud } from 'lucide-react';

export default function Home() {
  const [rawCsvText, setRawCsvText] = useState<string>('');
  const [dataSourceLabel, setDataSourceLabel] = useState<string>('Aucune donnée');
  const [isCustomCsv, setIsCustomCsv] = useState<boolean>(false);
  const [hasDefaultCsv, setHasDefaultCsv] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [period, setPeriod] = useState<TimePeriodFilter>('block_2026');
  const [unit, setUnit] = useState<UnitSystem>('lbs');
  const [excludeWarmup, setExcludeWarmup] = useState<boolean>(true);
  const [bodyweightLbs, setBodyweightLbs] = useState<number>(170);
  const [selectedExerciseName, setSelectedExerciseName] = useState<string>('Développé couché');
  const [targetSessionId, setTargetSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [goals, setGoals] = useState<WorkoutGoal[]>([]);

  // Load persisted data (CSV, goals, settings) from server storage on mount
  const loadServerData = useCallback(async () => {
    setIsLoading(true);
    setSyncError(null);
    try {
      const [csvRes, goalsRes, settingsRes] = await Promise.all([
        fetch('/api/csv', { cache: 'no-store' }),
        fetch('/api/goals', { cache: 'no-store' }),
        fetch('/api/settings', { cache: 'no-store' }),
      ]);

      if (csvRes.ok) {
        const csvData = await csvRes.json();
        setRawCsvText(csvData.csvText || '');
        setDataSourceLabel(csvData.filename || 'Aucune donnée');
        setIsCustomCsv(Boolean(csvData.isCustom));
        setHasDefaultCsv(Boolean(csvData.hasDefault));
      }

      if (goalsRes.ok) {
        const goalsData = await goalsRes.json();
        if (Array.isArray(goalsData.goals)) {
          setGoals(goalsData.goals);
        }
      }

      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        if (settings.unit === 'kg' || settings.unit === 'lbs') {
          setUnit(settings.unit);
        }
        if (typeof settings.bodyweightLbs === 'number' && settings.bodyweightLbs > 0) {
          setBodyweightLbs(settings.bodyweightLbs);
        }
        if (typeof settings.excludeWarmup === 'boolean') {
          setExcludeWarmup(settings.excludeWarmup);
        }
      }
    } catch (err) {
      console.error('Error loading server data:', err);
      setSyncError('Impossible de charger les données depuis le serveur.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServerData();
  }, [loadServerData]);

  // Persist uploaded CSV on server
  const handleCsvUpload = async (csvText: string, filename: string) => {
    setSyncError(null);
    setRawCsvText(csvText);
    setDataSourceLabel(filename);
    setIsCustomCsv(true);

    try {
      const res = await fetch('/api/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText, filename }),
      });
      if (!res.ok) {
        throw new Error('Save failed');
      }
      const saved = await res.json();
      setDataSourceLabel(saved.filename || filename);
      setIsCustomCsv(Boolean(saved.isCustom));
      setHasDefaultCsv(Boolean(saved.hasDefault));
    } catch (err) {
      console.error('Error saving CSV to server:', err);
      setSyncError('Erreur lors de la sauvegarde du CSV sur le serveur.');
    }
  };

  const handleResetToDefault = async () => {
    setSyncError(null);
    try {
      const res = await fetch('/api/csv', { method: 'DELETE' });
      if (!res.ok) throw new Error('Reset failed');
      const data = await res.json();
      setRawCsvText(data.csvText || '');
      setDataSourceLabel(data.filename || 'Aucune donnée');
      setIsCustomCsv(Boolean(data.isCustom));
      setHasDefaultCsv(Boolean(data.hasDefault));
    } catch (err) {
      console.error('Error resetting CSV:', err);
      setSyncError('Erreur lors de la réinitialisation du CSV sur le serveur.');
    }
  };

  const saveSettingsPartial = async (partial: {
    unit?: UnitSystem;
    bodyweightLbs?: number;
    excludeWarmup?: boolean;
  }) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      });
      if (!res.ok) throw new Error('Settings save failed');
    } catch (err) {
      console.error('Error saving settings:', err);
      setSyncError('Erreur lors de la sauvegarde des réglages sur le serveur.');
    }
  };

  const handleBodyweightChange = (bw: number) => {
    setBodyweightLbs(bw);
    void saveSettingsPartial({ bodyweightLbs: bw });
  };

  const handleUnitToggle = () => {
    const nextUnit: UnitSystem = unit === 'lbs' ? 'kg' : 'lbs';
    setUnit(nextUnit);
    void saveSettingsPartial({ unit: nextUnit });
  };

  const handleExcludeWarmupToggle = () => {
    const next = !excludeWarmup;
    setExcludeWarmup(next);
    void saveSettingsPartial({ excludeWarmup: next });
  };

  // Parse all workout sessions from raw CSV
  const allSessions = useMemo(() => {
    if (!rawCsvText) return [];
    return cleanAndParseLiftoffCSV(rawCsvText, bodyweightLbs);
  }, [rawCsvText, bodyweightLbs]);

  const allExerciseNotes = useMemo(() => {
    if (!rawCsvText) return new Map<string, string[]>();
    return extractAllExerciseNotes(rawCsvText);
  }, [rawCsvText]);

  // Filter sessions according to the active period
  const filteredSessions = useMemo(() => {
    return filterSessionsByPeriod(allSessions, period);
  }, [allSessions, period]);

  // Drag and drop event listeners
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          handleCsvUpload(text, file.name);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleNavigateToExercise = (name: string) => {
    setSelectedExerciseName(name);
    setActiveTab('exercises');
  };

  const handleSelectSession = (sessionId: string) => {
    setTargetSessionId(sessionId);
    setActiveTab('log');
  };

  const handleSaveGoal = async (goal: WorkoutGoal) => {
    setSyncError(null);
    setGoals((prev) => {
      const exists = prev.some((g) => g.id === goal.id);
      return exists ? prev.map((g) => (g.id === goal.id ? goal : g)) : [...prev, goal];
    });

    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal }),
      });
      if (!res.ok) throw new Error('Save goal failed');
      const data = await res.json();
      if (Array.isArray(data.goals)) setGoals(data.goals);
    } catch (err) {
      console.error('Error saving goal:', err);
      setSyncError('Erreur lors de la sauvegarde de l\'objectif sur le serveur.');
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    setSyncError(null);
    setGoals((prev) => prev.filter((g) => g.id !== goalId));

    try {
      const res = await fetch(`/api/goals?id=${encodeURIComponent(goalId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete goal failed');
      const data = await res.json();
      if (Array.isArray(data.goals)) setGoals(data.goals);
    } catch (err) {
      console.error('Error deleting goal:', err);
      setSyncError('Erreur lors de la suppression de l\'objectif sur le serveur.');
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="min-h-screen bg-[#090B0E] text-zinc-100 flex flex-col relative"
    >
      {/* Drag & Drop Visual Backdrop */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-[#090B0E]/90 backdrop-blur-sm border-2 border-dashed border-zinc-500 flex flex-col items-center justify-center p-6">
          <UploadCloud className="w-16 h-16 text-zinc-400 mb-4 animate-bounce" />
          <h2 className="text-xl font-semibold tracking-wide uppercase text-zinc-100">
            Dépose ton fichier CSV Liftoff ici
          </h2>
          <p className="text-sm font-mono text-zinc-400 mt-2">
            Analyse et actualisation instantanée de toutes tes séances
          </p>
        </div>
      )}

      {/* Header bar */}
      <Header
        period={period}
        onPeriodChange={setPeriod}
        unit={unit}
        onUnitToggle={handleUnitToggle}
        excludeWarmup={excludeWarmup}
        onExcludeWarmupToggle={handleExcludeWarmupToggle}
        bodyweightLbs={bodyweightLbs}
        onBodyweightChange={handleBodyweightChange}
        onCsvUpload={handleCsvUpload}
        onResetToDefault={handleResetToDefault}
        dataSourceLabel={dataSourceLabel}
        isCustomCsv={isCustomCsv}
        hasDefaultCsv={hasDefaultCsv}
      />

      {/* Navigation tabs */}
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        sessionCount={filteredSessions.length}
        goalsCount={goals.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {syncError && (
          <div className="mb-4 px-3 py-2 rounded-md bg-rose-950/50 border border-rose-800/70 text-xs font-mono text-rose-300 flex items-center justify-between">
            <span>{syncError}</span>
            <button
              onClick={() => setSyncError(null)}
              className="text-rose-400 hover:text-rose-200 ml-3"
            >
              Fermer
            </button>
          </div>
        )}
        {isLoading ? (
          <div className="h-64 flex items-center justify-center font-mono text-xs text-zinc-500">
            Chargement et parsing des données Liftoff...
          </div>
        ) : !rawCsvText.trim() ? (
          <div className="p-10 rounded-lg bg-zinc-900/40 border border-dashed border-zinc-700 text-center space-y-3">
            <UploadCloud className="w-10 h-10 text-zinc-500 mx-auto" />
            <div className="text-sm font-semibold text-zinc-200">
              Aucune donnée d'entraînement importée
            </div>
            <p className="text-xs font-mono text-zinc-500 max-w-md mx-auto">
              Glisse-dépose ton fichier export CSV Liftoff sur cette fenêtre ou utilise le bouton « Importer CSV » dans l'en-tête.
            </p>
            <div>
              <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-mono font-semibold cursor-pointer transition-colors">
                <span>Choisir un fichier CSV</span>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const text = ev.target?.result as string;
                      if (text) void handleCsvUpload(text, file.name);
                    };
                    reader.readAsText(file);
                  }}
                />
              </label>
            </div>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="p-8 rounded-lg bg-zinc-900/40 border border-zinc-800 text-center font-mono text-xs text-zinc-500 space-y-2">
            <div>Aucune séance trouvée pour cette période.</div>
            <button
              onClick={() => setPeriod('all')}
              className="text-zinc-300 underline underline-offset-2"
            >
              Afficher tout l'historique
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <OverviewTab
                sessions={filteredSessions}
                allSessions={allSessions}
                unit={unit}
                onSelectExercise={handleNavigateToExercise}
                onSelectSession={handleSelectSession}
                goals={goals}
                onNavigateToGoals={() => setActiveTab('goals')}
                bodyweightLbs={bodyweightLbs}
              />
            )}

            {activeTab === 'exercises' && (
              <ExerciseTab
                sessions={filteredSessions}
                unit={unit}
                bodyweightLbs={bodyweightLbs}
                selectedExerciseName={selectedExerciseName}
                onSelectExercise={setSelectedExerciseName}
                allExerciseNotes={allExerciseNotes}
                goals={goals}
              />
            )}

            {activeTab === 'muscles' && (
              <MuscleBalanceTab sessions={filteredSessions} />
            )}

            {activeTab === 'progression' && (
              <ProgressionTab
                sessions={filteredSessions}
                unit={unit}
                bodyweightLbs={bodyweightLbs}
                onSelectExercise={handleNavigateToExercise}
              />
            )}

            {activeTab === 'goals' && (
              <GoalsTab
                goals={goals}
                sessions={allSessions}
                unit={unit}
                bodyweightLbs={bodyweightLbs}
                onSelectExercise={handleNavigateToExercise}
                onSaveGoal={handleSaveGoal}
                onDeleteGoal={handleDeleteGoal}
              />
            )}

            {activeTab === 'log' && (
              <WorkoutLogTab
                sessions={filteredSessions}
                unit={unit}
                onSelectExercise={handleNavigateToExercise}
                targetSessionId={targetSessionId}
                onClearTargetSession={() => setTargetSessionId(null)}
              />
            )}
          </>
        )}
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-zinc-800/60 py-4 px-4 sm:px-6 text-center text-[11px] font-mono text-zinc-600">
        GYMBRO ANALYTICS &bull; Conçu pour l'analyse de musculation haute précision &bull; Données Liftoff
      </footer>
    </div>
  );
}
