/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import JSZip from 'jszip';
import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth';
import { Book, Chapter } from '../types';

// Configure PDF.js worker using a standard CDN URL compatible with the installed pdfjs-dist version.
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${(pdfjs as any).version}/pdf.worker.min.mjs`;

// Helper: generate a unique ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

// Clean and split text into paragraphs
function cleanAndSplitParagraphs(text: string): string[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(p => p.length > 0);
}

/**
 * Parses a plain text (.txt) file.
 */
export async function parseTxt(file: File): Promise<Omit<Book, 'currentChapterIndex' | 'currentParagraphIndex' | 'bookmarks' | 'lastReadAt'>> {
  const text = await file.text();
  const paragraphs = cleanAndSplitParagraphs(text);

  // Divide long text files into chapters of ~30 paragraphs each for better playing experience
  const chapters: Chapter[] = [];
  const chunkSize = 30;
  
  if (paragraphs.length <= chunkSize) {
    chapters.push({
      title: 'Начало книги',
      paragraphs: paragraphs,
    });
  } else {
    for (let i = 0; i < paragraphs.length; i += chunkSize) {
      const index = Math.floor(i / chunkSize) + 1;
      // Try to find a header in the first few lines of the chunk
      let title = `Часть ${index}`;
      const chunk = paragraphs.slice(i, i + chunkSize);
      
      chapters.push({
        title,
        paragraphs: chunk,
      });
    }
  }

  // Use file name without extension as title
  const title = file.name.replace(/\.[^/.]+$/, "");

  return {
    id: generateId(),
    title,
    author: 'Неизвестный автор',
    coverUrl: null,
    addedAt: Date.now(),
    fileType: 'txt',
    chapters,
  };
}

/**
 * Parses an FB2 (.fb2) book file.
 * FB2 is an XML-based format, easily parsed via DOMParser in-browser.
 */
export async function parseFb2(file: File): Promise<Omit<Book, 'currentChapterIndex' | 'currentParagraphIndex' | 'bookmarks' | 'lastReadAt'>> {
  const rawBuffer = await file.arrayBuffer();
  const utfText = new TextDecoder('utf-8', { fatal: false }).decode(rawBuffer);
  
  // If XML specifies windows-1251 encoding, re-decode using it
  const encodingMatch = utfText.match(/encoding=["']([^"']+)["']/i);
  const encoding = encodingMatch?.[1]?.toLowerCase() || 'utf-8';
  const text = new TextDecoder(encoding, { fatal: false }).decode(rawBuffer);

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(text, 'text/xml');

  // Metadata
  const titleInfo = xmlDoc.getElementsByTagName('title-info')[0];
  let title = file.name.replace(/\.[^/.]+$/, "");
  let author = 'Неизвестный автор';

  if (titleInfo) {
    const bookTitleNode = titleInfo.getElementsByTagName('book-title')[0];
    if (bookTitleNode && bookTitleNode.textContent) {
      title = bookTitleNode.textContent;
    }

    const authorNode = titleInfo.getElementsByTagName('author')[0];
    if (authorNode) {
      const first = authorNode.getElementsByTagName('first-name')[0]?.textContent || '';
      const last = authorNode.getElementsByTagName('last-name')[0]?.textContent || '';
      if (first || last) {
        author = `${first} ${last}`.trim();
      }
    }
  }

  // Body and chapters
  const chapters: Chapter[] = [];
  const sections = xmlDoc.getElementsByTagName('section');

  if (sections.length > 0) {
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      // Skip very nested sections, parse top levels or check if it contains paragraphs
      const pElements = section.getElementsByTagName('p');
      if (pElements.length === 0) continue;

      let chapterTitle = `Раздел ${i + 1}`;
      const titleNode = section.getElementsByTagName('title')[0];
      if (titleNode && titleNode.textContent) {
        chapterTitle = titleNode.textContent.replace(/\s+/g, ' ').trim();
      }

      const paragraphs: string[] = [];
      for (let j = 0; j < pElements.length; j++) {
        const pText = pElements[j].textContent;
        if (pText && pText.trim()) {
          paragraphs.push(pText.trim());
        }
      }

      if (paragraphs.length > 0) {
        chapters.push({
          title: chapterTitle,
          paragraphs,
        });
      }
    }
  }

  // Fallback if no sections parsed
  if (chapters.length === 0) {
    const pElements = xmlDoc.getElementsByTagName('p');
    const paragraphs: string[] = [];
    for (let i = 0; i < pElements.length; i++) {
      const pText = pElements[i].textContent;
      if (pText && pText.trim()) {
        paragraphs.push(pText.trim());
      }
    }
    chapters.push({
      title: 'Текст книги',
      paragraphs: paragraphs.length > 0 ? paragraphs : ['[Пустая книга]'],
    });
  }

  return {
    id: generateId(),
    title,
    author,
    coverUrl: null,
    addedAt: Date.now(),
    fileType: 'fb2',
    chapters,
  };
}

/**
 * Parses an EPUB (.epub) file.
 * We load it into JSZip, look up container.xml -> content.opf -> HTML spin documents.
 */
export async function parseEpub(file: File): Promise<Omit<Book, 'currentChapterIndex' | 'currentParagraphIndex' | 'bookmarks' | 'lastReadAt'>> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  // 1. Find full path of container.xml
  const containerXmlStr = await zip.file('META-INF/container.xml')?.async('text');
  if (!containerXmlStr) {
    throw new Error('Invalid EPUB: Missing META-INF/container.xml');
  }

  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(containerXmlStr, 'text/xml');
  const rootfile = containerDoc.getElementsByTagName('rootfile')[0];
  const opfPath = rootfile?.getAttribute('full-path');

  if (!opfPath) {
    throw new Error('Invalid EPUB: Container does not specify rootfile path');
  }

  // 2. Get the OPF content
  const opfStr = await zip.file(opfPath)?.async('text');
  if (!opfStr) {
    throw new Error(`Invalid EPUB: OPF file not found at ${opfPath}`);
  }

  const opfDoc = parser.parseFromString(opfStr, 'text/xml');

  // Extract base directory of OPF (important for relative paths inside it)
  const opfBaseDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

  // Metadata: Title & Author
  let title = file.name.replace(/\.[^/.]+$/, "");
  let author = 'Неизвестный автор';

  const metadataNode = opfDoc.getElementsByTagName('metadata')[0];
  if (metadataNode) {
    const titleNode = metadataNode.getElementsByTagName('dc:title')[0] || metadataNode.getElementsByTagName('title')[0];
    if (titleNode && titleNode.textContent) {
      title = titleNode.textContent;
    }
    const creatorNode = metadataNode.getElementsByTagName('dc:creator')[0] || metadataNode.getElementsByTagName('creator')[0];
    if (creatorNode && creatorNode.textContent) {
      author = creatorNode.textContent;
    }
  }

  // Manifest: items mapped by ID
  const manifestNode = opfDoc.getElementsByTagName('manifest')[0];
  const manifestItems: Record<string, string> = {};
  if (manifestNode) {
    const items = manifestNode.getElementsByTagName('item');
    for (let i = 0; i < items.length; i++) {
      const id = items[i].getAttribute('id');
      const href = items[i].getAttribute('href');
      if (id && href) {
        manifestItems[id] = href;
      }
    }
  }

  // Spine: read order
  const spineNode = opfDoc.getElementsByTagName('spine')[0];
  const spineIds: string[] = [];
  if (spineNode) {
    const itemrefs = spineNode.getElementsByTagName('itemref');
    for (let i = 0; i < itemrefs.length; i++) {
      const idref = itemrefs[i].getAttribute('idref');
      if (idref) {
        spineIds.push(idref);
      }
    }
  }

  // Read spine files in order
  const chapters: Chapter[] = [];
  let chapterIndex = 1;

  for (const idref of spineIds) {
    const relativeHref = manifestItems[idref];
    if (!relativeHref) continue;

    // Decode URL formatting in href
    const decodedHref = decodeURIComponent(relativeHref);
    const fullZipPath = opfBaseDir + decodedHref;
    
    // Normalize path (handle relative directory travel like '../styles/..' or similar)
    const normalizedPath = fullZipPath.replace(/\/[^/]+\/\.\.\//g, '/');

    const htmlFile = zip.file(normalizedPath);
    if (!htmlFile) continue;

    const htmlContent = await htmlFile.async('text');
    const htmlDoc = parser.parseFromString(htmlContent, 'text/html');

    // Attempt to extract title
    let chapterTitle = htmlDoc.querySelector('title')?.textContent || 
                       htmlDoc.querySelector('h1')?.textContent || 
                       htmlDoc.querySelector('h2')?.textContent || 
                       `Глава ${chapterIndex}`;
    
    chapterTitle = chapterTitle.replace(/\s+/g, ' ').trim();
    if (chapterTitle.length > 80) {
      chapterTitle = chapterTitle.substring(0, 80) + '...';
    }

    // Extract paragraphs
    const paragraphs: string[] = [];
    const pElements = htmlDoc.querySelectorAll('p, li');
    
    pElements.forEach(p => {
      const pText = p.textContent?.replace(/\s+/g, ' ').trim();
      if (pText && pText.length > 4) {
        paragraphs.push(pText);
      }
    });

    if (paragraphs.length > 0) {
      chapters.push({
        title: chapterTitle,
        paragraphs,
      });
      chapterIndex++;
    }
  }

  // Fallback if empty EPUB
  if (chapters.length === 0) {
    chapters.push({
      title: 'Текст книги',
      paragraphs: ['Ошибка при извлечении глав или пустая книга.'],
    });
  }

  return {
    id: generateId(),
    title,
    author,
    coverUrl: null,
    addedAt: Date.now(),
    fileType: 'epub',
    chapters,
  };
}

/**
 * Parses a PDF file using pdfjs-dist.
 */
export async function parsePdf(file: File): Promise<Omit<Book, 'currentChapterIndex' | 'currentParagraphIndex' | 'bookmarks' | 'lastReadAt'>> {
  const arrayBuffer = await file.arrayBuffer();
  
  // Load document
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  
  const numPages = pdf.numPages;
  const chapters: Chapter[] = [];
  
  let totalTextLength = 0;
  
  // Parse PDF page-by-page. For the MVP, treat each PDF page (or groups of pages) as chapters
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Group text items by line roughly
    const textItems = textContent.items as any[];
    let lastY = -1;
    let pageText = '';
    
    for (const item of textItems) {
      if (item.str !== undefined) {
        // If Y changes substantially, we treat it as a new line / paragraph
        if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
          pageText += '\n';
        }
        pageText += item.str + ' ';
        lastY = item.transform[5];
      }
    }
    
    totalTextLength += pageText.trim().length;
    
    const paragraphs = pageText
      .split('\n')
      .map(p => p.replace(/\s+/g, ' ').trim())
      .filter(p => p.length > 5);
      
    if (paragraphs.length > 0) {
      chapters.push({
        title: `Страница ${pageNum}`,
        paragraphs,
      });
    }
  }
  
  // Check if we extracted almost no text (scanned image PDF)
  if (totalTextLength < numPages * 10) {
    throw new Error('This PDF looks like scanned images. OCR is not supported yet.');
  }

  const title = file.name.replace(/\.[^/.]+$/, "");

  return {
    id: generateId(),
    title,
    author: 'Документ PDF',
    coverUrl: null,
    addedAt: Date.now(),
    fileType: 'pdf',
    chapters,
  };
}

/**
 * Parses a DOCX file using mammoth.js.
 */
export async function parseDocx(file: File): Promise<Omit<Book, 'currentChapterIndex' | 'currentParagraphIndex' | 'bookmarks' | 'lastReadAt'>> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  
  const html = result.value; // Extracted HTML
  const parser = new DOMParser();
  const htmlDoc = parser.parseFromString(html, 'text/html');
  
  const chapters: Chapter[] = [];
  const paragraphs: string[] = [];
  
  const pElements = htmlDoc.querySelectorAll('p, h1, h2, h3, h4, h5, h6');
  
  pElements.forEach(p => {
    const text = p.textContent?.replace(/\s+/g, ' ').trim();
    if (text && text.length > 0) {
      paragraphs.push(text);
    }
  });
  
  // Group paragraphs into chapters of 30 paragraphs
  const chunkSize = 30;
  if (paragraphs.length <= chunkSize) {
    chapters.push({
      title: 'Текст документа',
      paragraphs,
    });
  } else {
    for (let i = 0; i < paragraphs.length; i += chunkSize) {
      const index = Math.floor(i / chunkSize) + 1;
      chapters.push({
        title: `Часть ${index}`,
        paragraphs: paragraphs.slice(i, i + chunkSize),
      });
    }
  }

  const title = file.name.replace(/\.[^/.]+$/, "");

  return {
    id: generateId(),
    title,
    author: 'Документ Word',
    coverUrl: null,
    addedAt: Date.now(),
    fileType: 'docx',
    chapters,
  };
}

/**
 * Main parser router
 */
export async function parseBookFile(file: File): Promise<Book> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  let parsedBookData: Omit<Book, 'currentChapterIndex' | 'currentParagraphIndex' | 'bookmarks' | 'lastReadAt'>;

  switch (extension) {
    case 'txt':
      parsedBookData = await parseTxt(file);
      break;
    case 'fb2':
      parsedBookData = await parseFb2(file);
      break;
    case 'epub':
      parsedBookData = await parseEpub(file);
      break;
    case 'pdf':
      parsedBookData = await parsePdf(file);
      break;
    case 'docx':
      parsedBookData = await parseDocx(file);
      break;
    default:
      throw new Error(`Unsupported file format: .${extension}. Please upload TXT, EPUB, FB2, PDF, or DOCX.`);
  }

  return {
    ...parsedBookData,
    currentChapterIndex: 0,
    currentParagraphIndex: 0,
    bookmarks: [],
    lastReadAt: Date.now(),
  };
}
