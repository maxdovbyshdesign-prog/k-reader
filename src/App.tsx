/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import CozyHeader from './components/CozyHeader';
import LibraryView from './components/LibraryView';
import ReaderView from './components/ReaderView';
import SettingsView from './components/SettingsView';
import AboutView from './components/AboutView';
import { Book, AppSettings } from './types';
import { getAllBooks, getSettings, saveSettings, getBookById } from './lib/db';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'library' | 'reader' | 'settings' | 'about'>('library');
  const [books, setBooks] = useState<Book[]>([]);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize data on mount
  useEffect(() => {
    async function initApp() {
      try {
        const loadedSettings = await getSettings();
        setSettings(loadedSettings);

        const loadedBooks = await getAllBooks();
        setBooks(loadedBooks);

        // Pre-load the most recently read book if any exist
        if (loadedBooks.length > 0) {
          const mostRecent = loadedBooks[0]; // Already sorted by lastReadAt in db helper
          setActiveBookId(mostRecent.id);
          setActiveBook(mostRecent);
        }
      } catch (err) {
        console.error('Failed to initialize database:', err);
      } finally {
        setIsLoading(false);
      }
    }
    initApp();
  }, []);

  const refreshLibrary = async () => {
    const loadedBooks = await getAllBooks();
    setBooks(loadedBooks);
    
    // Refresh current active book if it's still in the list
    if (activeBookId) {
      const updated = loadedBooks.find(b => b.id === activeBookId);
      if (updated) {
        setActiveBook(updated);
      } else {
        setActiveBookId(null);
        setActiveBook(null);
        if (activeTab === 'reader') {
          setActiveTab('library');
        }
      }
    }
  };

  const handleBookSelected = async (bookId: string) => {
    const book = await getBookById(bookId);
    if (book) {
      setActiveBookId(bookId);
      setActiveBook(book);
      setActiveTab('reader');
    }
  };

  const handleUpdateSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  if (isLoading || !settings) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-3 text-zinc-400">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        <span className="text-xs font-mono tracking-wider uppercase text-amber-500/80">Инициализация библиотеки...</span>
      </div>
    );
  }

  // Determine theme styling classes based on settings (Atmospheric / Immersive Media default)
  let themeBgClass = 'bg-[#0A0A0B] text-[#E0D8D0]';
  let accentBorderClass = 'border-[#F27D26]/10';

  if (settings.theme === 'cozy-warm') {
    themeBgClass = 'bg-[#0E0B0A] text-[#E2D6C5]';
    accentBorderClass = 'border-[#F27D26]/15';
  } else if (settings.theme === 'classic-dark') {
    themeBgClass = 'bg-[#050505] text-[#D8D2C4]';
    accentBorderClass = 'border-white/5';
  }

  return (
    <div className={`min-h-screen relative flex flex-col font-sans transition-colors duration-500 ${themeBgClass}`}>
      
      {/* Ambient lighting leaks for Atmospheric Immersive Media feel */}
      {settings.cozyBackground && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 atmosphere-glow opacity-80" />
      )}

      {/* Main App Content Container */}
      <div className="relative z-10 flex flex-col flex-1 h-full">
        
        {/* Navigation Header */}
        <CozyHeader 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          hasActiveBook={!!activeBook} 
        />

        {/* View Switcher with animations */}
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'library' && (
              <LibraryView
                key="library"
                books={books}
                onBookSelected={handleBookSelected}
                onRefreshLibrary={refreshLibrary}
              />
            )}

            {activeTab === 'reader' && activeBook && (
              <ReaderView
                key="reader"
                bookId={activeBook.id}
                initialBook={activeBook}
                settings={settings}
                onBackToLibrary={() => {
                  setActiveTab('library');
                  refreshLibrary(); // Sync any updates (bookmarks/positions)
                }}
                onUpdateSettings={handleUpdateSettings}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                key="settings"
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
              />
            )}

            {activeTab === 'about' && (
              <AboutView key="about" />
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
