/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, FileText, Trash2, BookOpen, AlertTriangle, Loader2 } from 'lucide-react';
import { Book } from '../types';
import { parseBookFile } from '../lib/parsers';
import { saveBook, deleteBook } from '../lib/db';

interface LibraryViewProps {
  key?: string;
  books: Book[];
  onBookSelected: (bookId: string) => void;
  onRefreshLibrary: () => void;
}

export default function LibraryView({ books, onBookSelected, onRefreshLibrary }: LibraryViewProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [parsingStatus, setParsingStatus] = useState<{ loading: boolean; fileName?: string; error?: string }>({ loading: false });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const processFile = async (file: File) => {
    setParsingStatus({ loading: true, fileName: file.name });
    try {
      const parsedBook = await parseBookFile(file);
      await saveBook(parsedBook);
      setParsingStatus({ loading: false });
      onRefreshLibrary();
      // Auto open newly added book
      onBookSelected(parsedBook.id);
    } catch (err: any) {
      console.error(err);
      setParsingStatus({
        loading: false,
        error: err.message || 'Ошибка при обработке файла. Убедитесь, что формат поддерживается.',
      });
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleDeleteClick = (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation();
    setDeleteConfirmId(bookId);
  };

  const confirmDelete = async (bookId: string) => {
    await deleteBook(bookId);
    setDeleteConfirmId(null);
    onRefreshLibrary();
  };

  const cancelDelete = () => {
    setDeleteConfirmId(null);
  };

  // Helper to format added date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Helper to calculate reading percentage
  const calculateProgress = (book: Book) => {
    if (!book.chapters || book.chapters.length === 0) return 0;
    
    // Total paragraphs in book
    const totalParas = book.chapters.reduce((acc, chap) => acc + (chap.paragraphs?.length || 0), 0);
    if (totalParas === 0) return 0;

    // Played paragraphs
    let readParas = 0;
    for (let i = 0; i < book.currentChapterIndex; i++) {
      readParas += book.chapters[i].paragraphs?.length || 0;
    }
    readParas += book.currentParagraphIndex;

    const percent = Math.min(100, Math.round((readParas / totalParas) * 100));
    return percent;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="max-w-4xl mx-auto px-4 py-6"
    >
      {/* Upload Zone */}
      <div
        id="file-dropzone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileSelect}
        className={`relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 p-8 text-center flex flex-col items-center justify-center gap-4 ${
          isDragging
            ? 'border-[#F27D26] bg-[#F27D26]/10 scale-[0.99] shadow-inner shadow-[#F27D26]/10'
            : 'border-white/10 bg-white/[0.02] hover:border-[#F27D26]/30 hover:bg-white/5'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.epub,.fb2,.pdf,.docx"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="p-4 rounded-full bg-gradient-to-b from-[#F27D26]/20 to-transparent border border-[#F27D26]/20 shadow-lg shadow-[#F27D26]/5">
          {parsingStatus.loading ? (
            <Loader2 className="w-8 h-8 text-[#F27D26] animate-spin" />
          ) : (
            <Upload className="w-8 h-8 text-[#F27D26]/80" />
          )}
        </div>

        {parsingStatus.loading ? (
          <div className="space-y-1">
            <h3 className="font-semibold text-zinc-100 text-sm font-sans">Извлекаем текст из книги...</h3>
            <p className="text-xs text-[#E0D8D0]/60 font-mono italic max-w-md mx-auto truncate">
              {parsingStatus.fileName}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <h3 className="font-semibold text-[#E0D8D0] text-sm sm:text-base font-sans">
              Перетащите файл книги сюда или <span className="text-[#F27D26] hover:underline">выберите на устройстве</span>
            </h3>
            <p className="text-xs text-[#E0D8D0]/50 max-w-sm sm:max-w-md mx-auto font-sans">
              Поддерживаются форматы <span className="font-mono text-[#E0D8D0] text-[11px] bg-white/5 px-1.5 py-0.5 rounded border border-white/5">TXT</span>, <span className="font-mono text-[#E0D8D0] text-[11px] bg-white/5 px-1.5 py-0.5 rounded border border-white/5">EPUB</span>, <span className="font-mono text-[#E0D8D0] text-[11px] bg-white/5 px-1.5 py-0.5 rounded border border-white/5">FB2</span>, <span className="font-mono text-[#E0D8D0] text-[11px] bg-white/5 px-1.5 py-0.5 rounded border border-white/5">PDF</span> (с текстовым слоем) и <span className="font-mono text-[#E0D8D0] text-[11px] bg-white/5 px-1.5 py-0.5 rounded border border-white/5">DOCX</span>
            </p>
          </div>
        )}

        {/* Error Display */}
        {parsingStatus.error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-2 p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs text-left max-w-md flex items-start gap-2.5 shadow-lg shadow-red-950/20"
            onClick={(e) => e.stopPropagation()} // Stop click triggering picker
          >
            <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-red-400 mt-0.5" />
            <div className="space-y-1">
              <span className="font-medium text-red-200">Не удалось загрузить книгу:</span>
              <p className="text-red-300/80 leading-relaxed">{parsingStatus.error}</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Library Title */}
      <div className="mt-10 mb-6 flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#E0D8D0] flex items-center gap-2 font-sans">
          <span>Моя библиотека</span>
          <span className="text-xs font-normal font-mono text-[#E0D8D0]/60 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
            {books.length}
          </span>
        </h2>
      </div>

      {/* Books Shelf/List */}
      <AnimatePresence mode="popLayout">
        {books.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 px-6 glass rounded-2xl"
          >
            <div className="p-4 bg-white/5 rounded-full inline-block border border-white/10 mb-4 text-[#E0D8D0]/40">
              <FileText className="w-6 h-6 text-[#F27D26]/70" />
            </div>
            <h3 className="text-sm font-semibold text-[#E0D8D0]/80">Ваша библиотека пока пуста</h3>
            <p className="text-xs text-[#E0D8D0]/50 max-w-xs mx-auto mt-1 leading-relaxed">
              Загрузите вашу первую книгу выше. Текст останется в памяти вашего устройства и не передается в облако.
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {books.map((book) => {
              const progress = calculateProgress(book);
              const isDeleting = deleteConfirmId === book.id;

              return (
                <motion.div
                  key={book.id}
                  layoutId={`book-card-${book.id}`}
                  className={`group relative overflow-hidden rounded-2xl border p-5 flex flex-col justify-between gap-4 transition-all duration-300 glass ${
                    isDeleting 
                      ? 'border-red-500/30 bg-red-950/10' 
                      : 'border-white/5 hover:border-[#F27D26]/20 hover:bg-white/[0.05] hover:shadow-[0_0_20px_rgba(242,125,38,0.03)]'
                  }`}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      {/* Format tag */}
                      <span className={`inline-block text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded tracking-wide border ${
                        book.fileType === 'epub' ? 'bg-[#553C9A]/15 border-[#553C9A]/30 text-indigo-300' :
                        book.fileType === 'fb2' ? 'bg-cyan-950/40 border-cyan-500/20 text-cyan-400' :
                        book.fileType === 'pdf' ? 'bg-rose-950/40 border-rose-500/20 text-rose-400' :
                        book.fileType === 'docx' ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-400' :
                        'bg-white/5 border-white/10 text-[#E0D8D0]/70'
                      }`}>
                        {book.fileType}
                      </span>
                      
                      <h3 className="font-semibold text-[#E0D8D0] text-sm sm:text-base leading-snug truncate group-hover:text-[#F27D26] transition-colors font-sans">
                        {book.title}
                      </h3>
                      <p className="text-xs text-[#E0D8D0]/60 truncate font-sans">
                        {book.author}
                      </p>
                    </div>

                    {/* Delete Icon Trigger */}
                    {!isDeleting && (
                      <button
                        onClick={(e) => handleDeleteClick(e, book.id)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Удалить книгу"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Confirm Delete Overlay */}
                  <AnimatePresence>
                    {isDeleting && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute inset-0 bg-[#0A0A0B]/95 flex flex-col items-center justify-center p-4 text-center z-10"
                      >
                        <p className="text-xs font-medium text-[#E0D8D0] mb-3">Удалить книгу "{book.title}"?</p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => confirmDelete(book.id)}
                            className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                          >
                            Да, удалить
                          </button>
                          <button
                            onClick={cancelDelete}
                            className="bg-white/10 hover:bg-white/20 text-[#E0D8D0] text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                          >
                            Отмена
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Bottom Stats & Progress */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#E0D8D0]/40">
                      <span>Добавлена {formatDate(book.addedAt)}</span>
                      <span className="text-[#F27D26] font-medium">{progress}% прочитано</span>
                    </div>

                    {/* Progress Bar Container */}
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
                      <div
                        className="h-full bg-gradient-to-r from-[#F27D26] to-[#F27D26]/80 transition-all duration-500 rounded-full shadow-[0_0_10px_rgba(242,125,38,0.5)]"
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    {/* Play/Open CTA */}
                    <button
                      id={`open-book-${book.id}`}
                      onClick={() => onBookSelected(book.id)}
                      className="w-full py-2 px-4 rounded-xl bg-white/5 border border-white/10 text-[#E0D8D0] hover:text-[#F27D26] hover:border-[#F27D26]/30 hover:bg-[#F27D26]/10 text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-300 shadow-md"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-[#F27D26]" />
                      <span>Открыть книгу</span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
