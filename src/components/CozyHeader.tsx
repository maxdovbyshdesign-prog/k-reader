/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BookOpen, Settings, Library, Info } from 'lucide-react';

interface CozyHeaderProps {
  activeTab: 'library' | 'reader' | 'settings' | 'about';
  setActiveTab: (tab: 'library' | 'reader' | 'settings' | 'about') => void;
  hasActiveBook: boolean;
}

export default function CozyHeader({ activeTab, setActiveTab, hasActiveBook }: CozyHeaderProps) {
  return (
    <header className="border-b border-white/5 bg-[#0A0A0B]/60 backdrop-blur-md sticky top-0 z-50 px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div 
          onClick={() => setActiveTab('library')} 
          className="flex items-center gap-3 cursor-pointer select-none group"
        >
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#F27D26]/20 to-[#F27D26]/5 border border-[#F27D26]/30 group-hover:border-[#F27D26]/50 transition-all duration-300">
            <BookOpen className="w-5 h-5 text-[#F27D26] group-hover:scale-105 transition-transform" />
          </div>
          <div>
            <h1 className="font-serif italic font-semibold tracking-wide text-[#F27D26] text-xl transition-colors">
              Ksyusha Reader
            </h1>
            <p className="text-[9px] tracking-[0.18em] text-[#E0D8D0]/50 uppercase">
              Твоя личная говорящая библиотека
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-1.5">
          <button
            id="nav-btn-library"
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-300 ${
              activeTab === 'library'
                ? 'bg-[#F27D26]/10 text-[#F27D26] border border-[#F27D26]/20'
                : 'text-[#E0D8D0]/60 hover:text-[#E0D8D0] hover:bg-white/5'
            }`}
          >
            <Library className="w-4 h-4" />
            <span className="hidden sm:inline">Библиотека</span>
          </button>

          {hasActiveBook && (
            <button
              id="nav-btn-reader"
              onClick={() => setActiveTab('reader')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-300 ${
                activeTab === 'reader'
                  ? 'bg-[#F27D26]/10 text-[#F27D26] border border-[#F27D26]/20'
                  : 'text-[#E0D8D0]/60 hover:text-[#E0D8D0] hover:bg-white/5 animate-pulse'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Плеер</span>
            </button>
          )}

          <button
            id="nav-btn-settings"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-300 ${
              activeTab === 'settings'
                ? 'bg-[#F27D26]/10 text-[#F27D26] border border-[#F27D26]/20'
                : 'text-[#E0D8D0]/60 hover:text-[#E0D8D0] hover:bg-white/5'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Настройки</span>
          </button>

          <button
            id="nav-btn-about"
            onClick={() => setActiveTab('about')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-300 ${
              activeTab === 'about'
                ? 'bg-[#F27D26]/10 text-[#F27D26] border border-[#F27D26]/20'
                : 'text-[#E0D8D0]/60 hover:text-[#E0D8D0] hover:bg-white/5'
            }`}
          >
            <Info className="w-4 h-4" />
            <span className="hidden sm:inline">О приложении</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
