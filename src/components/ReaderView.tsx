/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, Pause, Square, SkipForward, SkipBack, ChevronLeft, ChevronRight,
  Bookmark, BookmarkCheck, Volume2, Gauge, ArrowLeft, Loader2, ListCollapse, BookmarkMinus
} from 'lucide-react';
import { Book, Bookmark as BookMarkType, Voice, AppSettings } from '../types';
import { BrowserTTSProvider, SileroServerTTSProvider, PiperTTSProvider } from '../lib/tts';
import { saveBook } from '../lib/db';

interface ReaderViewProps {
  key?: string;
  bookId: string;
  initialBook: Book;
  settings: AppSettings;
  onBackToLibrary: () => void;
  onUpdateSettings: (settings: AppSettings) => void;
}

export default function ReaderView({ bookId, initialBook, settings, onBackToLibrary, onUpdateSettings }: ReaderViewProps) {
  const [book, setBook] = useState<Book>(initialBook);
  const [playbackState, setPlaybackState] = useState<'idle' | 'playing' | 'paused' | 'loading'>('idle');
  const [voices, setVoices] = useState<Voice[]>([]);
  const [activeVoice, setActiveVoice] = useState<string>('');
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarkNote, setBookmarkNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);

  // Audio Playback References
  const browserTTS = useRef<BrowserTTSProvider | null>(null);
  const piperTTS = useRef<PiperTTSProvider | null>(null);
  const sileroTTS = useRef<SileroServerTTSProvider | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cancelNativeSpeech = useRef<(() => void) | null>(null);
  
  // Predictive Preloader Cache
  // Maps paragraph indices to local audio URLs
  const preloadedUrls = useRef<Record<string, string>>({});
  const preloadingIndex = useRef<string | null>(null);

  const activeParagraphRef = useRef<HTMLDivElement | null>(null);

  // Load voices based on current provider
  useEffect(() => {
    browserTTS.current = new BrowserTTSProvider();
    piperTTS.current = new PiperTTSProvider();
    sileroTTS.current = new SileroServerTTSProvider(settings.sileroServerUrl);

    const loadVoices = async () => {
      let availableVoices: Voice[] = [];
      if (settings.ttsProviderId === 'browser') {
        availableVoices = await browserTTS.current!.listVoices();
      } else if (settings.ttsProviderId === 'piper') {
        availableVoices = await piperTTS.current!.listVoices();
      } else {
        availableVoices = await sileroTTS.current!.listVoices();
      }
      setVoices(availableVoices);

      // Select default voice
      const storedVoiceId = settings.voiceId;
      const voiceExists = availableVoices.some(v => v.id === storedVoiceId);
      if (voiceExists) {
        setActiveVoice(storedVoiceId);
      } else if (availableVoices.length > 0) {
        // Fallback to first voice
        setActiveVoice(availableVoices[0].id);
        onUpdateSettings({ ...settings, voiceId: availableVoices[0].id });
      }
    };

    loadVoices();
    // Stop playing on provider change
    stopPlayback();
  }, [settings.ttsProviderId, settings.sileroServerUrl]);

  // Clean up audio playback on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
      cleanupPreloadedUrls();
    };
  }, []);

  // Save book progress to DB when it changes
  const updateBookProgress = async (chapIdx: number, paraIdx: number) => {
    const updated = {
      ...book,
      currentChapterIndex: chapIdx,
      currentParagraphIndex: paraIdx,
      lastReadAt: Date.now()
    };
    setBook(updated);
    await saveBook(updated);
  };

  // Scroll active paragraph into view
  useEffect(() => {
    if (settings.autoScroll && activeParagraphRef.current) {
      activeParagraphRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [book.currentChapterIndex, book.currentParagraphIndex, settings.autoScroll]);

  const currentChapter = book.chapters[book.currentChapterIndex] || { title: 'Пустая глава', paragraphs: [] };
  const currentParagraphText = currentChapter.paragraphs[book.currentParagraphIndex] || '';

  // Clean preloaded audio URLs to avoid memory leaks
  const cleanupPreloadedUrls = () => {
    Object.keys(preloadedUrls.current).forEach(key => {
      const url = preloadedUrls.current[key];
      if (url) {
        URL.revokeObjectURL(url);
      }
    });
    preloadedUrls.current = {};
  };

  // Preload the next paragraph
  const preloadNextParagraph = async (chapIdx: number, paraIdx: number) => {
    if (settings.ttsProviderId === 'browser') return; // Browser TTS plays natively, no preloading needed

    let nextChap = chapIdx;
    let nextPara = paraIdx + 1;

    // Check if we need to cross chapter boundary
    if (nextPara >= (book.chapters[chapIdx]?.paragraphs?.length || 0)) {
      nextChap = chapIdx + 1;
      nextPara = 0;
    }

    // Check if we reached end of book
    if (nextChap >= book.chapters.length) return;

    const nextKey = `${nextChap}_${nextPara}`;
    
    // Check if already preloaded or currently preloading
    if (preloadedUrls.current[nextKey] || preloadingIndex.current === nextKey) return;

    const nextText = book.chapters[nextChap]?.paragraphs[nextPara];
    if (!nextText || nextText.trim().length === 0) return;

    try {
      preloadingIndex.current = nextKey;
      let audioUrl = '';
      if (settings.ttsProviderId === 'piper') {
        if (!piperTTS.current) return;
        audioUrl = await piperTTS.current.synthesize(nextText, activeVoice, settings.speed);
      } else {
        if (!sileroTTS.current) return;
        audioUrl = await sileroTTS.current.synthesize(nextText, activeVoice, settings.speed);
      }
      preloadedUrls.current[nextKey] = audioUrl;
    } catch (e) {
      console.warn('Failed to preload next paragraph:', e);
    } finally {
      if (preloadingIndex.current === nextKey) {
        preloadingIndex.current = null;
      }
    }
  };

  // Fallback helper to use system browser voices if Piper fails
  const fallbackToWebSpeech = (text: string, voiceId: string, speed: number, chapIdx: number, paraIdx: number) => {
    if (!browserTTS.current) return;
    
    // Find a browser voice matching the language prefix if possible
    const voicesList = window.speechSynthesis.getVoices();
    const langPrefix = voiceId.startsWith('ru') ? 'ru' : voiceId.startsWith('he') ? 'he' : 'en';
    const suitable = voicesList.find(v => v.lang.startsWith(langPrefix));
    const browserVoiceId = suitable ? suitable.name : '';

    const cancelFunc = browserTTS.current.speak(
      text,
      browserVoiceId,
      speed,
      () => {
        setPlaybackState('playing');
      },
      () => {
        setPlaybackState('idle');
        setTimeout(() => handleNextParagraph(true, chapIdx, paraIdx), 150);
      },
      (error) => {
        console.error('Web Speech fallback failed:', error);
        setPlaybackState('idle');
      }
    );
    cancelNativeSpeech.current = cancelFunc;
  };

  // Playback Control Core Engine
  const startPlayback = async (chapIdx: number, paraIdx: number) => {
    stopPlayback();
    setPlaybackState('loading');

    const activeChapter = book.chapters[chapIdx];
    if (!activeChapter) {
      setPlaybackState('idle');
      return;
    }

    const text = activeChapter.paragraphs[paraIdx];
    if (!text || text.trim().length === 0) {
      // Reached empty paragraph, try next
      handleNextParagraph(false, chapIdx, paraIdx);
      return;
    }

    // Trigger preloading for the next item
    preloadNextParagraph(chapIdx, paraIdx);

    if (settings.ttsProviderId === 'browser') {
      // Native Web Speech
      if (!browserTTS.current) return;
      
      const cancelFunc = browserTTS.current.speak(
        text,
        activeVoice,
        settings.speed,
        () => {
          setPlaybackState('playing');
        },
        () => {
          setPlaybackState('idle');
          // Autoplay next paragraph
          setTimeout(() => handleNextParagraph(true, chapIdx, paraIdx), 150);
        },
        (error) => {
          console.error('Speech synthesis error:', error);
          setPlaybackState('idle');
        }
      );
      cancelNativeSpeech.current = cancelFunc;

    } else {
      // Client-side Piper or Server-based Silero
      try {
        const cacheKey = `${chapIdx}_${paraIdx}`;
        let audioUrl = preloadedUrls.current[cacheKey];

        if (!audioUrl) {
          if (settings.ttsProviderId === 'piper') {
            if (!piperTTS.current) return;
            try {
              audioUrl = await piperTTS.current.synthesize(text, activeVoice, settings.speed);
              if (!audioUrl) {
                // If text resulted in empty speech (no phonemes), skip to next
                setTimeout(() => handleNextParagraph(true, chapIdx, paraIdx), 150);
                return;
              }
            } catch (piperErr) {
              console.warn('Piper synthesis failed, falling back to Web Speech API:', piperErr);
              fallbackToWebSpeech(text, activeVoice, settings.speed, chapIdx, paraIdx);
              return;
            }
          } else {
            if (!sileroTTS.current) return;
            audioUrl = await sileroTTS.current.synthesize(text, activeVoice, settings.speed);
          }
        }

        // Initialize Audio object
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.playbackRate = 1.0; // Speed is pre-baked in neural synthesis

        audio.oncanplaythrough = () => {
          audio.play().then(() => {
            setPlaybackState('playing');
          }).catch(err => {
            console.error('HTML5 Audio playback failed:', err);
            // Fallback on play fail
            if (settings.ttsProviderId === 'piper') {
              fallbackToWebSpeech(text, activeVoice, settings.speed, chapIdx, paraIdx);
            } else {
              setPlaybackState('idle');
            }
          });
        };

        audio.onended = () => {
          setPlaybackState('idle');
          // Revoke URL to release memory if not from cache
          if (!preloadedUrls.current[cacheKey]) {
            if (audioUrl.startsWith('blob:')) {
              URL.revokeObjectURL(audioUrl);
            }
          } else {
            if (audioUrl.startsWith('blob:')) {
              URL.revokeObjectURL(audioUrl);
            }
            delete preloadedUrls.current[cacheKey];
          }
          // Autoplay next paragraph
          setTimeout(() => handleNextParagraph(true, chapIdx, paraIdx), 150);
        };

        audio.onerror = (e) => {
          console.error('Audio element error:', e);
          if (audioUrl && audioUrl.startsWith('blob:')) {
            URL.revokeObjectURL(audioUrl);
          }
          if (preloadedUrls.current[cacheKey]) {
            delete preloadedUrls.current[cacheKey];
          }
          if (settings.ttsProviderId === 'piper') {
            fallbackToWebSpeech(text, activeVoice, settings.speed, chapIdx, paraIdx);
          } else {
            setPlaybackState('idle');
          }
        };

      } catch (err: any) {
        if (settings.ttsProviderId === 'piper') {
          fallbackToWebSpeech(text, activeVoice, settings.speed, chapIdx, paraIdx);
        } else {
          setPlaybackState('idle');
          alert(err.message || 'Ошибка синтеза речи.');
        }
      }
    }
  };

  const pausePlayback = () => {
    if (settings.ttsProviderId === 'browser') {
      if (browserTTS.current) {
        browserTTS.current.pause();
        setPlaybackState('paused');
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        setPlaybackState('paused');
      }
    }
  };

  const resumePlayback = () => {
    if (settings.ttsProviderId === 'browser') {
      if (browserTTS.current) {
        browserTTS.current.resume();
        setPlaybackState('playing');
      }
    } else {
      if (audioRef.current) {
        audioRef.current.play();
        setPlaybackState('playing');
      }
    }
  };

  const stopPlayback = () => {
    if (cancelNativeSpeech.current) {
      cancelNativeSpeech.current();
      cancelNativeSpeech.current = null;
    }
    if (browserTTS.current) {
      browserTTS.current.stop();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPlaybackState('idle');
  };

  const handlePlayPause = () => {
    if (playbackState === 'playing') {
      pausePlayback();
    } else if (playbackState === 'paused') {
      resumePlayback();
    } else {
      startPlayback(book.currentChapterIndex, book.currentParagraphIndex);
    }
  };

  // Navigation handlers
  const handleNextParagraph = (auto = false, fromChap?: number, fromPara?: number) => {
    const currentChapIdx = fromChap !== undefined ? fromChap : book.currentChapterIndex;
    const currentParaIdx = fromPara !== undefined ? fromPara : book.currentParagraphIndex;

    const chapter = book.chapters[currentChapIdx];
    if (!chapter) return;

    if (currentParaIdx < chapter.paragraphs.length - 1) {
      const nextIdx = currentParaIdx + 1;
      updateBookProgress(currentChapIdx, nextIdx);
      if (playbackState === 'playing' || auto) {
        startPlayback(currentChapIdx, nextIdx);
      }
    } else if (currentChapIdx < book.chapters.length - 1) {
      // Move to next chapter
      const nextChapIdx = currentChapIdx + 1;
      updateBookProgress(nextChapIdx, 0);
      if (playbackState === 'playing' || auto) {
        startPlayback(nextChapIdx, 0);
      }
    } else {
      // Reached the very end
      stopPlayback();
    }
  };

  const handlePrevParagraph = () => {
    if (book.currentParagraphIndex > 0) {
      const prevIdx = book.currentParagraphIndex - 1;
      updateBookProgress(book.currentChapterIndex, prevIdx);
      if (playbackState === 'playing') {
        startPlayback(book.currentChapterIndex, prevIdx);
      }
    } else if (book.currentChapterIndex > 0) {
      // Move to previous chapter, last paragraph
      const prevChapIdx = book.currentChapterIndex - 1;
      const lastParaIdx = book.chapters[prevChapIdx].paragraphs.length - 1;
      updateBookProgress(prevChapIdx, lastParaIdx);
      if (playbackState === 'playing') {
        startPlayback(prevChapIdx, lastParaIdx);
      }
    }
  };

  const handleNextChapter = () => {
    if (book.currentChapterIndex < book.chapters.length - 1) {
      const nextChapIdx = book.currentChapterIndex + 1;
      updateBookProgress(nextChapIdx, 0);
      if (playbackState === 'playing') {
        startPlayback(nextChapIdx, 0);
      }
    }
  };

  const handlePrevChapter = () => {
    if (book.currentChapterIndex > 0) {
      const prevChapIdx = book.currentChapterIndex - 1;
      updateBookProgress(prevChapIdx, 0);
      if (playbackState === 'playing') {
        startPlayback(prevChapIdx, 0);
      }
    }
  };

  // Bookmarks
  const handleAddBookmark = async () => {
    const currentPara = currentChapter.paragraphs[book.currentParagraphIndex] || '';
    const textPreview = currentPara.length > 60 ? currentPara.substring(0, 60) + '...' : currentPara;
    
    const newBookmark: BookMarkType = {
      id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      chapterIndex: book.currentChapterIndex,
      paragraphIndex: book.currentParagraphIndex,
      timestamp: Date.now(),
      textPreview,
      note: bookmarkNote.trim() || 'Без заметки'
    };

    const updatedBookmarks = [...(book.bookmarks || []), newBookmark];
    const updatedBook = {
      ...book,
      bookmarks: updatedBookmarks
    };

    setBook(updatedBook);
    await saveBook(updatedBook);
    
    setBookmarkNote('');
    setShowNoteInput(false);
  };

  const handleDeleteBookmark = async (bookmarkId: string) => {
    const updatedBookmarks = (book.bookmarks || []).filter(b => b.id !== bookmarkId);
    const updatedBook = {
      ...book,
      bookmarks: updatedBookmarks
    };
    setBook(updatedBook);
    await saveBook(updatedBook);
  };

  const jumpToBookmark = (chapterIdx: number, paragraphIdx: number) => {
    updateBookProgress(chapterIdx, paragraphIdx);
    if (playbackState === 'playing') {
      startPlayback(chapterIdx, paragraphIdx);
    }
    setShowBookmarks(false);
  };

  // Visual percentages
  const chapterProgress = currentChapter.paragraphs.length > 0 
    ? Math.round((book.currentParagraphIndex / currentChapter.paragraphs.length) * 100) 
    : 0;

  // Handles manual progress bar slide
  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newIdx = parseInt(e.target.value, 10);
    if (newIdx >= 0 && newIdx < currentChapter.paragraphs.length) {
      updateBookProgress(book.currentChapterIndex, newIdx);
      if (playbackState === 'playing') {
        startPlayback(book.currentChapterIndex, newIdx);
      }
    }
  };

  const isBookmarked = (book.bookmarks || []).some(
    b => b.chapterIndex === book.currentChapterIndex && b.paragraphIndex === book.currentParagraphIndex
  );

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-4xl mx-auto px-4 py-4 flex flex-col gap-4 h-[calc(100vh-80px)]"
    >
      {/* Top Header Controls */}
      <div className="flex items-center justify-between z-10">
        <button
          onClick={() => {
            stopPlayback();
            onBackToLibrary();
          }}
          className="text-[#E0D8D0]/70 hover:text-[#E0D8D0] text-xs font-semibold flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-white/5 border border-white/5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-[#F27D26]" />
          <span>В библиотеку</span>
        </button>

        <div className="text-right">
          <h2 className="text-xs font-serif italic font-semibold text-[#F27D26] max-w-[200px] sm:max-w-md truncate">
            {book.title}
          </h2>
          <p className="text-[9px] text-[#E0D8D0]/50 font-mono">
            Глава {book.currentChapterIndex + 1} из {book.chapters.length}
          </p>
        </div>

        <button
          onClick={() => setShowBookmarks(!showBookmarks)}
          className={`relative p-2 rounded-lg transition-colors border ${
            showBookmarks 
              ? 'bg-[#F27D26]/10 text-[#F27D26] border-[#F27D26]/20' 
              : 'text-[#E0D8D0]/60 hover:text-[#E0D8D0] hover:bg-white/5 border-transparent'
          }`}
          title="Закладки"
        >
          <Bookmark className="w-4.5 h-4.5" />
          {book.bookmarks && book.bookmarks.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-[#F27D26] text-black font-bold font-mono text-[9px] w-4 h-4 flex items-center justify-center rounded-full shadow-[0_0_8px_rgba(242,125,38,0.4)]">
              {book.bookmarks.length}
            </span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1 overflow-hidden">
        {/* Bookmarks Overlay/Sidebar */}
        <AnimatePresence>
          {showBookmarks && (
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="md:col-span-1 glass rounded-2xl p-4 flex flex-col gap-3 h-full overflow-y-auto max-h-[350px] md:max-h-full z-10"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h3 className="text-xs font-bold text-[#F27D26] flex items-center gap-1.5 font-sans">
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Закладки книги</span>
                </h3>
                <button 
                  onClick={() => setShowBookmarks(false)} 
                  className="text-[10px] text-[#E0D8D0]/50 hover:text-[#E0D8D0] font-mono"
                >
                  Закрыть
                </button>
              </div>

              {(!book.bookmarks || book.bookmarks.length === 0) ? (
                <p className="text-[11px] text-[#E0D8D0]/40 text-center py-8 italic font-sans">
                  Нет сохраненных закладок. Нажмите иконку ленты во время чтения, чтобы создать закладку.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {book.bookmarks.map((b) => (
                    <div 
                      key={b.id} 
                      className="group p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[#F27D26]/20 hover:bg-white/[0.04] transition-all duration-300 relative cursor-pointer"
                      onClick={() => jumpToBookmark(b.chapterIndex, b.paragraphIndex)}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBookmark(b.id);
                        }}
                        className="absolute top-2 right-2 p-1 rounded hover:bg-red-500/10 text-[#E0D8D0]/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Удалить закладку"
                      >
                        <BookmarkMinus className="w-3 h-3" />
                      </button>
                      <span className="text-[10px] font-semibold text-[#F27D26] block">
                        Гл. {b.chapterIndex + 1}, Абз. {b.paragraphIndex + 1}
                      </span>
                      <p className="text-[11px] text-[#E0D8D0]/80 line-clamp-2 mt-1 leading-relaxed font-serif italic">
                        "{b.textPreview}"
                      </p>
                      {b.note && b.note !== 'Без заметки' && (
                        <p className="text-[10px] text-[#E0D8D0]/40 bg-black/30 border border-white/5 px-1.5 py-0.5 rounded mt-1.5 truncate italic">
                          Заметка: {b.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Text Viewport Area */}
        <div className={`flex flex-col h-full overflow-hidden z-10 ${showBookmarks ? 'md:col-span-3' : 'md:col-span-4'}`}>
          <div className="flex-1 overflow-y-auto pr-1 glass-dark rounded-3xl p-4 sm:p-6 shadow-inner relative">
            <div className="space-y-6 pb-24">
              <h1 className="text-xs font-bold text-[#F27D26]/60 font-mono tracking-wider uppercase border-b border-white/5 pb-2 mb-6">
                {currentChapter.title}
              </h1>

              {currentChapter.paragraphs.map((para, idx) => {
                const isActive = idx === book.currentParagraphIndex;
                const isPrevious = idx === book.currentParagraphIndex - 1;
                const isNext = idx === book.currentParagraphIndex + 1;

                return (
                  <div
                    key={idx}
                    ref={isActive ? activeParagraphRef : null}
                    onClick={() => {
                      updateBookProgress(book.currentChapterIndex, idx);
                      if (playbackState === 'playing') {
                        startPlayback(book.currentChapterIndex, idx);
                      }
                    }}
                    className={`cursor-pointer rounded-2xl p-4 transition-all duration-300 border leading-relaxed font-serif ${
                      isActive
                        ? 'bg-[#F27D26]/10 border-[#F27D26]/30 text-[#E0D8D0] text-lg sm:text-xl font-medium shadow-[0_0_20px_rgba(242,125,38,0.03)] scale-[1.01]'
                        : isPrevious || isNext
                        ? 'opacity-60 border-transparent hover:opacity-80 text-[#E0D8D0]/70 text-base sm:text-lg'
                        : 'opacity-25 border-transparent hover:opacity-50 text-[#E0D8D0]/50 text-base sm:text-lg'
                    }`}
                  >
                    {para}
                  </div>
                );
              })}

              {currentChapter.paragraphs.length === 0 && (
                <p className="text-[#E0D8D0]/40 text-center italic py-20 text-xs font-sans">Нет содержимого в этой главе.</p>
              )}
            </div>

            {/* Fading bottom edge */}
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0A0A0B] to-transparent pointer-events-none" />
          </div>
        </div>
      </div>

      {/* BIG CAR-FRIENDLY CONTROLLER INTERFACE */}
      <div className="glass-dark rounded-3xl p-4 flex flex-col gap-4 shadow-2xl z-10 border border-white/5">
        
        {/* Progress bar slider & bookmark controls */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-[#E0D8D0]/40 w-12 text-right">
            {book.currentParagraphIndex + 1} / {currentChapter.paragraphs.length}
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(0, currentChapter.paragraphs.length - 1)}
            value={book.currentParagraphIndex}
            onChange={handleProgressChange}
            className="flex-1 h-1.5 bg-white/10 hover:bg-white/15 accent-[#F27D26] rounded-lg appearance-none cursor-pointer transition-all"
          />
          <span className="text-[10px] font-mono text-[#F27D26]/80 w-12 text-left">
            {chapterProgress}% гл.
          </span>
        </div>

        {/* Player Action Buttons (Large, high-contrast, easy touch targets) */}
        <div className="flex items-center justify-between gap-2 max-w-lg mx-auto w-full">
          {/* Prev Chapter */}
          <button
            onClick={handlePrevChapter}
            disabled={book.currentChapterIndex === 0}
            className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-[#E0D8D0]/60 hover:text-[#E0D8D0] disabled:opacity-20 disabled:pointer-events-none transition-all duration-200 border border-white/5 active:scale-95"
            title="Предыдущая глава"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          {/* Prev Paragraph */}
          <button
            onClick={handlePrevParagraph}
            className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-[#E0D8D0]/60 hover:text-[#E0D8D0] transition-all duration-200 border border-white/5 active:scale-95"
            title="Предыдущий абзац"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* BIG PLAY/PAUSE */}
          <button
            onClick={handlePlayPause}
            className={`p-5 rounded-full transition-all duration-300 scale-110 active:scale-100 text-black glow-orange bg-[#F27D26] hover:bg-[#ff9342]`}
            title={playbackState === 'playing' ? 'Пауза' : 'Воспроизведение'}
          >
            {playbackState === 'loading' ? (
              <Loader2 className="w-7 h-7 animate-spin" />
            ) : playbackState === 'playing' ? (
              <Pause className="w-7 h-7 fill-black text-black" />
            ) : (
              <Play className="w-7 h-7 fill-black text-black" />
            )}
          </button>

          {/* Next Paragraph */}
          <button
            onClick={() => handleNextParagraph()}
            className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-[#E0D8D0]/60 hover:text-[#E0D8D0] transition-all duration-200 border border-white/5 active:scale-95"
            title="Следующий абзац"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Next Chapter */}
          <button
            onClick={handleNextChapter}
            disabled={book.currentChapterIndex === book.chapters.length - 1}
            className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-[#E0D8D0]/60 hover:text-[#E0D8D0] disabled:opacity-20 disabled:pointer-events-none transition-all duration-200 border border-white/5 active:scale-95"
            title="Следующая глава"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        {/* Stop, Voice & Speed controls (Compact row) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/5 pt-3.5">
          {/* Stop and Bookmark buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start">
            <button
              onClick={stopPlayback}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#E0D8D0]/70 hover:text-red-400 border border-white/5 flex items-center gap-2 text-xs font-semibold transition-colors active:scale-95"
              title="Остановить"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Стоп</span>
            </button>

            <button
              onClick={() => {
                if (isBookmarked) {
                  const bId = book.bookmarks.find(
                    b => b.chapterIndex === book.currentChapterIndex && b.paragraphIndex === book.currentParagraphIndex
                  )?.id;
                  if (bId) handleDeleteBookmark(bId);
                } else {
                  setShowNoteInput(!showNoteInput);
                }
              }}
              className={`px-4 py-2.5 rounded-xl border flex items-center gap-2 text-xs font-semibold transition-colors active:scale-95 ${
                isBookmarked
                  ? 'bg-[#F27D26]/10 border-[#F27D26]/20 text-[#F27D26]'
                  : 'bg-white/5 border-white/5 text-[#E0D8D0]/70 hover:text-[#E0D8D0] hover:bg-white/10'
              }`}
            >
              {isBookmarked ? <BookmarkCheck className="w-3.5 h-3.5 text-[#F27D26]" /> : <Bookmark className="w-3.5 h-3.5" />}
              <span>{isBookmarked ? 'В закладках' : 'Закладка'}</span>
            </button>
          </div>

          {/* Dynamic Bookmark Note Popover */}
          <AnimatePresence>
            {showNoteInput && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-32 left-4 right-4 bg-[#0A0A0B] border border-white/10 p-4 rounded-2xl shadow-2xl flex flex-col gap-2.5 z-20"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[#E0D8D0]">Добавить заметку к закладке:</h4>
                  <button 
                    onClick={() => {
                      setShowNoteInput(false);
                      setBookmarkNote('');
                    }}
                    className="text-[10px] text-[#E0D8D0]/50 hover:text-[#E0D8D0]"
                  >
                    Отмена
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Например: Любимая цитата, Начало главы..."
                  value={bookmarkNote}
                  onChange={(e) => setBookmarkNote(e.target.value)}
                  className="bg-white/5 border border-white/10 text-[#E0D8D0] text-xs p-2.5 rounded-xl focus:outline-none focus:border-[#F27D26]"
                  autoFocus
                />
                <button
                  onClick={handleAddBookmark}
                  className="w-full bg-[#F27D26] hover:bg-[#ff9342] text-black text-xs font-semibold py-2 rounded-xl transition-colors"
                >
                  Сохранить закладку
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Voice Selector and Speed Control */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full sm:w-auto justify-center sm:justify-end">
            {/* Voice Dropdown */}
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/5 rounded-xl px-2.5 py-1.5 w-full sm:w-44">
              <Volume2 className="w-4.5 h-4.5 text-[#F27D26]/70 shrink-0" />
              <select
                value={activeVoice}
                onChange={(e) => {
                  setActiveVoice(e.target.value);
                  onUpdateSettings({ ...settings, voiceId: e.target.value });
                  if (playbackState === 'playing') {
                    // Re-start playing with new voice
                    setTimeout(() => startPlayback(book.currentChapterIndex, book.currentParagraphIndex), 100);
                  }
                }}
                className="bg-transparent border-none text-[11px] text-[#E0D8D0]/80 font-medium focus:outline-none w-full cursor-pointer"
              >
                {voices.length === 0 ? (
                  <option value="" disabled className="bg-[#0A0A0B] text-zinc-500">Загрузка голосов...</option>
                ) : (
                  voices.map((v) => (
                    <option key={v.id} value={v.id} className="bg-[#0A0A0B] text-[#E0D8D0] text-xs">
                      {v.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Speed Slider */}
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/5 rounded-xl px-2.5 py-1 w-full sm:w-36">
              <Gauge className="w-4.5 h-4.5 text-[#F27D26]/70 shrink-0" />
              <div className="flex-1 flex flex-col">
                <span className="text-[9px] font-mono font-bold text-[#E0D8D0]/40 text-right">Скорость: {settings.speed}x</span>
                <input
                  type="range"
                  min={0.6}
                  max={2.2}
                  step={0.1}
                  value={settings.speed}
                  onChange={(e) => {
                    const speedVal = parseFloat(e.target.value);
                    onUpdateSettings({ ...settings, speed: speedVal });
                  }}
                  onMouseUp={() => {
                    if (playbackState === 'playing') {
                      startPlayback(book.currentChapterIndex, book.currentParagraphIndex);
                    }
                  }}
                  onTouchEnd={() => {
                    if (playbackState === 'playing') {
                      startPlayback(book.currentChapterIndex, book.currentParagraphIndex);
                    }
                  }}
                  className="h-1 bg-white/10 accent-[#F27D26] rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>

        </div>

      </div>
    </motion.div>
  );
}
