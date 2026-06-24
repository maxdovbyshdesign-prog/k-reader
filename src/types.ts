/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Chapter {
  title: string;
  paragraphs: string[];
}

export interface Bookmark {
  id: string;
  chapterIndex: number;
  paragraphIndex: number;
  timestamp: number;
  textPreview: string;
  note: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
  addedAt: number;
  fileType: 'txt' | 'epub' | 'fb2' | 'pdf' | 'docx';
  chapters: Chapter[];
  currentChapterIndex: number;
  currentParagraphIndex: number;
  bookmarks: Bookmark[];
  lastReadAt: number;
  wordOffset?: number; // Optional fine-grained offset
}

export interface Voice {
  id: string;
  name: string;
  lang: string;
  gender: 'male' | 'female' | 'neutral';
  providerId: string;
}

export interface TTSProvider {
  id: string;
  name: string;
  languageSupport: string[];
  listVoices(): Promise<Voice[]>;
  synthesize(text: string, voiceId: string, speed: number): Promise<string>;
}

export interface AppSettings {
  ttsProviderId: string;
  voiceId: string;
  speed: number;
  sileroServerUrl: string;
  autoScroll: boolean;
  cozyBackground: boolean;
  theme: 'cozy-dark' | 'cozy-warm' | 'classic-dark';
}
