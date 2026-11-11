'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { WorkoutSession, TimePeriodFilter, UnitSystem, WorkoutGoal } from '@/lib/types';
import { cleanAndParseLiftoffCSV, filterSessionsByPeriod, extractAllExerciseNotes } from '@/lib/analytics';
import { loadGoalsFromStorage, saveGoalsToStorage } from '@/lib/goals';
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
  const [dataSourceLabel, setDataSourceLabel] = useState<string>('Export Liftoff du projet');
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [period, setPeriod] = useState<TimePeriodFilter>('block_2026');
  const [unit, setUnit] = useState<UnitSystem>('lbs');
  const [excludeWarmup, setExcludeWarmup] = useState<boolean>(true);
  const [bodyweightLbs, setBodyweightLbs] = useState<number>(170);
  const [selectedExerciseName, setSelectedExerciseName] = useState<string>('Développé couché');
  const [targetSessionId, setTargetSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [goals, setGoals] = useState<WorkoutGoal[]>([]);

  // Load project default CSV on mount
  const loadDefaultCsv = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load saved goals
      const storedGoals = loadGoalsFromStorage();
      setGoals(storedGoals);

      // Check localStorage for previously saved upload
      const savedCsv = localStorage.getItem('gymbro_custom_csv');
      const savedLabel = localStorage.getItem('gymbro_custom_csv_label');
      const savedBw = localStorage.getItem('gymbro_bodyweight');
      const savedUnit = localStorage.getItem('gymbro_unit');

      if (savedBw) setBodyweightLbs(parseFloat(savedBw));
      if (savedUnit) setUnit(savedUnit as UnitSystem);

      if (savedCsv && savedLabel) {
        setRawCsvText(savedCsv);
        setDataSourceLabel(savedLabel);
      } else {
        const res = await fetch('/liftoff_workout_data.csv');
        const text = await res.text();
        setRawCsvText(text);
        setDataSourceLabel('Export Liftoff du projet');
      }
    } catch (err) {
      console.error('Error fetching CSV:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDefaultCsv();
  }, [loadDefaultCsv]);

  // Handle uploaded CSV
  const handleCsvUpload = (csvText: string, filename: string) => {
    setRawCsvText(csvText);
    setDataSourceLabel(filename);
    try {
      localStorage.setItem('gymbro_custom_csv', csvText);
      localStorage.setItem('gymbro_custom_csv_label', filename);
    } catch {
      // ignore storage quota issues
    }
  };

  const handleResetToDefault = async () => {
    localStorage.removeItem('gymbro_custom_csv');
    localStorage.removeItem('gymbro_custom_csv_label');
    const res = await fetch('/liftoff_workout_data.csv');
    const text = await res.text();
    setRawCsvText(text);
    setDataSourceLabel('Export Liftoff du projet');
  };

  const handleBodyweightChange = (bw: number) => {
    setBodyweightLbs(bw);
    localStorage.setItem('gymbro_bodyweight', String(bw));
  };

  const handleUnitToggle = () => {
    const nextUnit: UnitSystem = unit === 'lbs' ? 'kg' : 'lbs';
    setUnit(nextUnit);
    localStorage.setItem('gymbro_unit', nextUnit);
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

  const handleSaveGoal = (goal: WorkoutGoal) => {
    setGoals((prev) => {
      const exists = prev.some((g) => g.id === goal.id);
      const updated = exists ? prev.map((g) => (g.id === goal.id ? goal : g)) : [...prev, goal];
      saveGoalsToStorage(updated);
      return updated;
    });
  };

  const handleDeleteGoal = (goalId: string) => {
    setGoals((prev) => {
      const updated = prev.filter((g) => g.id !== goalId);
      saveGoalsToStorage(updated);
      return updated;
    });
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
        onExcludeWarmupToggle={() => setExcludeWarmup(!excludeWarmup)}
        bodyweightLbs={bodyweightLbs}
        onBodyweightChange={handleBodyweightChange}
        onCsvUpload={handleCsvUpload}
        onResetToDefault={handleResetToDefault}
        dataSourceLabel={dataSourceLabel}
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
        {isLoading ? (
          <div className="h-64 flex items-center justify-center font-mono text-xs text-zinc-500">
            Chargement et parsing des données Liftoff...
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
