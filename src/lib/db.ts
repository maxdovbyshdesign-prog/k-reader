/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Book, AppSettings } from '../types';

const DB_NAME = 'ksyusha_reader_db';
const DB_VERSION = 1;
const BOOKS_STORE = 'books';
const SETTINGS_STORE = 'settings';

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BOOKS_STORE)) {
        db.createObjectStore(BOOKS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE);
      }
    };
  });
}

export async function getAllBooks(): Promise<Book[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BOOKS_STORE, 'readonly');
    const store = transaction.objectStore(BOOKS_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort by last read date, then added date
      const books = request.result as Book[];
      books.sort((a, b) => b.lastReadAt - a.lastReadAt || b.addedAt - a.addedAt);
      resolve(books);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getBookById(id: string): Promise<Book | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BOOKS_STORE, 'readonly');
    const store = transaction.objectStore(BOOKS_STORE);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveBook(book: Book): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BOOKS_STORE, 'readwrite');
    const store = transaction.objectStore(BOOKS_STORE);
    const request = store.put(book);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteBook(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BOOKS_STORE, 'readwrite');
    const store = transaction.objectStore(BOOKS_STORE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getSettings(): Promise<AppSettings> {
  const db = await getDB();
  return new Promise((resolve) => {
    const transaction = db.transaction(SETTINGS_STORE, 'readonly');
    const store = transaction.objectStore(SETTINGS_STORE);
    const request = store.get('app_settings');

    request.onsuccess = () => {
      const defaultSettings: AppSettings = {
        ttsProviderId: 'browser',
        voiceId: '',
        speed: 1.0,
        sileroServerUrl: 'http://localhost:8000',
        autoScroll: true,
        cozyBackground: true,
        theme: 'cozy-dark',
      };
      resolve(request.result ? { ...defaultSettings, ...request.result } : defaultSettings);
    };
    request.onerror = () => {
      // Fallback
      resolve({
        ttsProviderId: 'browser',
        voiceId: '',
        speed: 1.0,
        sileroServerUrl: 'http://localhost:8000',
        autoScroll: true,
        cozyBackground: true,
        theme: 'cozy-dark',
      });
    };
  });
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE, 'readwrite');
    const store = transaction.objectStore(SETTINGS_STORE);
    const request = store.put(settings, 'app_settings');

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
