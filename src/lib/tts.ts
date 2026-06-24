/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Voice, TTSProvider } from '../types';

export const PIPER_VOICES: Voice[] = [
  { id: 'ru_RU-dmitry-medium', name: 'Дмитрий (Русский, Мужской, Medium)', lang: 'ru', gender: 'male', providerId: 'piper' },
  { id: 'ru_RU-irina-medium', name: 'Ирина (Русский, Женский, Medium)', lang: 'ru', gender: 'female', providerId: 'piper' },
  { id: 'en_US-lessac-medium', name: 'Lessac (English, Female, Medium)', lang: 'en', gender: 'female', providerId: 'piper' },
  { id: 'en_US-danny-low', name: 'Danny (English, Male, Low)', lang: 'en', gender: 'male', providerId: 'piper' },
  { id: 'he_IL-hebrew-medium', name: 'Hebrew (עברית, Мужской, Medium)', lang: 'he', gender: 'male', providerId: 'piper' }
];

/**
 * Helper to resolve relative assets correctly, supporting custom base subpaths on GitHub Pages.
 */
export function getAssetPath(relativePath: string): string {
  const baseUrl = (import.meta as any).env.BASE_URL || '/';
  const cleanBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  const cleanRelative = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  const resolvedPath = `${cleanBase}${cleanRelative}`;
  if (typeof window !== 'undefined') {
    try {
      return new URL(resolvedPath, window.location.href).href;
    } catch (e) {
      return resolvedPath;
    }
  }
  return resolvedPath;
}

export function numberToRussianWords(num: number): string {
  if (num === 0) return 'ноль';
  
  const ones = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
  const onesFemale = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
  const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
  const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
  const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
  
  const chunks: string[] = [];
  
  const parseHundreds = (n: number, isFemale = false): string => {
    const parts = [];
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const o = n % 10;
    
    if (h > 0) parts.push(hundreds[h]);
    
    if (t === 1) {
      parts.push(teens[o]);
    } else {
      if (t > 1) parts.push(tens[t]);
      if (o > 0) parts.push(isFemale ? onesFemale[o] : ones[o]);
    }
    return parts.filter(Boolean).join(' ');
  };

  let sign = '';
  if (num < 0) {
    sign = 'минус ';
    num = Math.abs(num);
  }

  const billions = Math.floor(num / 1000000000);
  const millions = Math.floor((num % 1000000000) / 1000000);
  const thousands = Math.floor((num % 1000000) / 1000);
  const rest = num % 1000;

  if (billions > 0) {
    const word = parseHundreds(billions);
    const lastDigit = billions % 10;
    const lastTwo = billions % 100;
    let suffix = 'миллиардов';
    if (lastTwo < 10 || lastTwo > 20) {
      if (lastDigit === 1) suffix = 'миллиард';
      else if (lastDigit >= 2 && lastDigit <= 4) suffix = 'миллиарда';
    }
    chunks.push(`${word} ${suffix}`);
  }

  if (millions > 0) {
    const word = parseHundreds(millions);
    const lastDigit = millions % 10;
    const lastTwo = millions % 100;
    let suffix = 'миллионов';
    if (lastTwo < 10 || lastTwo > 20) {
      if (lastDigit === 1) suffix = 'миллион';
      else if (lastDigit >= 2 && lastDigit <= 4) suffix = 'миллиона';
    }
    chunks.push(`${word} ${suffix}`);
  }

  if (thousands > 0) {
    const word = parseHundreds(thousands, true);
    const lastDigit = thousands % 10;
    const lastTwo = thousands % 100;
    let suffix = 'тысяч';
    if (lastTwo < 10 || lastTwo > 20) {
      if (lastDigit === 1) suffix = 'тысяча';
      else if (lastDigit >= 2 && lastDigit <= 4) suffix = 'тысячи';
    }
    chunks.push(`${word} ${suffix}`);
  }

  if (rest > 0) {
    chunks.push(parseHundreds(rest));
  }

  return sign + chunks.join(' ');
}

export function normalizeTextForTTS(text: string): string {
  return text
    .replace(/(\d+)/g, (match) => {
      const parsed = parseInt(match, 10);
      return isNaN(parsed) ? match : numberToRussianWords(parsed);
    })
    .replace(/[""«»'']/g, '')
    .replace(/—/g, ', ')
    .replace(/\s+/g, ' ').trim();
}

export function splitIntoChunks(text: string, maxLen = 200): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+|\s*[^.!?]+$/g) || [text];
  const chunks: string[] = [];
  let current = '';
  for (const s of sentences) {
    if ((current + s).length > maxLen && current) {
      chunks.push(current.trim());
      current = s;
    } else {
      current += (current ? ' ' : '') + s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/**
 * Phonetic/IPA/eSpeak mappings for Russian, English, and Hebrew characters
 * to provide a quick, lightweight offline-first grapheme-to-phoneme conversion.
 */
const CYRILLIC_TO_ESPEAK: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'ɡ', 'д': 'd', 'е': 'j e', 'ё': 'j o', 'ж': 'ʐ', 'з': 'z', 'и': 'i',
  'й': 'j', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't',
  'у': 'u', 'ф': 'f', 'х': 'x', 'ц': 't͡s', 'ч': 't͡ɕ', 'ш': 'ʂ', 'щ': 'ɕː', 'ъ': '', 'ы': 'ɨ', 'ь': 'ʲ',
  'э': 'e', 'ю': 'j u', 'я': 'j a',
  ' ': ' ', '.': '.', ',': ',', '!': '!', '?': '?', '-': ' ', ';': ';', ':': ':', '(': '(', ')': ')'
};

const EN_TO_ESPEAK: Record<string, string> = {
  'a': 'a', 'b': 'b', 'c': 'k', 'd': 'd', 'e': 'e', 'f': 'f', 'g': 'ɡ', 'h': 'h', 'i': 'i', 'j': 'd͡ʒ',
  'k': 'k', 'l': 'l', 'm': 'm', 'n': 'n', 'o': 'o', 'p': 'p', 'q': 'k', 'r': 'ɹ', 's': 's', 't': 't',
  'u': 'u', 'v': 'v', 'w': 'w', 'x': 'k s', 'y': 'j', 'z': 'z',
  ' ': ' ', '.': '.', ',': ',', '!': '!', '?': '?', '-': ' ', ';': ';', ':': ':', '(': '(', ')': ')'
};

const HE_TO_ESPEAK: Record<string, string> = {
  'א': 'ʔ', 'ב': 'v', 'ג': 'ɡ', 'ד': 'd', 'ה': 'h', 'ו': 'v', 'ז': 'z', 'ח': 'x', 'ט': 't', 'י': 'j',
  'כ': 'x', 'ל': 'l', 'מ': 'm', 'נ': 'n', 'ס': 's', 'ע': 'ʔ', 'פ': 'f', 'צ': 't͡s', 'ק': 'k', 'ר': 'ʁ',
  'ש': 'ʃ', 'ת': 't',
  ' ': ' ', '.': '.', ',': ',', '!': '!', '?': '?', '-': ' ', ';': ';', ':': ':', '(': '(', ')': ')'
};

/**
 * Converts standard text characters to phoneme ID lists based on the model's configuration.
 */
export function textToPhonemeIds(text: string, phonemeIdMap: Record<string, number>, lang: string): number[] {
  const lowerText = text.toLowerCase();
  const phonemes: string[] = [];

  for (const char of lowerText) {
    let espeakSyms = '';
    if (lang === 'ru') {
      espeakSyms = CYRILLIC_TO_ESPEAK[char] !== undefined ? CYRILLIC_TO_ESPEAK[char] : char;
    } else if (lang === 'he') {
      espeakSyms = HE_TO_ESPEAK[char] !== undefined ? HE_TO_ESPEAK[char] : char;
    } else {
      espeakSyms = EN_TO_ESPEAK[char] !== undefined ? EN_TO_ESPEAK[char] : char;
    }

    if (espeakSyms) {
      const parts = espeakSyms.split(' ');
      phonemes.push(...parts);
    }
  }

  const ids: number[] = [];
  const startId = phonemeIdMap['^'] !== undefined ? phonemeIdMap['^'] : 1;
  const endId = phonemeIdMap['$'] !== undefined ? phonemeIdMap['$'] : 2;
  const padId = phonemeIdMap['_'] !== undefined ? phonemeIdMap['_'] : 11;

  ids.push(startId);
  ids.push(padId);
  
  for (const ph of phonemes) {
    if (phonemeIdMap[ph] !== undefined) {
      ids.push(phonemeIdMap[ph]);
      ids.push(padId);
    } else {
      if (phonemeIdMap[ph.charAt(0)] !== undefined) {
        ids.push(phonemeIdMap[ph.charAt(0)]);
        ids.push(padId);
      }
    }
  }
  
  ids.push(endId);
  return ids;
}

/**
 * Browser-native TTS Provider using Web Speech API (window.speechSynthesis).
 * Fully functional offline and out of the box.
 */
export class BrowserTTSProvider implements TTSProvider {
  id = 'browser';
  name = 'Системный голос (Web Speech API)';
  languageSupport = ['ru', 'en', 'he'];

  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private keepAliveInterval: any = null;

  async listVoices(): Promise<Voice[]> {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return [];
    }

    let voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      await new Promise<void>((resolve) => {
        window.speechSynthesis.onvoiceschanged = () => {
          voices = window.speechSynthesis.getVoices();
          resolve();
        };
        setTimeout(resolve, 500);
      });
    }

    const list = voices
      .filter(voice => {
        const lang = voice.lang.toLowerCase();
        return lang.startsWith('ru') || lang.startsWith('en') || lang.startsWith('he') || lang.startsWith('iw');
      })
      .map(voice => {
        const lang = voice.lang.toLowerCase();
        let langCode = 'en';
        if (lang.startsWith('ru')) langCode = 'ru';
        else if (lang.startsWith('he') || lang.startsWith('iw')) langCode = 'he';
        
        const isRussian = langCode === 'ru';
        return {
          id: voice.name,
          name: voice.name + (voice.localService ? ' (Локальный)' : ''),
          lang: langCode,
          gender: ((voice.name.toLowerCase().includes('female') || voice.name.toLowerCase().includes('google русский') || voice.name.toLowerCase().includes('irina')) ? 'female' : 'male') as 'male' | 'female' | 'neutral',
          providerId: 'browser'
        };
      });

    // Prioritize Russian, then English, then Hebrew
    return list.sort((a, b) => {
      const order = { 'ru': 1, 'en': 2, 'he': 3 };
      const valA = order[a.lang as keyof typeof order] || 4;
      const valB = order[b.lang as keyof typeof order] || 4;
      return valA - valB;
    });
  }

  async synthesize(text: string, voiceId: string, speed: number): Promise<string> {
    return 'native-speech';
  }

  speak(text: string, voiceId: string, speed: number, onStart: () => void, onEnd: () => void, onError: (err: any) => void): () => void {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      onError(new Error('Web Speech API не поддерживается этим браузером.'));
      return () => {};
    }

    window.speechSynthesis.cancel();
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }

    const normalized = normalizeTextForTTS(text);
    const chunks = splitIntoChunks(normalized, 180);
    if (chunks.length === 0) {
      onEnd();
      return () => {};
    }

    let currentChunkIndex = 0;
    let isStopped = false;

    // Keepalive ping for Chrome/Android
    this.keepAliveInterval = setInterval(() => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);

    const playNextChunk = () => {
      if (isStopped) return;
      if (currentChunkIndex >= chunks.length) {
        if (this.keepAliveInterval) {
          clearInterval(this.keepAliveInterval);
          this.keepAliveInterval = null;
        }
        onEnd();
        return;
      }

      const chunkText = chunks[currentChunkIndex];
      const utterance = new SpeechSynthesisUtterance(chunkText);
      this.currentUtterance = utterance;

      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.name === voiceId);
      if (voice) {
        utterance.voice = voice;
      } else {
        const fallbackVoice = voices.find(v => v.lang.startsWith('ru')) || voices.find(v => v.lang.startsWith('en'));
        if (fallbackVoice) {
          utterance.voice = fallbackVoice;
        }
      }

      utterance.rate = speed;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        if (currentChunkIndex === 0) {
          onStart();
        }
      };

      utterance.onend = () => {
        currentChunkIndex++;
        playNextChunk();
      };

      utterance.onerror = (event) => {
        if (event.error !== 'interrupted') {
          onError(event);
        }
        if (this.keepAliveInterval) {
          clearInterval(this.keepAliveInterval);
          this.keepAliveInterval = null;
        }
        this.currentUtterance = null;
      };

      window.speechSynthesis.speak(utterance);
    };

    playNextChunk();

    return () => {
      isStopped = true;
      if (this.keepAliveInterval) {
        clearInterval(this.keepAliveInterval);
        this.keepAliveInterval = null;
      }
      window.speechSynthesis.cancel();
      this.currentUtterance = null;
    };
  }

  pause() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.pause();
    }
  }

  resume() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.resume();
    }
  }

  stop() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}

function getHuggingFaceUrl(voiceId: string, extension: 'json' | 'onnx'): string {
  const parts = voiceId.split('-'); // e.g. ['ru_RU', 'dmitry', 'medium']
  if (parts.length === 3) {
    const lang = parts[0];     // 'ru_RU'
    const name = parts[1];     // 'dmitry'
    const quality = parts[2];  // 'medium'
    const langPrefix = lang.split('_')[0]; // 'ru'
    return `https://huggingface.co/rhasspy/piper-voices/resolve/main/${langPrefix}/${lang}/${name}/${quality}/${voiceId}.${extension}`;
  }
  return `https://huggingface.co/rhasspy/piper-voices/resolve/main/${voiceId}.${extension}`;
}

/**
 * Helper to read response body stream with progress monitoring.
 */
async function readResponseWithProgress(
  response: Response,
  url: string,
  cacheName: string,
  onProgress?: (percent: number) => void
): Promise<ArrayBuffer> {
  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  const reader = response.body?.getReader();
  if (!reader) {
    const arrayBuffer = await response.arrayBuffer();
    try {
      const cache = await caches.open(cacheName);
      await cache.put(url, new Response(arrayBuffer.slice(0)));
    } catch (e) {}
    return arrayBuffer;
  }

  const chunks: Uint8Array[] = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.length;
      if (total > 0 && onProgress) {
        onProgress(Math.round((loaded / total) * 100));
      }
    }
  }

  const merged = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  try {
    const cache = await caches.open(cacheName);
    await cache.put(url, new Response(merged.slice(0), {
      headers: {
        'Content-Type': url.endsWith('.json') ? 'application/json' : 'application/octet-stream',
        'Content-Length': loaded.toString()
      }
    }));
  } catch (e) {}

  return merged.buffer;
}

/**
 * Cache Storage helper with real-time download tracking and HuggingFace CDN fallback.
 */
async function fetchWithCache(
  url: string,
  onProgress?: (percent: number) => void,
  voiceId?: string,
  extension?: 'json' | 'onnx'
): Promise<ArrayBuffer> {
  const cacheName = 'piper-models-cache';
  
  // 1. Try Cache match on original local URL
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(url);
    if (cachedResponse) {
      const contentType = cachedResponse.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        console.warn(`Deleting invalid HTML response from cache for: ${url}`);
        await cache.delete(url);
      } else {
        if (onProgress) onProgress(100);
        return await cachedResponse.arrayBuffer();
      }
    }
  } catch (e) {
    console.warn('Кэш браузера недоступен:', e);
  }

  // 2. Try Cache match on HuggingFace URL as well
  let hfUrl = '';
  if (voiceId && extension) {
    hfUrl = getHuggingFaceUrl(voiceId, extension);
    try {
      const cache = await caches.open(cacheName);
      const cachedResponse = await cache.match(hfUrl);
      if (cachedResponse) {
        const contentType = cachedResponse.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          console.warn(`Deleting invalid HTML response from cache for: ${hfUrl}`);
          await cache.delete(hfUrl);
        } else {
          if (onProgress) onProgress(100);
          return await cachedResponse.arrayBuffer();
        }
      }
    } catch (e) {}
  }

  // 3. Try fetching from original local URL
  try {
    const response = await fetch(url);
    const contentType = response.headers.get('content-type') || '';
    if (response.ok && !contentType.includes('text/html')) {
      const buffer = await readResponseWithProgress(response, url, cacheName, onProgress);
      // Double cache under HF URL if applicable
      if (hfUrl) {
        try {
          const cache = await caches.open(cacheName);
          await cache.put(hfUrl, new Response(buffer.slice(0), {
            headers: {
              'Content-Type': extension === 'json' ? 'application/json' : 'application/octet-stream'
            }
          }));
        } catch (e) {}
      }
      return buffer;
    } else {
      console.warn(`Local file ${url} not found or returned HTML page. Switching to Hugging Face CDN.`);
    }
  } catch (e) {
    console.warn(`Local fetch failed for ${url}, trying Hugging Face...`, e);
  }

  // 4. Try fetching from HuggingFace CDN
  if (hfUrl) {
    console.log(`Fetching from Hugging Face: ${hfUrl}`);
    try {
      let response = await fetch(hfUrl);
      let contentType = response.headers.get('content-type') || '';
      if (!response.ok && extension === 'json') {
        const altHfUrl = hfUrl.replace('.json', '.onnx.json');
        console.log(`JSON failed, trying alternate HF URL: ${altHfUrl}`);
        response = await fetch(altHfUrl);
        contentType = response.headers.get('content-type') || '';
      }
      if (response.ok && !contentType.includes('text/html')) {
        const buffer = await readResponseWithProgress(response, hfUrl, cacheName, onProgress);
        // Double cache under local URL so SettingsView check matches correctly
        try {
          const cache = await caches.open(cacheName);
          await cache.put(url, new Response(buffer.slice(0), {
            headers: {
              'Content-Type': extension === 'json' ? 'application/json' : 'application/octet-stream'
            }
          }));
        } catch (e) {}
        return buffer;
      } else {
        console.warn(`Hugging Face resolved with error or HTML for ${hfUrl}`);
      }
    } catch (e) {
      console.warn(`HuggingFace fetch failed for ${hfUrl}`, e);
    }
  }

  throw new Error(`Не удалось загрузить файл ни из локального хранилища, ни с Hugging Face.`);
}

/**
 * Piper Web Neural TTS Provider (Client-only ONNX Runtime Web).
 */
export class PiperTTSProvider implements TTSProvider {
  id = 'piper';
  name = 'Piper Web Neural (Экспериментальный)';
  languageSupport = ['ru', 'en', 'he'];

  // Global static session and config caching to prevent reloading
  private static sessionCache: Record<string, any> = {};
  private static configCache: Record<string, any> = {};

  // Callback to report progress and state to UI components
  onProgress?: (status: { type: 'downloading' | 'compiling' | 'ready' | 'error'; message: string; progress?: number }) => void;

  async listVoices(): Promise<Voice[]> {
    return PIPER_VOICES;
  }

  /**
   * Pre-loads, downloads, and initializes the ONNX session ahead of time.
   */
  async preheat(voiceId: string): Promise<boolean> {
    if (PiperTTSProvider.sessionCache[voiceId]) {
      if (this.onProgress) {
        this.onProgress({ type: 'ready', message: 'Голос загружен и готов к чтению!', progress: 100 });
      }
      return true;
    }

    try {
      if (this.onProgress) {
        this.onProgress({ type: 'downloading', message: 'Инициализация конфигурации...', progress: 5 });
      }

      // Fetch config file
      const configUrl = getAssetPath(`models/piper/${voiceId}.json`);
      const configBuffer = await fetchWithCache(configUrl, (p) => {
        if (this.onProgress) {
          this.onProgress({ type: 'downloading', message: 'Скачивание настроек голоса...', progress: Math.min(10, Math.round(p / 10)) });
        }
      }, voiceId, 'json');
      const configJson = JSON.parse(new TextDecoder().decode(configBuffer));
      PiperTTSProvider.configCache[voiceId] = configJson;

      if (this.onProgress) {
        this.onProgress({ type: 'downloading', message: 'Начало скачивания нейросетевой модели...', progress: 10 });
      }

      // Fetch model file
      const modelUrl = getAssetPath(`models/piper/${voiceId}.onnx`);
      const modelBuffer = await fetchWithCache(modelUrl, (p) => {
        if (this.onProgress) {
          // Map to 10% - 90%
          const progress = 10 + Math.round((p / 100) * 80);
          this.onProgress({ type: 'downloading', message: `Загрузка нейросетевой модели (${voiceId})... ${p}%`, progress });
        }
      }, voiceId, 'onnx');

      if (this.onProgress) {
        this.onProgress({ type: 'compiling', message: 'Загрузка библиотек ONNX и компиляция модели в браузере...', progress: 92 });
      }

      // Load onnxruntime-web dynamically
      const ort = await import('onnxruntime-web');

      // Configure WASM paths utilizing official CDN as high-speed reliable fallback
      if (ort.env && ort.env.wasm) {
        ort.env.wasm.numThreads = 1;
        ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.0/dist/';
      }

      // Compile ONNX Session
      const session = await ort.InferenceSession.create(new Uint8Array(modelBuffer));
      PiperTTSProvider.sessionCache[voiceId] = session;

      if (this.onProgress) {
        this.onProgress({ type: 'ready', message: 'Голос готов к чтению! Сгенерировано полностью в браузере.', progress: 100 });
      }
      return true;
    } catch (e: any) {
      console.error('Piper initialization failed:', e);
      if (this.onProgress) {
        this.onProgress({ 
          type: 'error', 
          message: `Ошибка загрузки Piper: ${e.message || e}. Будет использован системный голос как замена.` 
        });
      }
      return false;
    }
  }

  async synthesize(text: string, voiceId: string, speed: number): Promise<string> {
    const isLoaded = await this.preheat(voiceId);
    if (!isLoaded) {
      throw new Error('Не удалось запустить Piper Web Neural. Проверьте подключение к сети.');
    }

    const session = PiperTTSProvider.sessionCache[voiceId];
    const config = PiperTTSProvider.configCache[voiceId];

    if (!session || !config) {
      throw new Error('Сессия нейросети не готова.');
    }

    try {
      const phonemeIdMap = config.phonemes || config.phoneme_id_map || {};
      const sampleRate = config.audio?.sample_rate || 22050;
      const lang = voiceId.split('_')[0] || 'ru';

      // 1. Text to phonemes conversion
      const phonemeIds = textToPhonemeIds(text, phonemeIdMap, lang);
      if (phonemeIds.length <= 2) {
        return ''; // signal to skip this paragraph/chunk
      }

      // 2. Load ONNX to prepare inputs
      const ort = await import('onnxruntime-web');
      const inputTensor = new ort.Tensor('int64', BigInt64Array.from(phonemeIds.map(BigInt)), [1, phonemeIds.length]);
      const lengthsTensor = new ort.Tensor('int64', BigInt64Array.from([BigInt(phonemeIds.length)]), [1]);
      
      // Speed controls length scale (less than 1.0 is faster)
      const lengthScale = 1.0 / speed;
      const scalesTensor = new ort.Tensor('float32', Float32Array.from([0.667, lengthScale, 0.8]), [3]);

      const feeds: Record<string, any> = {
        input: inputTensor,
        input_lengths: lengthsTensor,
        scales: scalesTensor,
      };

      if (session.inputNames.includes('sid')) {
        feeds['sid'] = new ort.Tensor('int64', BigInt64Array.from([BigInt(0)]), [1]);
      }

      // 3. Run ONNX Inference
      const results = await session.run(feeds);
      const outputName = session.outputNames[0] || 'output';
      const outputTensor = results[outputName];
      const pcmFloatData = outputTensor.data as Float32Array;

      // 4. Encode PCM Floats to standard playable WAV Blob
      const wavBlob = pcmFloatToWavBlob(pcmFloatData, sampleRate);
      return URL.createObjectURL(wavBlob);
    } catch (e: any) {
      console.error('Synthesis error:', e);
      throw new Error(`Ошибка синтеза Piper: ${e.message || e}`);
    }
  }
}

/**
 * Converts Float32 PCM values into a binary 16-bit signed WAV Blob.
 */
function pcmFloatToWavBlob(pcmFloats: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + pcmFloats.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcmFloats.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // Linear PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); // 16-bit mono alignment
  view.setUint16(34, 16, true); // 16 bits per sample
  writeString(view, 36, 'data');
  view.setUint32(40, pcmFloats.length * 2, true);

  let offset = 44;
  for (let i = 0; i < pcmFloats.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, pcmFloats[i]));
    let val = s < 0 ? s * 0x8000 : s * 0x7FFF;
    view.setInt16(offset, val, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Silero Server TTS Provider.
 * Communicates with a future or local Python Silero backend.
 * Kept for backwards compatibility / future extensions, dormant.
 */
export class SileroServerTTSProvider implements TTSProvider {
  id = 'silero';
  name = 'Silero Neural TTS (Локальный сервер)';
  languageSupport = ['ru'];
  serverUrl: string;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl || 'http://localhost:8000';
  }

  async listVoices(): Promise<Voice[]> {
    return [
      { id: 'ru_0', name: 'Ксения (Женский)', lang: 'ru', gender: 'female', providerId: 'silero' },
      { id: 'ru_1', name: 'Александр (Мужской)', lang: 'ru', gender: 'male', providerId: 'silero' }
    ];
  }

  async synthesize(text: string, voiceId: string, speed: number): Promise<string> {
    throw new Error('Локальный Python сервер отключен в пользу полностью встроенного браузерного Piper Neural TTS.');
  }
}
