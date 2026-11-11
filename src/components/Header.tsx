'use client';

import React, { useRef, useState } from 'react';
import { TimePeriodFilter, UnitSystem } from '@/lib/types';
import { Upload, Scale, Flame, RefreshCw } from 'lucide-react';

interface HeaderProps {
  period: TimePeriodFilter;
  onPeriodChange: (p: TimePeriodFilter) => void;
  unit: UnitSystem;
  onUnitToggle: () => void;
  excludeWarmup: boolean;
  onExcludeWarmupToggle: () => void;
  bodyweightLbs: number;
  onBodyweightChange: (bw: number) => void;
  onCsvUpload: (csvText: string, filename: string) => void;
  onResetToDefault: () => void;
  dataSourceLabel: string;
  isCustomCsv?: boolean;
  hasDefaultCsv?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  period,
  onPeriodChange,
  unit,
  onUnitToggle,
  excludeWarmup,
  onExcludeWarmupToggle,
  bodyweightLbs,
  onBodyweightChange,
  onCsvUpload,
  onResetToDefault,
  dataSourceLabel,
  isCustomCsv,
  hasDefaultCsv,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditingBw, setIsEditingBw] = useState(false);
  const [bwInput, setBwInput] = useState(String(bodyweightLbs));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        onCsvUpload(text, file.name);
      }
    };
    reader.readAsText(file);
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const saveBw = () => {
    const val = parseFloat(bwInput);
    if (!isNaN(val) && val > 0) {
      onBodyweightChange(val);
    }
    setIsEditingBw(false);
  };

  return (
    <header className="border-b border-zinc-800/80 bg-[#0C0E12]/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded border border-zinc-700 bg-zinc-900 flex items-center justify-center font-mono font-semibold text-xs tracking-wider text-zinc-200">
              GB
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold tracking-wide text-zinc-100 uppercase">
                  GymBro Analytics
                </h1>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                  Liftoff Sync
                </span>
              </div>
              <p className="text-xs text-zinc-500 font-mono">
                Source : <span className="text-zinc-400">{dataSourceLabel}</span>
              </p>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            
            {/* Period Selector */}
            <div className="inline-flex rounded-md bg-zinc-900 border border-zinc-800 p-0.5 text-zinc-400">
              <button
                onClick={() => onPeriodChange('block_2026')}
                className={`px-2.5 py-1 rounded transition-all text-xs font-medium ${
                  period === 'block_2026'
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                    : 'hover:text-zinc-200'
                }`}
                title="Reprise actuelle depuis août 2026"
              >
                Bloc 2026
              </button>
              <button
                onClick={() => onPeriodChange('90d')}
                className={`px-2.5 py-1 rounded transition-all text-xs font-medium ${
                  period === '90d'
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                    : 'hover:text-zinc-200'
                }`}
              >
                90 jours
              </button>
              <button
                onClick={() => onPeriodChange('30d')}
                className={`px-2.5 py-1 rounded transition-all text-xs font-medium ${
                  period === '30d'
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                    : 'hover:text-zinc-200'
                }`}
              >
                30 jours
              </button>
              <button
                onClick={() => onPeriodChange('block_2024_2025')}
                className={`px-2.5 py-1 rounded transition-all text-xs font-medium ${
                  period === 'block_2024_2025'
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                    : 'hover:text-zinc-200'
                }`}
              >
                Bloc 2024-25
              </button>
              <button
                onClick={() => onPeriodChange('all')}
                className={`px-2.5 py-1 rounded transition-all text-xs font-medium ${
                  period === 'all'
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                    : 'hover:text-zinc-200'
                }`}
              >
                Tout
              </button>
            </div>

            {/* Unit Switcher */}
            <button
              onClick={onUnitToggle}
              className="px-2.5 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 font-mono transition-colors flex items-center gap-1.5"
              title="Basculer entre livres (lbs) et kilogrammes (kg)"
            >
              <Scale className="w-3.5 h-3.5 text-zinc-400" />
              <span className="font-semibold text-zinc-200">{unit.toUpperCase()}</span>
            </button>

            {/* Warmup Exclusion Toggle */}
            <button
              onClick={onExcludeWarmupToggle}
              className={`px-2.5 py-1.5 rounded-md border font-medium transition-colors flex items-center gap-1.5 ${
                excludeWarmup
                  ? 'bg-zinc-900/90 border-zinc-700 text-zinc-200'
                  : 'bg-zinc-950 border-zinc-800/60 text-zinc-500 line-through'
              }`}
              title="Exclure les séries d'échauffement (< 65% de la charge max) des statistiques de travail"
            >
              <Flame className={`w-3.5 h-3.5 ${excludeWarmup ? 'text-amber-500' : 'text-zinc-600'}`} />
              <span>Hors échauffement</span>
            </button>

            {/* Bodyweight inline setting */}
            <div className="flex items-center px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono">
              <span className="mr-1 text-[11px] text-zinc-500">PDC:</span>
              {isEditingBw ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={bwInput}
                    onChange={(e) => setBwInput(e.target.value)}
                    onBlur={saveBw}
                    onKeyDown={(e) => e.key === 'Enter' && saveBw()}
                    className="w-14 bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs px-1 rounded focus:outline-none"
                    autoFocus
                  />
                  <span className="text-[11px] text-zinc-400">lbs</span>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setBwInput(String(bodyweightLbs));
                    setIsEditingBw(true);
                  }}
                  className="hover:text-zinc-200 text-zinc-300 font-semibold underline decoration-zinc-700 decoration-dotted underline-offset-2"
                  title="Cliquer pour modifier ton poids de corps (utilisé pour le calcul de charge nette sur Dips & Tractions)"
                >
                  {bodyweightLbs} lbs
                </button>
              )}
            </div>

            {/* CSV Import */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-medium transition-colors flex items-center gap-1.5"
              title="Importer un nouvel export CSV Liftoff"
            >
              <Upload className="w-3.5 h-3.5 text-zinc-400" />
              <span>Importer CSV</span>
            </button>

            {/* Reset to project default CSV (only shown when a default fallback exists) */}
            {Boolean(hasDefaultCsv && isCustomCsv) && (
              <button
                onClick={onResetToDefault}
                className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 hover:text-zinc-200 text-zinc-400"
                title="Revenir aux données initiales du projet"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};
