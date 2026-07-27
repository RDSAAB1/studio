import { firestoreDB } from './firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, onSnapshot, writeBatch } from 'firebase/firestore';

export interface Question {
  id: string;
  subject: string;
  category?: string;
  questionText: string;
  options: string[];
  correctOptionIndex: number; // 0-based index
  explanation: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
}

export interface QuestionProgress {
  questionId: string;
  attempts: number;
  lastScorePercentage: number; // 100 if correct, 0 if wrong/skipped
  isMastered: boolean; // True if scored 100%
  lastAttemptedAt: string;
  selectedOptionIndex?: number;
  userNote?: string;
}

export interface PracticeSessionStats {
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  skipped: number;
  scorePercentage: number;
  masteredInThisSession: number;
}

export const DEFAULT_SUBJECTS = [
  'All Subjects',
  'Medical & Science',
  'Mathematics',
  'Science & Tech',
  'Accounting & GST',
  'General Knowledge',
  'Logical Reasoning',
] as const;

// Default questions array is now EMPTY as requested
export const INITIAL_QUESTIONS: Question[] = [];

const STORAGE_KEY_QUESTIONS = 'jrmd_practice_questions';
const STORAGE_KEY_PROGRESS = 'jrmd_practice_progress';

export function getStoredQuestions(): Question[] {
  if (typeof window === 'undefined') return INITIAL_QUESTIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_QUESTIONS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_QUESTIONS, JSON.stringify(INITIAL_QUESTIONS));
      return INITIAL_QUESTIONS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse questions from localStorage', e);
    return INITIAL_QUESTIONS;
  }
}

export function saveStoredQuestions(questions: Question[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_QUESTIONS, JSON.stringify(questions));
  } catch (e) {
    console.error('Failed to save questions to localStorage', e);
  }
}

export function getStoredProgress(): Record<string, QuestionProgress> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROGRESS);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse progress from localStorage', e);
    return {};
  }
}

export function saveStoredProgress(progress: Record<string, QuestionProgress>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(progress));
  } catch (e) {
    console.error('Failed to save progress to localStorage', e);
  }
}

export function recordQuestionAnswer(
  questionId: string,
  selectedOptionIndex: number | undefined,
  correctOptionIndex: number
): QuestionProgress {
  const allProgress = getStoredProgress();
  const existing = allProgress[questionId] || {
    questionId,
    attempts: 0,
    lastScorePercentage: 0,
    isMastered: false,
    lastAttemptedAt: new Date().toISOString(),
  };

  const isCorrect = selectedOptionIndex !== undefined && selectedOptionIndex === correctOptionIndex;
  const scorePercentage = isCorrect ? 100 : 0;

  const updated: QuestionProgress = {
    ...existing,
    attempts: existing.attempts + 1,
    lastScorePercentage: scorePercentage,
    // 100% correct answer marks the question as mastered
    isMastered: isCorrect,
    lastAttemptedAt: new Date().toISOString(),
    selectedOptionIndex,
  };

  allProgress[questionId] = updated;
  saveStoredProgress(allProgress);
  return updated;
}

export function resetAllProgress(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY_PROGRESS);
}

export function clearAllQuestionsStorage(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY_QUESTIONS);
  localStorage.removeItem(STORAGE_KEY_PROGRESS);
}

export function resetQuestionMastery(questionId: string): void {
  const allProgress = getStoredProgress();
  if (allProgress[questionId]) {
    allProgress[questionId].isMastered = false;
    allProgress[questionId].lastScorePercentage = 0;
    saveStoredProgress(allProgress);
  }
}

/**
 * Universal Parser for ALL Question Formats
 */
/**
 * Pre-processor to format raw PDF text streams by inserting newlines before Question numbers, Option labels, and Answers
 */
export function preprocessPdfText(rawText: string): string {
  if (!rawText) return '';
  let text = rawText.replace(/--- Page \d+ ---/gi, '\n').replace(/\r\n/g, '\n');

  // Insert newline before Part / Topic headers
  text = text.replace(/([^\n])\s*(Part\s*\d+:|Topic\s*\d+:)/gi, '$1\n$2');

  // Insert newline before Question numbers (e.g. Q1. Q2. Q54. Q100. 1. 2. 72.)
  text = text.replace(/([^\n])\s*((?:Q|q)?\d+[\.\):]\s+)/gi, '$1\n$2');

  // Insert newline before Answer: or Ans:
  text = text.replace(/([^\n])\s*(Answer:|Ans:|Correct Answer:)/gi, '$1\n$2');

  // Insert newline before Explanation:, vyakhya:, Solution:, or Rationale:
  text = text.replace(/([^\n])\s*(\|?\s*(?:Explanation|vyakhya|Solution|Rationale):)/gi, '$1\n$2');

  // Format options, requiring strict uppercase A-D with punctuation and space
  const lines = text.split('\n').map((line) => {
    const trimmed = line.trim();
    if (/^(?:Answer|Ans|Correct Answer)[\s:-]+/i.test(trimmed)) {
      return line;
    }
    return line.replace(/([^\n])\s*([\(\[]?\s*[A-D]\s*[\)\.\-\:]\s+)/g, '$1\n$2');
  });

  return lines.join('\n');
}

/**
 * Line-by-Line Block Accumulator Bulk Parser for PDF / Raw Text Question Sets
 * Parses question statements, options A-D, inline Answers, Answer Key tables, and Explanations.
 */
export function parseBulkQuestions(rawText: string, defaultSubject: string = 'Medical & Science'): Question[] {
  if (!rawText || !rawText.trim()) return [];

  // Format raw single-line streams by inserting newlines
  const text = preprocessPdfText(rawText);
  const lines = text.split('\n');

  // Step 1: Global Answer Key Map (Only from explicit Answer Key section) & Explanations Map
  const globalAnswerKeyMap: Record<number, number> = {};
  const akSection = text.split(/(?:Answer Key|Answers Section)/i)[1];
  if (akSection) {
    const akRegex = /(?:Q|q)?(\d+)\s*[:\s=\|-]+\s*[\(\[]?\s*([A-Da-d])\s*[\)\]]?/g;
    let akMatch;
    while ((akMatch = akRegex.exec(akSection)) !== null) {
      const qNum = parseInt(akMatch[1], 10);
      const letter = akMatch[2].toUpperCase();
      const optIdx = letter.charCodeAt(0) - 65;
      if (optIdx >= 0 && optIdx <= 3) {
        globalAnswerKeyMap[qNum] = optIdx;
      }
    }
  }

  const globalExplanationMap: Record<number, string> = {};
  const expRegex = /(?:Q|q)?(\d+)\s+(?:Explanation|vyakhya|solution|rationale)[\s:-]+([\s\S]*?)(?=(?:(?:Q|q)?\d+\s+(?:Explanation|vyakhya|solution|rationale)|\#\#|Topic|Part|Answer Key|\n\s*\n\s*\n|$))/gi;
  let expMatch;
  while ((expMatch = expRegex.exec(text)) !== null) {
    const qNum = parseInt(expMatch[1], 10);
    const expText = expMatch[2].trim();
    if (expText) {
      globalExplanationMap[qNum] = expText;
    }
  }

  const questions: Question[] = [];
  let currentSubjectName = defaultSubject;
  let currentTopic = 'General Topic';
  let currentBlock: string[] = [];

  function processCurrentBlock() {
    if (currentBlock.length === 0) return;
    const blockText = currentBlock.join('\n').trim();
    currentBlock = [];

    // Stop if block enters Global Answer Key or Global Explanation section headers
    const contentText = blockText.split(/(?:Answer Key & Explanations|Answer Key \(1)/i)[0];

    const qNumMatch = contentText.match(/^(?:Q|q)?(\d+)[\.\):]\s*([\s\S]+)/i);
    if (!qNumMatch) return;

    const qNum = parseInt(qNumMatch[1], 10);
    const content = qNumMatch[2];

    // Extract inline Answer: (B) or Ans: (B) or Answer: B or Answer: C | Rationale:
    let inlineCorrectIdx: number | undefined = undefined;
    const ansMatch = blockText.match(/\b(?:Answer|Ans|Correct Answer)\b[\s:-]+(?:Option\s*)?[\(\[]?\s*([A-Da-d])\s*[\)\]\.\s\|]?/i);
    if (ansMatch) {
      inlineCorrectIdx = ansMatch[1].toUpperCase().charCodeAt(0) - 65;
    }

    // Extract inline Explanation / Rationale: ...
    let inlineExplanation: string | undefined = undefined;
    const expMatch = content.match(/\b(?:Explanation|vyakhya|Solution|Rationale)\b[\s:-]+([\s\S]*?)(?=(?:\n\s*(?:Q|q)?\d+[\.\)]|\n\s*\bPart\b|\n\s*\bTopic\b|$))/i);
    if (expMatch) {
      inlineExplanation = expMatch[1].trim().replace(/^\|\s*/, '').replace(/\s+/g, ' ');
    }

    // Extract Options: (A), (B), (C), (D) or A), B), C), D) or A., B., C., D.
    const optionMatches = [...content.matchAll(/(?:^|\n)\s*[\(\[]?\s*([A-D])\s*[\)\.\-\:]\s+([^\n]+)/g)];
    const optionsMap: Record<string, string> = {};
    let firstOptIdx = content.length;

    optionMatches.forEach((m) => {
      const letter = m[1].toUpperCase();
      let val = m[2].trim();
      val = val.split(/\b(?:Answer|Ans|Explanation|Solution|Rationale)\b/i)[0].trim().replace(/\s+/g, ' ');
      if (val) {
        optionsMap[letter] = val;
      }
      const mIdx = content.indexOf(m[0]);
      if (mIdx !== -1 && mIdx < firstOptIdx) {
        firstOptIdx = mIdx;
      }
    });

    let questionStatement = content.slice(0, firstOptIdx).trim().replace(/\s+/g, ' ');
    questionStatement = questionStatement.replace(/^(?:Topic|Part)\s*\d*[:\s]*[^\n]+/gi, '').trim();

    const optionsList: string[] = [];
    ['A', 'B', 'C', 'D'].forEach((l) => {
      if (optionsMap[l]) optionsList.push(optionsMap[l]);
    });

    if (!questionStatement || optionsList.length < 2) return;

    let correctIdx = 0;
    if (inlineCorrectIdx !== undefined && inlineCorrectIdx >= 0 && inlineCorrectIdx <= 3) {
      correctIdx = inlineCorrectIdx;
    } else if (globalAnswerKeyMap[qNum] !== undefined) {
      correctIdx = globalAnswerKeyMap[qNum];
    }

    const explanation = inlineExplanation || globalExplanationMap[qNum] || `Solution for Question ${qNum}`;

    questions.push({
      id: `q-pdf-${qNum}-${Date.now()}-${questions.length}`,
      subject: currentSubjectName || defaultSubject,
      category: currentTopic,
      questionText: questionStatement,
      options: optionsList.length >= 4 ? optionsList.slice(0, 4) : [...optionsList, ...Array(4 - optionsList.length).fill('-')],
      correctOptionIndex: correctIdx,
      explanation: explanation,
      difficulty: 'Medium',
    });
  }

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Ignore horizontal line separators (e.g. ________________________________________)
    if (/^[_=\-]{3,}$/.test(trimmed)) {
      processCurrentBlock();
      return;
    }

    // Check if line is a Top-Level Main Subject Header (e.g. 📚 TOPIC 1: CENTRAL NERVOUS SYSTEM (CNS) - 72 Questions)
    const mainSubjectMatch = trimmed.match(/^(?:📚\s*)?TOPIC\s*\d*[:\s-]+([^\n\-]+?)(?:\s*-\s*\d+\s*Questions)?$/i);
    if (mainSubjectMatch && mainSubjectMatch[1].trim()) {
      processCurrentBlock();
      currentSubjectName = mainSubjectMatch[1].trim();
      currentTopic = 'General Topic';
      return;
    }

    // Check if line is a Sub-Topic Header (e.g. Stroke & Cerebrovascular Diseases (Questions 1-20))
    const subTopicMatch = trimmed.match(/^([A-Za-z0-9\s&,/\-\'\"]+?)\s*\(Questions?\s*\d+[-–]\d+\)$/i);
    if (subTopicMatch && subTopicMatch[1].trim()) {
      processCurrentBlock();
      currentTopic = subTopicMatch[1].trim();
      return;
    }

    // Check if line is a valid Part / Topic / Section header (e.g. Part 1: Medicine, Topic 2: Surgery, Section A: Ped)
    const partMatch = trimmed.match(/^(?:Topic|Part|Section)\s*(\d+|[A-Z])?[:\-\s]+([^\n\(]+)/i);
    if (partMatch && partMatch[2].trim()) {
      const potentialTopic = partMatch[2].trim().replace(/\(Q\d+.*?\)/gi, '').trim();
      // Valid topic header must be short (< 60 chars) and not look like a full sentence with ending period
      if (potentialTopic.length > 0 && potentialTopic.length < 60 && !potentialTopic.endsWith('.')) {
        processCurrentBlock();
        currentTopic = potentialTopic;
        return;
      }
    }

    // Check if line starts a new Question (e.g. Q1. Q2. 1. 50.)
    const isNewQuestion = /^(?:Q|q)?\d+[\.\):]\s+/i.test(trimmed);
    if (isNewQuestion) {
      processCurrentBlock();
    }

    currentBlock.push(line);
  });

  processCurrentBlock();

  return questions;
}

/**
 * Load PDF.js dynamically with multiple CDN fallbacks
 */
async function ensurePdfJsLoaded(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if ((window as any).pdfjsLib) return true;

  const loadPromise = (async () => {
    const cdns = [
      {
        main: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
        worker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
      },
      {
        main: 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js',
        worker: 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
      },
      {
        main: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
        worker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
      },
    ];

    for (const cdn of cdns) {
      try {
        const loaded = await new Promise<boolean>((resolve) => {
          const script = document.createElement('script');
          script.src = cdn.main;
          script.onload = () => {
            try {
              if ((window as any).pdfjsLib) {
                (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = cdn.worker;
              }
              resolve(true);
            } catch (e) {
              resolve(true);
            }
          };
          script.onerror = () => resolve(false);
          document.head.appendChild(script);
        });

        if (loaded && (window as any).pdfjsLib) {
          return true;
        }
      } catch (e) {
        continue;
      }
    }
    return !!(window as any).pdfjsLib;
  })();

  const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3500));

  return Promise.race([loadPromise, timeoutPromise]);
}

/**
 * Extract text from PDF file ArrayBuffer directly using native binary parser if PDF.js is unavailable
 */
function parseNativePdfBinaryText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let asciiStr = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9) {
      asciiStr += String.fromCharCode(b);
    } else {
      asciiStr += ' ';
    }
  }

  // Find strings inside parentheses (text)
  const matches = asciiStr.match(/\(([^()]{2,})\)/g) || [];
  const textPieces = matches
    .map((m) => m.slice(1, -1).trim())
    .filter((s) => s.length > 1 && !/^(Font|Helv|Courier|Times|Type|Obj|R|Catalog|Pages|FontDescriptor)$/i.test(s));

  return textPieces.join(' ');
}

/**
 * Reads a PDF file and extracts all page text into a string
 */
export async function extractTextFromPdfFile(file: File): Promise<string> {
  if (typeof window === 'undefined' || !file) return '';

  const arrayBuffer = await file.arrayBuffer();

  // Engine 1: PDF.js with Worker & CMap Font Encoding Support
  try {
    const isLoaded = await ensurePdfJsLoaded();
    const pdfjsLib = (window as any).pdfjsLib;

    if (isLoaded && pdfjsLib) {
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true,
      });
      const pdf = await loadingTask.promise;

      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str || '')
            .join('\n');
          fullText += `\n--- Page ${i} ---\n` + pageText;
        } catch (pageErr) {
          console.warn(`Page ${i} extraction warning, continuing to next page`, pageErr);
        }
      }

      if (fullText.trim().length > 30) {
        return fullText;
      }
    }
  } catch (err) {
    console.warn('PDF.js primary extraction failed, trying fallback workerless mode', err);
  }

  // Engine 2: PDF.js without worker (fallback)
  try {
    const pdfjsLib = (window as any).pdfjsLib;
    if (pdfjsLib) {
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        disableWorker: true,
      });
      const pdf = await loadingTask.promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str || '')
            .join('\n');
          fullText += `\n--- Page ${i} ---\n` + pageText;
        } catch (e) {}
      }
      if (fullText.trim().length > 30) {
        return fullText;
      }
    }
  } catch (err2) {}

  // Engine 3: Native PDF binary stream extractor
  try {
    const extractedNativeText = parseNativePdfBinaryText(arrayBuffer);
    if (extractedNativeText.trim().length > 30) {
      return extractedNativeText;
    }
  } catch (nativeErr) {
    console.warn('Native binary extraction failed', nativeErr);
  }

  // Engine 4: FileReader fallback
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || '');
    reader.onerror = () => resolve('');
    reader.readAsText(file);
  });
}

const CLOUD_COLLECTION_NAME = 'practice_questions';

/**
 * Fetch all questions stored in Firebase Firestore Cloud Database
 */
export async function fetchQuestionsFromCloud(): Promise<Question[]> {
  if (typeof window === 'undefined') return [];
  try {
    const querySnapshot = await getDocs(collection(firestoreDB, CLOUD_COLLECTION_NAME));
    const cloudQuestions: Question[] = [];
    querySnapshot.forEach((docSnap) => {
      if (docSnap.exists()) {
        cloudQuestions.push(docSnap.data() as Question);
      }
    });
    if (cloudQuestions.length > 0) {
      saveStoredQuestions(cloudQuestions);
    }
    return cloudQuestions;
  } catch (err) {
    console.error('Failed to fetch practice questions from Firestore cloud', err);
    return getStoredQuestions();
  }
}

/**
 * Real-time listener for Cloud Questions update (Cross-Device Sync)
 */
export function subscribeToCloudQuestions(callback: (questions: Question[]) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  try {
    const unsubscribe = onSnapshot(
      collection(firestoreDB, CLOUD_COLLECTION_NAME),
      (snapshot) => {
        const cloudQuestions: Question[] = [];
        snapshot.forEach((docSnap) => {
          if (docSnap.exists()) {
            cloudQuestions.push(docSnap.data() as Question);
          }
        });
        if (cloudQuestions.length > 0) {
          saveStoredQuestions(cloudQuestions);
        }
        callback(cloudQuestions);
      },
      (err) => {
        console.warn('Realtime cloud practice listener warning', err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.error('Error setting up cloud listener', err);
    return () => {};
  }
}

/**
 * Sync array of questions to Firebase Firestore Cloud
 */
export async function syncQuestionsToCloud(questions: Question[]): Promise<void> {
  saveStoredQuestions(questions);
  if (typeof window === 'undefined' || questions.length === 0) return;

  try {
    // Process in batches of 400 (Firestore batch limit is 500)
    const batches = [];
    for (let i = 0; i < questions.length; i += 400) {
      const batch = writeBatch(firestoreDB);
      const chunk = questions.slice(i, i + 400);
      chunk.forEach((q) => {
        const ref = doc(firestoreDB, CLOUD_COLLECTION_NAME, q.id);
        batch.set(ref, q, { merge: true });
      });
      batches.push(batch.commit());
    }
    await Promise.all(batches);
  } catch (err) {
    console.error('Failed to sync practice questions to Firestore cloud', err);
  }
}

/**
 * Delete a single question from Cloud
 */
export async function deleteQuestionFromCloud(questionId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await deleteDoc(doc(firestoreDB, CLOUD_COLLECTION_NAME, questionId));
  } catch (err) {
    console.error('Failed to delete question from cloud', err);
  }
}

/**
 * Clear all questions from Cloud
 */
export async function clearAllCloudQuestions(): Promise<void> {
  clearAllQuestionsStorage();
  if (typeof window === 'undefined') return;
  try {
    const querySnapshot = await getDocs(collection(firestoreDB, CLOUD_COLLECTION_NAME));
    const batch = writeBatch(firestoreDB);
    querySnapshot.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
  } catch (err) {
    console.error('Failed to clear cloud questions', err);
  }
}
