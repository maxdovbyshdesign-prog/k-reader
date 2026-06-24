/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Settings, Server, RefreshCw, Eye, BookOpen, Terminal, CheckCircle2, AlertCircle, Play, Square, Loader2, HelpCircle, Download } from 'lucide-react';
import { AppSettings, Voice } from '../types';
import { saveSettings } from '../lib/db';
import { PiperTTSProvider, BrowserTTSProvider, PIPER_VOICES, getAssetPath } from '../lib/tts';

interface SettingsViewProps {
  key?: string;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
}

export default function SettingsView({ settings, onUpdateSettings }: SettingsViewProps) {
  // Available Piper Voices
  const piperVoices: Voice[] = PIPER_VOICES;

  const [browserVoices, setBrowserVoices] = useState<Voice[]>([]);
  const [isVoiceCached, setIsVoiceCached] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<string>('');
  const [downloadType, setDownloadType] = useState<'idle' | 'downloading' | 'compiling' | 'ready' | 'error'>('idle');
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testAudio, setTestAudio] = useState<HTMLAudioElement | null>(null);

  // Load browser voices
  useEffect(() => {
    const loadBrowserVoices = async () => {
      const provider = new BrowserTTSProvider();
      const voices = await provider.listVoices();
      setBrowserVoices(voices);
    };
    loadBrowserVoices();
  }, []);

  // Check cache status for currently selected voice
  useEffect(() => {
    if (settings.ttsProviderId === 'piper') {
      checkCacheStatus(settings.voiceId || 'ru_RU-dmitry-medium');
    }
  }, [settings.ttsProviderId, settings.voiceId]);

  const checkCacheStatus = async (voiceId: string) => {
    try {
      const cache = await caches.open('piper-models-cache');
      const modelUrl = getAssetPath(`models/piper/${voiceId}.onnx`);
      const cached = await cache.match(modelUrl);
      setIsVoiceCached(!!cached);
    } catch (e) {
      setIsVoiceCached(false);
    }
  };

  const handleProviderChange = (providerId: string) => {
    // Select default voice for the provider
    let defaultVoiceId = '';
    if (providerId === 'browser') {
      if (browserVoices.length > 0) {
        defaultVoiceId = browserVoices[0].id;
      }
    } else if (providerId === 'piper') {
      defaultVoiceId = 'ru_RU-dmitry-medium';
    } else {
      defaultVoiceId = 'ru_0';
    }

    const updated = { ...settings, ttsProviderId: providerId, voiceId: defaultVoiceId };
    onUpdateSettings(updated);
    saveSettings(updated);
    
    // Stop any playing test audio
    if (testAudio) {
      testAudio.pause();
      setIsTesting(false);
    }
  };

  const handleVoiceChange = (voiceId: string) => {
    const updated = { ...settings, voiceId };
    onUpdateSettings(updated);
    saveSettings(updated);
    
    if (testAudio) {
      testAudio.pause();
      setIsTesting(false);
    }
  };

  const handleToggleChange = (key: keyof AppSettings, value: boolean) => {
    const updated = { ...settings, [key]: value };
    onUpdateSettings(updated);
    saveSettings(updated);
  };

  const handleTextChange = (key: keyof AppSettings, value: string) => {
    const updated = { ...settings, [key]: value };
    onUpdateSettings(updated);
    saveSettings(updated);
  };

  // Pre-load and download model files
  const handleDownloadAndPreheat = async () => {
    const voiceId = settings.voiceId || 'ru_RU-dmitry-medium';
    setDownloadType('downloading');
    setDownloadProgress(5);
    setDownloadStatus('Инициализация соединения...');

    const provider = new PiperTTSProvider();
    provider.onProgress = (status) => {
      setDownloadType(status.type);
      setDownloadStatus(status.message);
      if (status.progress !== undefined) {
        setDownloadProgress(status.progress);
      }
    };

    const success = await provider.preheat(voiceId);
    if (success) {
      checkCacheStatus(voiceId);
    } else {
      setDownloadType('error');
    }
  };

  // Test the TTS Speech live in Settings
  const handleTestVoice = async () => {
    if (isTesting) {
      if (testAudio) {
        testAudio.pause();
      }
      window.speechSynthesis.cancel();
      setIsTesting(false);
      return;
    }

    setIsTesting(true);
    try {
      if (settings.ttsProviderId === 'browser') {
        const text = settings.voiceId.startsWith('en')
          ? 'This is a test of the system browser voice speech synthesis.'
          : settings.voiceId.startsWith('he')
          ? 'זהו מבחן של סינתזת דיבור מערכתית בדפדפן.'
          : 'Это проверка синтеза речи системным голосом в вашем браузере.';

        const u = new SpeechSynthesisUtterance(text);
        const voicesList = window.speechSynthesis.getVoices();
        const v = voicesList.find(x => x.name === settings.voiceId);
        if (v) u.voice = v;
        u.rate = settings.speed;
        u.onend = () => setIsTesting(false);
        u.onerror = () => setIsTesting(false);
        
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      } else {
        const provider = new PiperTTSProvider();
        provider.onProgress = (status) => {
          setDownloadType(status.type);
          setDownloadStatus(status.message);
          if (status.progress !== undefined) {
            setDownloadProgress(status.progress);
          }
        };

        const testText = settings.voiceId.startsWith('en')
          ? 'Hello! This is a test of Piper neural voice running completely inside your browser.'
          : settings.voiceId.startsWith('he')
          ? 'שלום! זהו מבחן של קול ניורוני פייפר הפועל כולו בדפדפן שלך.'
          : 'Привет! Это проверка нейросетевого голоса Пайпер, который синтезируется прямо в вашем браузере.';

        const audioUrl = await provider.synthesize(testText, settings.voiceId, settings.speed);
        const audio = new Audio(audioUrl);
        setTestAudio(audio);
        audio.play();
        
        audio.onended = () => {
          setIsTesting(false);
          URL.revokeObjectURL(audioUrl);
        };
        audio.onerror = () => {
          setIsTesting(false);
        };
      }
    } catch (e: any) {
      console.error(e);
      setIsTesting(false);
      alert(`Ошибка синтеза для теста: ${e.message || e}. Проверьте соединение или наличие файлов модели.`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="max-w-4xl mx-auto px-4 py-6 space-y-6"
    >
      <div className="flex items-center gap-3 border-b border-white/5 pb-3 mb-6">
        <div className="p-2 rounded-xl bg-[#F27D26]/10 border border-[#F27D26]/20 text-[#F27D26]">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-[#E0D8D0] font-sans">Настройки ридера</h2>
          <p className="text-xs text-[#E0D8D0]/50 font-sans">Настройте синтезатор речи и отображение книги под себя</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left column: Controls */}
        <div className="space-y-6">
          
          {/* TTS Engine Selector */}
          <div className="p-5 rounded-2xl glass space-y-4">
            <h3 className="text-xs font-bold font-mono text-[#F27D26] uppercase tracking-wider flex items-center gap-2">
              <Server className="w-3.5 h-3.5" />
              <span>Режим озвучки (TTS)</span>
            </h3>

            <div className="grid grid-cols-1 gap-2.5 font-sans">
              <button
                id="select-tts-browser"
                onClick={() => handleProviderChange('browser')}
                className={`p-4 rounded-xl text-left border transition-all duration-300 cursor-pointer ${
                  settings.ttsProviderId === 'browser'
                    ? 'bg-[#F27D26]/10 border-[#F27D26]/30 text-[#E0D8D0] shadow-[0_0_15px_rgba(242,125,38,0.05)]'
                    : 'bg-white/[0.02] border-white/5 text-[#E0D8D0]/60 hover:border-white/20 hover:bg-white/[0.04]'
                }`}
              >
                <div className="font-semibold text-xs sm:text-sm">Системные голоса (Web Speech API)</div>
                <p className="text-[11px] text-[#E0D8D0]/40 mt-1 leading-relaxed">
                  Работает полностью офлайн. Использует предустановленные голоса вашего устройства (Android, Windows, macOS). Самый надёжный и быстрый вариант.
                </p>
              </button>

              <button
                id="select-tts-piper"
                onClick={() => handleProviderChange('piper')}
                className={`p-4 rounded-xl text-left border transition-all duration-300 cursor-pointer ${
                  settings.ttsProviderId === 'piper'
                    ? 'bg-[#F27D26]/10 border-[#F27D26]/30 text-[#E0D8D0] shadow-[0_0_15px_rgba(242,125,38,0.05)]'
                    : 'bg-white/[0.02] border-white/5 text-[#E0D8D0]/60 hover:border-white/20 hover:bg-white/[0.04]'
                }`}
              >
                <div className="font-semibold text-xs sm:text-sm flex items-center gap-1.5">
                  <span>Piper Web Neural Voice</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#F27D26]/20 text-[#F27D26] border border-[#F27D26]/10 font-bold uppercase tracking-wide">Экспериментальный</span>
                </div>
                <p className="text-[11px] text-[#E0D8D0]/40 mt-1 leading-relaxed">
                  Потрясающий естественный нейросетевой звук. Синтезируется 100% локально в браузере с помощью ONNX Runtime Web. Требует скачивания файлов модели (~15-50MB) при первом запуске.
                </p>
              </button>
            </div>
          </div>

          {/* Voice Settings Selector */}
          <div className="p-5 rounded-2xl glass space-y-4">
            <h3 className="text-xs font-bold font-mono text-[#F27D26] uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Выбор голоса синтезатора</span>
            </h3>

            <div className="space-y-3 font-sans">
              <div className="space-y-1">
                <label className="text-xs text-[#E0D8D0]/60 font-medium">Активный голос:</label>
                <select
                  value={settings.voiceId}
                  onChange={(e) => handleVoiceChange(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 text-[#E0D8D0] text-xs p-2.5 rounded-xl focus:outline-none focus:border-[#F27D26]/50 cursor-pointer"
                >
                  {settings.ttsProviderId === 'browser' ? (
                    browserVoices.length === 0 ? (
                      <option value="" disabled className="bg-[#0A0A0B]">Загрузка голосов...</option>
                    ) : (
                      browserVoices.map((v) => (
                        <option key={v.id} value={v.id} className="bg-[#0A0A0B]">
                          {v.lang === 'ru' ? '🇷🇺 ' : v.lang === 'he' ? '🇮🇱 ' : '🇺🇸 '} {v.name}
                        </option>
                      ))
                    )
                  ) : (
                    piperVoices.map((v) => (
                      <option key={v.id} value={v.id} className="bg-[#0A0A0B]">
                        {v.lang === 'ru' ? '🇷🇺 ' : v.lang === 'he' ? '🇮🇱 ' : '🇺🇸 '} {v.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Piper-specific Status and Download triggers */}
              {settings.ttsProviderId === 'piper' && (
                <div className="pt-2 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#E0D8D0]/50">Статус локальной модели:</span>
                    {isVoiceCached ? (
                      <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[10px]">
                        ✓ Скачано и готово офлайн
                      </span>
                    ) : (
                      <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-[10px]">
                        Требует скачивания
                      </span>
                    )}
                  </div>

                  {!isVoiceCached && downloadType === 'idle' && (
                    <button
                      onClick={handleDownloadAndPreheat}
                      className="w-full py-2 px-3 rounded-xl bg-[#F27D26] hover:bg-[#ff9342] text-black font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Скачать файлы голоса (~15-25MB)</span>
                    </button>
                  )}

                  {downloadType !== 'idle' && (
                    <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-medium text-[#E0D8D0]/80">
                        <span className="flex items-center gap-1.5">
                          {downloadType === 'ready' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : downloadType === 'error' ? (
                            <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                          ) : (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#F27D26]" />
                          )}
                          <span>{downloadStatus}</span>
                        </span>
                        {downloadProgress !== null && downloadType === 'downloading' && (
                          <span className="font-mono text-[10px] text-[#F27D26]">{downloadProgress}%</span>
                        )}
                      </div>

                      {downloadProgress !== null && downloadType === 'downloading' && (
                        <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-[#F27D26] h-full rounded-full transition-all duration-300" 
                            style={{ width: `${downloadProgress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {isVoiceCached && downloadType === 'idle' && (
                    <button
                      onClick={handleDownloadAndPreheat}
                      className="w-full py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-[#E0D8D0]/80 border border-white/5 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Обновить / Перепроверить кэш модели</span>
                    </button>
                  )}
                </div>
              )}

              {/* Live Audio Test control */}
              <div className="pt-2 border-t border-white/5">
                <button
                  onClick={handleTestVoice}
                  className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                    isTesting
                      ? 'bg-red-500/10 hover:bg-red-500/15 border-red-500/20 text-red-400'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20 text-[#E0D8D0]'
                  }`}
                >
                  {isTesting ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Остановить прослушивание теста</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Прослушать тестовую фразу</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Reader Preferences */}
          <div className="p-5 rounded-2xl glass space-y-4">
            <h3 className="text-xs font-bold font-mono text-[#F27D26] uppercase tracking-wider flex items-center gap-2">
              <Eye className="w-3.5 h-3.5" />
              <span>Параметры чтения и темы</span>
            </h3>

            <div className="space-y-3.5 font-sans">
              <label className="flex items-center justify-between cursor-pointer group">
                <div className="space-y-0.5">
                  <span className="text-xs sm:text-sm font-semibold text-[#E0D8D0] group-hover:text-[#F27D26] transition-colors">Автопрокрутка текста</span>
                  <p className="text-[11px] text-[#E0D8D0]/40">Удерживать читаемый абзац в центре экрана</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoScroll}
                  onChange={(e) => handleToggleChange('autoScroll', e.target.checked)}
                  className="w-4.5 h-4.5 accent-[#F27D26] cursor-pointer rounded"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <div className="space-y-0.5">
                  <span className="text-xs sm:text-sm font-semibold text-[#E0D8D0] group-hover:text-[#F27D26] transition-colors">Уютный фон (Градиент)</span>
                  <p className="text-[11px] text-[#E0D8D0]/40">Размытое атмосферное свечение на заднем фоне</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.cozyBackground}
                  onChange={(e) => handleToggleChange('cozyBackground', e.target.checked)}
                  className="w-4.5 h-4.5 accent-[#F27D26] cursor-pointer rounded"
                />
              </label>

              {/* Theme Selector */}
              <div className="space-y-1 pt-2">
                <label className="text-xs text-[#E0D8D0]/60 font-medium">Цветовая гамма приложения:</label>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { id: 'cozy-dark', name: 'Уютный Тёмный', style: 'border-white/5 bg-[#0A0A0B] text-[#E0D8D0]/80' },
                    { id: 'cozy-warm', name: 'Тёплый Сепия', style: 'border-[#F27D26]/10 bg-[#0E0B0A] text-[#E2D6C5]' },
                    { id: 'classic-dark', name: 'Классик Чёрный', style: 'border-white/5 bg-[#050505] text-[#D8D2C4]' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleTextChange('theme', t.id as any)}
                      className={`p-2.5 rounded-xl text-[10px] sm:text-xs font-semibold text-center border transition-all duration-200 cursor-pointer ${
                        settings.theme === t.id
                          ? 'border-[#F27D26] bg-[#F27D26]/10 text-[#F27D26] scale-[0.98]'
                          : `${t.style} hover:border-white/10 hover:bg-white/[0.02]`
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right column: Instructions / FAQ */}
        <div className="p-5 rounded-2xl glass flex flex-col gap-4">
          <h3 className="text-xs font-bold font-mono text-[#F27D26] uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
            <Terminal className="w-3.5 h-3.5" />
            <span>Развёртывание Piper на GitHub Pages</span>
          </h3>

          <div className="space-y-4 text-xs text-[#E0D8D0]/60 leading-relaxed overflow-y-auto max-h-[550px] pr-1 font-sans">
            <p>
              Приложение <strong>Ksyusha Reader</strong> полностью автономно и готово к статической публикации (например, на GitHub Pages).
            </p>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[#E0D8D0]/80 space-y-1.5">
              <span className="font-bold text-amber-400 flex items-center gap-1.5 text-[11px]">
                <HelpCircle className="w-4 h-4 shrink-0" />
                <span>Офлайн-кэширование Cache Storage API</span>
              </span>
              <p className="text-[10.5px] leading-relaxed">
                Благодаря встроенному кэшу браузера, один раз скачанные файлы Piper-моделей будут сохраняться на вашем устройстве навсегда. Загрузка происходит только при первом прослушивании, после чего голос запускается мгновенно даже без интернета!
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-[#E0D8D0]">Как разместить файлы моделей в своём репозитории:</h4>
              <p>Чтобы Piper работал "из коробки" для всех пользователей вашего сайта без скачивания из сторонних источников, разместите файлы в корневой папке:</p>
              
              <div className="p-3 bg-black/40 rounded-xl font-mono text-[10.5px] text-[#E0D8D0]/80 border border-white/5 space-y-1">
                <div>📁 <span className="text-[#F27D26]">public/</span></div>
                <div className="pl-4">📁 <span className="text-[#F27D26]">models/</span></div>
                <div className="pl-8">📁 <span className="text-[#F27D26]">piper/</span></div>
                <div className="pl-12">📄 ru_RU-dmitry-medium.onnx</div>
                <div className="pl-12">📄 ru_RU-dmitry-medium.json</div>
                <div className="pl-12">📄 ru_RU-irina-medium.onnx</div>
                <div className="pl-12">📄 ru_RU-irina-medium.json</div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-[#E0D8D0]">Где скачать готовые голоса:</h4>
              <p>Вы можете скачать эти файлы напрямую с официального репозитория моделей:</p>
              <ul className="list-disc list-inside pl-1 space-y-1">
                <li>
                  <a 
                    href="https://huggingface.co/rhasspy/piper-voices/tree/main" 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-[#F27D26] underline hover:text-[#ff9342]"
                  >
                    HuggingFace Piper Voices Repository
                  </a>
                </li>
                <li>Найдите нужный язык (например, <code>ru_RU</code>) и скачайте соответствующий <code>.onnx</code> и <code>.json</code> файл.</li>
              </ul>
            </div>

            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl space-y-1.5">
              <span className="font-bold text-[#F27D26] block">💡 Рекомендация для мобильных устройств</span>
              <p className="text-[11px] leading-relaxed">
                Для плавной озвучки на смартфонах Android и iOS (где ресурсы памяти ограничены) рекомендуем использовать голоса с пометкой <strong>Medium</strong> или <strong>Low</strong>. Они весят всего 15-20 МБ, компилируются мгновенно и звучат безупречно.
              </p>
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
