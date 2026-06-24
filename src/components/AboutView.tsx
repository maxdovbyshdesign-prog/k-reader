/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Info, ShieldCheck, Headphones, Heart, FileText, CheckCircle2 } from 'lucide-react';

export default function AboutView() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="max-w-3xl mx-auto px-4 py-6 space-y-6"
    >
      <div className="flex items-center gap-3 border-b border-zinc-900 pb-3 mb-6">
        <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
          <Info className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-zinc-100">О проекте</h2>
          <p className="text-xs text-zinc-400">Твоя личная говорящая библиотека</p>
        </div>
      </div>

      <div className="space-y-6 text-sm text-zinc-300 leading-relaxed">
        
        {/* Intro */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/5 to-amber-600/0 border border-amber-500/10 space-y-3">
          <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
            <Heart className="w-4 h-4 fill-amber-500 text-amber-500" />
            <span>Привет, Ксюша!</span>
          </h3>
          <p>
            <strong>Ksyusha Reader</strong> — это твой уютный личный аудиоридер, разработанный специально для того, чтобы превратить любые книги и документы в полноценные аудиокниги с красивым, качественным звучанием. 
          </p>
          <p>
            Приложение создавалось с фокусом на простоту, комфорт использования в дороге, а также на безупречное воспроизведение текстов (особенно на русском языке).
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/40 space-y-2">
            <h4 className="font-semibold text-zinc-100 flex items-center gap-2">
              <ShieldCheck className="w-4.5 h-4.5 text-amber-500/80" />
              <span>100% Приватность</span>
            </h4>
            <p className="text-xs text-zinc-400">
              Все файлы книг, текущий прогресс чтения, закладки и выбранные настройки хранятся локально в браузере (через IndexedDB). Никаких логинов, паролей, серверов и трекеров. Твои книги — только твои.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/40 space-y-2">
            <h4 className="font-semibold text-zinc-100 flex items-center gap-2">
              <Headphones className="w-4.5 h-4.5 text-amber-500/80" />
              <span>Создан для дороги</span>
            </h4>
            <p className="text-xs text-zinc-400">
              Крупные элементы управления плеером спроектированы так, чтобы по кнопкам Play, Пауза или Переход к следующему абзацу было легко попадать пальцем одной руки во время готовки или за рулем.
            </p>
          </div>
        </div>

        {/* Supported formats */}
        <div className="p-5 rounded-2xl bg-zinc-950/40 border border-zinc-900 space-y-3.5">
          <h3 className="text-xs font-bold font-mono text-amber-500 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span>Поддерживаемые форматы</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            {[
              { format: 'TXT', desc: 'Простые текстовые файлы, разбиваются по частям' },
              { format: 'EPUB', desc: 'Стандартные электронные книги с разбивкой по главам' },
              { format: 'FB2', desc: 'Российский формат электронных книг со строгой структурой' },
              { format: 'PDF', desc: 'Документы с текстовым слоем (для обычного чтения/докладов)' },
              { format: 'DOCX', desc: 'Файлы Microsoft Word (статьи, рефераты, конспекты)' }
            ].map((f) => (
              <div key={f.format} className="flex items-start gap-2.5 p-2 bg-zinc-900/30 rounded-lg border border-zinc-900">
                <CheckCircle2 className="w-4 h-4 text-amber-500/60 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-zinc-200">{f.format}</strong>
                  <p className="text-zinc-500 text-[11px] mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tips Section */}
        <div className="space-y-2 text-xs text-zinc-400">
          <h4 className="font-semibold text-zinc-200">Полезные советы по использованию:</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>Вы можете переключить цветовую гамму на <strong>Тёплый Сепия</strong> в Настройках, чтобы пощадить глаза в полной темноте.</li>
            <li>При клике на любой абзац в тексте плеер мгновенно перенесёт озвучку именно на это предложение — это удобно, если вы пропустили кусок текста.</li>
            <li>Используйте иконку <strong>Закладки</strong> во время воспроизведения, чтобы сохранить интересный момент с личной заметкой и вернуться к нему в один клик.</li>
          </ul>
        </div>

      </div>
    </motion.div>
  );
}
