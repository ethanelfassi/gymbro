'use client';

import React from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  Activity,
  Zap,
  Calendar,
  Target,
} from 'lucide-react';

export type ActiveTab = 'overview' | 'exercises' | 'muscles' | 'progression' | 'goals' | 'log';

interface NavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  sessionCount: number;
  goalsCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  sessionCount,
  goalsCount,
}) => {
  const tabs = [
    {
      id: 'overview' as ActiveTab,
      label: "Vue d'ensemble",
      icon: LayoutDashboard,
    },
    {
      id: 'exercises' as ActiveTab,
      label: 'Analyse par exercice',
      icon: TrendingUp,
    },
    {
      id: 'muscles' as ActiveTab,
      label: 'Équilibre musculaire',
      icon: Activity,
    },
    {
      id: 'progression' as ActiveTab,
      label: 'Surcharge & Fatigue',
      icon: Zap,
    },
    {
      id: 'goals' as ActiveTab,
      label: 'Objectifs',
      icon: Target,
      badge: goalsCount,
    },
    {
      id: 'log' as ActiveTab,
      label: 'Journal des séances',
      icon: Calendar,
      badge: sessionCount,
    },
  ];

  return (
    <nav className="border-b border-zinc-800/80 bg-[#090B0E]/95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex space-x-1 sm:space-x-4 overflow-x-auto py-2 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-zinc-800/80 text-zinc-100 shadow-sm border border-zinc-700/60'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-zinc-200' : 'text-zinc-500'
                  }`}
                />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded text-[10px] font-mono ${
                      isActive
                        ? 'bg-zinc-700 text-zinc-200'
                        : 'bg-zinc-900 text-zinc-500'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
