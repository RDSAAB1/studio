"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Award,
  Sparkles,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Brain,
  Lightbulb,
  Check,
  Flame,
  Filter,
  Eye,
  RefreshCw,
  Home,
  Share2,
  Trophy,
  ArrowRight,
  Bookmark,
  FileText,
  Upload,
  Camera,
  Image as ImageIcon,
  Zap,
  Target,
  GraduationCap,
  Layers,
  Search,
  Cloud,
  Presentation,
  Palette,
  LayoutGrid,
  Pencil,
} from 'lucide-react';
import {
  Question,
  QuestionProgress,
  DEFAULT_SUBJECTS,
  getStoredQuestions,
  saveStoredQuestions,
  getStoredProgress,
  saveStoredProgress,
  recordQuestionAnswer,
  resetAllProgress,
  resetQuestionMastery,
  parseBulkQuestions,
  clearAllQuestionsStorage,
  extractTextFromPdfFile,
  subscribeToCloudQuestions,
  syncQuestionsToCloud,
  deleteQuestionFromCloud,
  clearAllCloudQuestions,
} from '@/lib/practice-types';
import { confirm } from '@/lib/confirm-dialog';

async function ensurePptxGenJsLoaded(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if ((window as any).PptxGenJS) return true;

  return new Promise<boolean>((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
    script.onload = () => {
      resolve(!!(window as any).PptxGenJS);
    };
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

interface SavedPresentation {
  id: string;
  title: string;
  category: string;
  topicText: string;
  slides: Array<{ title: string; bulletPoints: string[] }>;
  theme: 'dark' | 'light' | 'purple' | 'emerald';
  createdAt: string;
}

interface CustomSelectPopoverOption<T> {
  value: T;
  label: string;
  desc?: string;
  icon?: React.ReactNode;
}

interface CustomSelectPopoverProps<T> {
  value: T;
  onChange: (value: T) => void;
  options: Array<CustomSelectPopoverOption<T>>;
  placeholder?: string;
  className?: string;
}

function CustomSelectPopover<T extends string | number>({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className = ''
}: CustomSelectPopoverProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full border rounded-xl h-9 px-3 flex items-center justify-between text-xs font-black transition-all duration-200 text-left shadow-xs outline-none ${
          isOpen
            ? 'bg-white border-purple-500 ring-4 ring-purple-100/60'
            : 'bg-white border-slate-200 text-slate-800 hover:border-purple-300 hover:shadow-xs'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOption?.icon && <div className="text-purple-500 shrink-0">{selectedOption.icon}</div>}
          <span className={selectedOption ? 'text-slate-900 font-extrabold' : 'text-slate-400 font-bold'}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 ml-1 transition-transform duration-200 ${isOpen ? 'rotate-180 text-purple-500' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 rounded-xl shadow-xl border bg-white border-slate-100 py-1 z-[120] max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1.5 duration-150">
          {options.map((opt) => {
            const isSelected = value === opt.value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-all flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'text-purple-950 bg-purple-50/50 font-black'
                    : 'text-slate-700 hover:bg-slate-50/80 hover:text-slate-950'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  {opt.icon && <div className={`shrink-0 ${isSelected ? 'text-purple-600' : 'text-slate-400'}`}>{opt.icon}</div>}
                  <div className="flex flex-col gap-0.5 truncate">
                    <span className="truncate">{opt.label}</span>
                    {opt.desc && <span className="text-[9px] opacity-60 font-semibold">{opt.desc}</span>}
                  </div>
                </div>
                {isSelected && (
                  <div className="w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function StudentPracticePage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [progress, setProgress] = useState<Record<string, QuestionProgress>>({});
  const [selectedSubject, setSelectedSubject] = useState<string>('All Subjects');
  const [selectedTopic, setSelectedTopic] = useState<string>('All Topics');
  const [viewMode, setViewMode] = useState<'unmastered' | 'focus' | 'all' | 'mastered' | 'presentations'>('unmastered');
  
  // Saved Presentations
  const [savedPresentations, setSavedPresentations] = useState<SavedPresentation[]>([]);
  
  // Test State
  const [isTestActive, setIsTestActive] = useState<boolean>(false);
  const [activeQueue, setActiveQueue] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [showExplanationMap, setShowExplanationMap] = useState<Record<string, boolean>>({});

  // Add Question Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newQuestionText, setNewQuestionText] = useState<string>('');
  const [newSubject, setNewSubject] = useState<string>('Mathematics');
  const [newCategory, setNewCategory] = useState<string>('General');
  const [newOptions, setNewOptions] = useState<string[]>(['', '', '', '']);
  const [newCorrectIndex, setNewCorrectIndex] = useState<number>(0);
  const [newExplanation, setNewExplanation] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Bulk PDF Import Modal State
  const pdfFileInputRef = useRef<HTMLInputElement>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState<boolean>(false);
  const [bulkRawText, setBulkRawText] = useState<string>('');
  const [bulkSubject, setBulkSubject] = useState<string>('Medical & Science');
  const [isCustomSubject, setIsCustomSubject] = useState<boolean>(false);
  const [customSubject, setCustomSubject] = useState<string>('');
  const [isPdfExtracting, setIsPdfExtracting] = useState<boolean>(false);

  // AI MCQ Generator Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [aiActiveTab, setAiActiveTab] = useState<'mcq' | 'ppt'>('mcq');
  const [aiTopicText, setAiTopicText] = useState<string>('');
  const [aiSubject, setAiSubject] = useState<string>('Medical & Science');
  const [aiCategory, setAiCategory] = useState<string>('General Topic');
  const [aiCount, setAiCount] = useState<number>(5);
  const [aiDifficulty, setAiDifficulty] = useState<'Easy' | 'Medium' | 'Hard' | 'Mixed'>('Mixed');
  const [aiQuestionType, setAiQuestionType] = useState<'factual' | 'scenario' | 'very_short' | 'short' | 'long' | 'mixed'>('factual');
  const [aiMixedCounts, setAiMixedCounts] = useState<{ mcq: number; scenario: number; vsa: number; sa: number; la: number }>({ mcq: 2, scenario: 2, vsa: 2, sa: 1, la: 1 });
  const [aiLanguage, setAiLanguage] = useState<'english' | 'hindi' | 'hinglish'>('english');
  const [aiApiKey, setAiApiKey] = useState<string>('');
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const [aiGeneratedQuestions, setAiGeneratedQuestions] = useState<any[]>([]);
  // Edit question state
  const [editingQuestion, setEditingQuestion] = useState<any | null>(null);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [evaluatingQuestionId, setEvaluatingQuestionId] = useState<string | null>(null);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

  // PPT / Slides States
  const [aiSlidesCount, setAiSlidesCount] = useState<number>(5);
  const [aiSlides, setAiSlides] = useState<Array<{ title: string; bulletPoints: string[] }>>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [aiSlidesTheme, setAiSlidesTheme] = useState<'dark' | 'light' | 'purple' | 'emerald'>('light');
  const [isPptFullScreen, setIsPptFullScreen] = useState<boolean>(false);
  const [activePresentationId, setActivePresentationId] = useState<string | null>(null);
  const [isPptThemeDropdownOpen, setIsPptThemeDropdownOpen] = useState<boolean>(false);
  const [isPptLayoutDropdownOpen, setIsPptLayoutDropdownOpen] = useState<boolean>(false);
  
  // Image Upload & Vision OCR states
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [isImageExtracting, setIsImageExtracting] = useState<boolean>(false);
  
  // Rate Limit Graceful Cooldown states
  const [rateLimitCooldown, setRateLimitCooldown] = useState<number>(0);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);

  useEffect(() => {
    if (rateLimitCooldown <= 0) {
      setRateLimitError(null);
      return;
    }
    const timer = setTimeout(() => {
      setRateLimitCooldown(prev => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [rateLimitCooldown]);

  const handlePdfFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsPdfExtracting(true);
    try {
      const text = await extractTextFromPdfFile(file);
      if (text && text.trim().length > 0) {
        setBulkRawText(text);
      } else {
        alert('PDF file se text read nahi ho paya. Kripya PDF me se text select-copy karke yaha paste box me paste kar dein.');
      }
    } catch (err) {
      console.error('Failed to extract text from PDF file', err);
      alert('PDF file read karne me issue aaya. Kripya PDF ka text copy-paste karke try karein.');
    } finally {
      setIsPdfExtracting(false);
      e.target.value = '';
    }
  };

  const handleImageSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      setSelectedImageBase64(base64data);
    };
    reader.readAsDataURL(file);
  };

  const extractTextFromImage = async () => {
    if (!selectedImageBase64) {
      alert("Please select or capture an image first.");
      return;
    }
    if (!aiApiKey.trim()) {
      alert("Please configure your Gemini API Key first by clicking 'Set API Key' button.");
      return;
    }

    setIsImageExtracting(true);
    try {
      const base64Raw = selectedImageBase64.split(',')[1];
      const mimeType = selectedImageBase64.split(';')[0].split(':')[1] || 'image/jpeg';

      const promptText = `
You are a precise medical and educational document specialist. Convert all data inside this image into structured study text:
1. **Title**: Give the topic a clear, concise header title at the top.
2. **Textbook Content**: Transcribe all printed English textbook paragraphs exactly as written, maintaining headings.
3. **Diagram & Label Breakdown**: List all labels from any diagrams/flowcharts, and write a detailed, clear scientific explanation for each label (e.g., explain the anatomical location, function, or relation of labeled parts like the tympanic cavity, walls, nerves, and vessels).
4. **Handwritten Notes & Annotations**: Identify all handwritten annotations/notes, transcribe them, and write a thorough explanation detailing how they connect to the printed material (for example, if a note says "To Ant 2/3 of tongue" near "chorda tympani", explain that the chorda tympani nerve is a branch of the facial nerve (CN VII) that transmits taste signals from the anterior two-thirds of the tongue).
5. **Acronyms / Abbreviations**: Expand any short annotations (like M.E -> Middle Ear Cleft, E.T -> Eustachian Tube, M.A -> Mastoid Antrum) and provide their medical context.

Format the output cleanly in markdown with headers:
# STUDY TOPIC: [Title]
## 1. TEXTBOOK PARAGRAPHS
## 2. DETAILED DIAGRAM & LABEL EXPLANATIONS
## 3. HANDWRITTEN NOTES & ANNOTATION ANALYSIS

Output only the clean, complete extracted and expanded text. Do not add any extra conversational text or greeting.
`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash-lite:generateContent?key=${aiApiKey.trim()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: promptText
                },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Raw
                  }
                }
              ]
            }
          ]
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errMsg = errorData.error?.message || `HTTP error ${response.status}`;
        if (response.status === 429 || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('rate limit')) {
          setRateLimitCooldown(20);
          setRateLimitError("Rate limit reached. Please wait for the countdown before retrying.");
          return;
        }
        throw new Error(errMsg);
      }

      const data = await response.json();
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      if (textResponse.trim().length > 0) {
        setAiTopicText(prev => prev ? `${prev}\n\n${textResponse}` : textResponse);
        setSelectedImageBase64(null); // Clear preview after successful extraction
        setRateLimitError(null);
      } else {
        alert("Could not extract any text from the image. Please try again with a clearer picture.");
      }
    } catch (err: any) {
      console.error(err);
      if (err.message?.toLowerCase().includes('quota') || err.message?.toLowerCase().includes('rate limit')) {
        setRateLimitCooldown(20);
        setRateLimitError("Rate limit reached. Please wait for the countdown before retrying.");
      } else {
        alert(`Image text extraction failed: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setIsImageExtracting(false);
    }
  };

  const [bulkImportSuccessMsg, setBulkImportSuccessMsg] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modern Floating Topic Dropdown Popover State & Ref
  const topicDropdownRef = useRef<HTMLDivElement>(null);
  const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (topicDropdownRef.current && !topicDropdownRef.current.contains(event.target as Node)) {
        setIsTopicDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const pptThemeRef = useRef<HTMLDivElement>(null);
  const pptLayoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (pptThemeRef.current && !pptThemeRef.current.contains(event.target as Node)) {
        setIsPptThemeDropdownOpen(false);
      }
      if (pptLayoutRef.current && !pptLayoutRef.current.contains(event.target as Node)) {
        setIsPptLayoutDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const activeSubject = isCustomSubject && customSubject.trim() ? customSubject.trim() : bulkSubject;

  // Live parsed questions preview
  const parsedPreviewQuestions = useMemo(() => {
    return parseBulkQuestions(bulkRawText, activeSubject);
  }, [bulkRawText, activeSubject]);

  const handleExecuteBulkImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedPreviewQuestions.length === 0) return;

    const updated = [...questions, ...parsedPreviewQuestions];
    handleSaveQuestions(updated);

    setBulkImportSuccessMsg(`Successfully imported ${parsedPreviewQuestions.length} questions!`);
    setTimeout(() => {
      setIsBulkModalOpen(false);
      setBulkImportSuccessMsg('');
      setBulkRawText('');
      setCustomSubject('');
      setIsCustomSubject(false);
    }, 1500);
  };

  // Load initial data & Subscribe to Cloud Questions (Cross-Device Sync)
  useEffect(() => {
    const qList = getStoredQuestions();
    const pList = getStoredProgress();
    setQuestions(qList);
    setProgress(pList);

    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('jrmd_gemini_api_key') || '';
      setAiApiKey(savedKey);

      const savedPres = localStorage.getItem('jrmd_saved_presentations');
      if (savedPres) {
        try {
          setSavedPresentations(JSON.parse(savedPres));
        } catch (e) {
          console.error(e);
        }
      }
    }

    // Subscribe to Firestore Cloud updates in real-time
    const unsubscribe = subscribeToCloudQuestions((cloudQuestions) => {
      if (cloudQuestions && cloudQuestions.length > 0) {
        setQuestions(cloudQuestions);
      }
    });

    return () => unsubscribe();
  }, []);

  // Keyboard navigation for Fullscreen PPT presenter
  useEffect(() => {
    if (!isPptFullScreen || aiSlides.length === 0) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        setCurrentSlideIndex(prev => Math.min(prev + 1, aiSlides.length - 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentSlideIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Escape') {
        setIsPptFullScreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPptFullScreen, aiSlides.length]);

  const handleGenerateAiMcqs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiTopicText.trim()) {
      alert("Please paste the topic text first.");
      return;
    }
    if (!aiApiKey.trim()) {
      alert("Please enter your Gemini API Key.");
      return;
    }

    setIsAiGenerating(true);
    setAiGeneratedQuestions([]);
    localStorage.setItem('jrmd_gemini_api_key', aiApiKey.trim());

    const langInstruction = aiLanguage === 'hindi'
      ? `IMPORTANT LANGUAGE RULE: Write ALL questions, options, and explanations ENTIRELY in Hindi using Devanagari script. Do NOT use any English words anywhere. Write naturally as a Hindi teacher would explain to students.`
      : aiLanguage === 'hinglish'
      ? `IMPORTANT LANGUAGE RULE — HINGLISH MODE (Read carefully):
Write everything in a natural Hinglish style — exactly how Indian medical/science students talk and think. Follow these rules strictly:

1. QUESTION TEXT: Write in a mix — use Hindi for the sentence structure and grammar (subject, verb, connecting words), but keep technical/medical/scientific terms in English. Example: "Tympanic membrane ka primary function kya hota hai?" or "Cardiac cycle mein kitne phases hote hain?"

2. OPTIONS (A/B/C/D): Each option should also be in Hinglish. Keep the key term in English, describe it in Hindi. Example: "Sound waves ko amplify karna", "Blood pressure regulate karna"

3. EXPLANATION / ANSWER: Write a clear, conversational Hinglish explanation as if explaining to a friend. Start with the answer reason in simple Hindi, then use English terms where needed.

4. EASY TO UNDERSTAND: Avoid complex Hindi words. Use everyday spoken Hindi words like: kya, hai, hota, karti, aisa, yahan, woh, uska, jab, toh, kyunki, isliye.

5. NEVER write full English sentences. Always mix. Every sentence must have at least 40% Hindi words by count.

Goal: A student reading this should feel like they are reading their own notes — familiar, easy to remember, and naturally understandable.`
      : `Write all questions, options, and explanations in English.`;

    // Helper: generate N questions of a specific type via API
    const generateQuestionsOfType = async (type: string, count: number): Promise<any[]> => {
      if (count <= 0) return [];

      const isMcq = type === 'factual' || type === 'scenario';
      const typePrompt = type === 'scenario'
        ? `Generate clinical case/scenario-based MCQs with 4 options each. Start each question with a descriptive case scenario.`
        : type === 'very_short'
        ? `Generate VERY SHORT ANSWER questions (no options). Each answer must be 1 sentence or a single key term/value. Use "answer" field instead of options.`
        : type === 'short'
        ? `Generate SHORT ANSWER questions (no options). Each answer must be 2-4 sentences — a concise but complete explanation. Use "answer" field instead of options.`
        : type === 'long'
        ? `Generate LONG ANSWER / ESSAY questions (no options). Each answer must be a detailed 6-10 sentence response covering definition, mechanism, clinical relevance, examples. Use "answer" field instead of options.`
        : `Generate standard factual MCQs with 4 options. Use direct concept-based questions covering definitions, mechanisms, and key facts.`;

      const sysInstr = `
You are a precise question generator and expert educator. Output a JSON array of exactly ${count} questions from the provided text.
Difficulty: ${aiDifficulty === 'Mixed' ? 'mixed' : aiDifficulty}. Subject: ${aiSubject}. Topic: ${aiCategory}.
${typePrompt}
${langInstruction}

${isMcq ? `JSON schema for each MCQ item:
- "questionText": string
- "options": exactly 4 strings (A, B, C, D)
- "correctOptionIndex": number (0-3)
- "explanation": string — DETAILED: WHY correct is right, WHY wrong options are wrong, memory tip. Min 3-4 sentences.
- "difficulty": "Easy" | "Medium" | "Hard"` : `JSON schema for each answer-type question:
- "questionText": string
- "answer": string — COMPLETE and DETAILED per type.
- "options": [] (empty array)
- "correctOptionIndex": 0
- "difficulty": "Easy" | "Medium" | "Hard"`}

Output only the JSON array. No markdown, no extra text.
`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash-lite:generateContent?key=${aiApiKey.trim()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Topic Text:\n${aiTopicText}` }] }],
          systemInstruction: { parts: [{ text: sysInstr }] },
          generationConfig: { responseMimeType: "application/json", temperature: 0.15 }
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error?.message || `HTTP error ${res.status}`;
        if (res.status === 429 || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('rate limit')) {
          setRateLimitCooldown(20);
          setRateLimitError("Rate limit reached. Please wait for the countdown before retrying.");
          return [];
        }
        throw new Error(errMsg);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      let clean = text.trim();

      // Extract JSON array between first [ and last ]
      const firstBracket = clean.indexOf('[');
      const lastBracket = clean.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        clean = clean.substring(firstBracket, lastBracket + 1);
      }

      // Remove single-line comments and trailing commas that break native JSON.parse
      clean = clean
        .replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1') // remove comments
        .replace(/,\s*([\]}])/g, '$1'); // remove trailing commas

      let parsed;
      try {
        parsed = JSON.parse(clean);
      } catch (parseErr: any) {
        console.error("Failed to parse cleaned JSON:", clean);
        throw new Error("AI response format was invalid. Please try again in a few seconds.");
      }
      if (!Array.isArray(parsed)) throw new Error("Invalid JSON array from API");

      return parsed.map((q: any, idx: number) => ({
        id: `q-ai-${type}-${Date.now()}-${idx}`,
        subject: aiSubject,
        category: aiCategory || 'General Topic',
        questionText: q.questionText || '',
        options: Array.isArray(q.options) && q.options.length >= 4 ? q.options.slice(0, 4) : (q.options || []),
        correctOptionIndex: typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : 0,
        explanation: q.explanation || '',
        answer: q.answer || '',
        questionType: type,
        difficulty: q.difficulty || 'Medium',
      }));
    };

    try {
      if (aiQuestionType === 'mixed') {
        // Mixed mode: parallel calls for each type that has count > 0
        const tasks: Array<{ type: string; count: number }> = [
          { type: 'factual', count: aiMixedCounts.mcq },
          { type: 'scenario', count: aiMixedCounts.scenario },
          { type: 'very_short', count: aiMixedCounts.vsa },
          { type: 'short', count: aiMixedCounts.sa },
          { type: 'long', count: aiMixedCounts.la },
        ].filter(t => t.count > 0);

        if (tasks.length === 0) {
          alert("Please set at least one question count above 0.");
          return;
        }

        // Sequential calls (to avoid rate limits)
        const allQuestions: any[] = [];
        for (const task of tasks) {
          const qs = await generateQuestionsOfType(task.type, task.count);
          allQuestions.push(...qs);
        }

        setAiGeneratedQuestions(allQuestions);
        setRateLimitError(null);
      } else {
        // Single type mode
        const questions = await generateQuestionsOfType(aiQuestionType, aiCount);
        setAiGeneratedQuestions(questions);
        setRateLimitError(null);
      }
    } catch (err: any) {
      console.error(err);
      if (err.message?.toLowerCase().includes('quota') || err.message?.toLowerCase().includes('rate limit')) {
        setRateLimitCooldown(20);
        setRateLimitError("Rate limit reached. Please wait for the countdown before retrying.");
      } else {
        alert(`Question Generation failed: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleGenerateAiSlides = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiTopicText.trim()) {
      alert("Please paste the topic text first.");
      return;
    }
    if (!aiApiKey.trim()) {
      alert("Please enter your Gemini API Key.");
      return;
    }

    setIsAiGenerating(true);
    setAiSlides([]);
    setCurrentSlideIndex(0);
    setActivePresentationId(null);

    // Save key to localstorage
    localStorage.setItem('jrmd_gemini_api_key', aiApiKey.trim());

    try {
      const slideLangInstruction = aiLanguage === 'hindi'
        ? `IMPORTANT LANGUAGE RULE: Write ALL slide titles and bullet points ENTIRELY in Hindi (Devanagari script). Do NOT use any English word. Write as a Hindi teacher would explain topics to students.`
        : aiLanguage === 'hinglish'
        ? `IMPORTANT LANGUAGE RULE — HINGLISH MODE for Slides (Read carefully):
Write slide content in natural Hinglish — exactly how Indian students write their own study notes. Follow these rules:

1. SLIDE TITLES: Write titles in Hinglish. Keep the topic name in English but make it conversational. Example: "Middle Ear ka Structure", "Blood Circulation kaise hoti hai?", "Nerve Supply — Key Points"

2. BULLET POINTS: Each bullet must be a short, clear Hinglish sentence (max 12 words). Use English for technical terms, Hindi for grammar and connectors.
   Good example: "Tympanic membrane sound ko vibrate karke ossicles tak transfer karti hai"
   Bad example (too English): "The tympanic membrane vibrates to transfer sound to the ossicles"
   Bad example (too Hindi): "कर्णपटह झिल्ली ध्वनि को आस्थि-शृंखला तक स्थानांतरित करती है"

3. CLARITY FIRST: Each bullet point should feel like a friend explaining a concept. Prefer short, punchy Hinglish over long sentences. Students should be able to read and immediately understand.

4. EVERYDAY HINDI WORDS only: Use simple spoken Hindi — kya, hai, hota, karti, woh, uska, jab, toh, kyunki, isliye, yahan, aisa, matlab, seedha. Avoid complex Sanskrit Hindi.

5. NEVER write a full-English sentence in any bullet. Always mix. If a bullet has more than 3 consecutive English words, add a Hindi word between them.

Goal: Slides should feel like the student's own revision notes — easy to read aloud, easy to remember, and naturally understood at a glance.`
        : `Write all slide titles and bullet points in English.`;

      const systemInstruction = `
You are a professional Presentation Slide Creator. Generate exactly ${aiSlidesCount} slides from the provided topic text.
JSON structure per slide:
1. "title": string
2. "bulletPoints": array of 3 to 5 concise strings
3. "layoutType": string. Choose one of:
   - "timeline": steps, process flow, chronological order.
   - "grid": independent concepts, quadrants.
   - "objectives": targets, summary statements.
   - "split": comparison, 2 sections.
   - "hub": core concept with spokes.
   - "columns": vertical blocks.
   - "cycle": circular feedback loops.
   - "workflow": step progression from left anchor.
   - "target": layers, rings.
   - "standard": default bullet lists.
${slideLangInstruction}
Ensure sequential topic flow (Intro, Concepts, Process, Risks, Summary).
Output only valid JSON array. Do not include markdown formatting or extra text.
`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash-lite:generateContent?key=${aiApiKey.trim()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `Topic Text:\n${aiTopicText}` }],
            },
          ],
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.15,
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errMsg = errorData.error?.message || `HTTP error ${response.status}`;
        if (response.status === 429 || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('rate limit')) {
          setRateLimitCooldown(20);
          setRateLimitError("Rate limit reached. Please wait for the countdown before retrying.");
          return;
        }
        throw new Error(errMsg);
      }

      const data = await response.json();
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      let cleanJsonText = textResponse.trim();
      if (cleanJsonText.startsWith('```')) {
        cleanJsonText = cleanJsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      }

      // Remove Javascript comments and trailing commas that break standard JSON.parse
      cleanJsonText = cleanJsonText
        .replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1') // Strip comments
        .replace(/,\s*([\]}])/g, '$1'); // Strip trailing commas

      const parsed = JSON.parse(cleanJsonText);
      if (Array.isArray(parsed)) {
        setAiSlides(parsed);
        setRateLimitError(null);
      } else {
        throw new Error("Response is not a valid JSON array of slides.");
      }
    } catch (err: any) {
      console.error(err);
      if (err.message?.toLowerCase().includes('quota') || err.message?.toLowerCase().includes('rate limit')) {
        setRateLimitCooldown(20);
        setRateLimitError("Rate limit reached. Please wait for the countdown before retrying.");
      } else {
        alert(`Slides Generation failed: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleCopySlidesContent = () => {
    if (aiSlides.length === 0) return;
    const formatted = aiSlides.map((slide, sIdx) => {
      return `Slide ${sIdx + 1}: ${slide.title}\n` + slide.bulletPoints.map(bp => `- ${bp}`).join('\n');
    }).join('\n\n');
    
    navigator.clipboard.writeText(formatted);
    alert("Presentation content copied to clipboard! You can paste it into PowerPoint or Google Slides.");
  };

  const handleDownloadPptx = async () => {
    if (aiSlides.length === 0) return;
    
    const loaded = await ensurePptxGenJsLoaded();
    if (!loaded || !(window as any).PptxGenJS) {
      alert("Failed to load PowerPoint generation library. Please check your internet connection.");
      return;
    }

    try {
      const PptxGenJS = (window as any).PptxGenJS;
      const pptx = new PptxGenJS();

      // Configure slide size (16:9 widescreen)
      pptx.layout = 'LAYOUT_16x9';

      aiSlides.forEach((slideData, idx) => {
        const slide = pptx.addSlide();

        // Background color based on theme
        let bgColor = 'FFFFFF';
        let textColor = '1E293B';
        let accentColor = '7C3AED';

        if (aiSlidesTheme === 'dark') {
          bgColor = '0F172A';
          textColor = 'F8FAFC';
          accentColor = 'A78BFA';
        } else if (aiSlidesTheme === 'purple') {
          bgColor = '3B0764';
          textColor = 'F5F3FF';
          accentColor = 'F472B6';
        } else if (aiSlidesTheme === 'emerald') {
          bgColor = '022C22';
          textColor = 'F0FDF4';
          accentColor = '34D399';
        }

        slide.background = { fill: bgColor };

        // Add Slide Title
        slide.addText(slideData.title, {
          x: 0.8,
          y: 0.6,
          w: 8.5,
          h: 0.8,
          fontSize: 28,
          bold: true,
          color: textColor,
          fontFace: 'Arial'
        });

        // Add Slide Number
        slide.addText(`Slide ${idx + 1} of ${aiSlides.length}`, {
          x: 8.5,
          y: 0.3,
          w: 1.5,
          h: 0.3,
          fontSize: 10,
          color: accentColor,
          align: 'right',
          fontFace: 'Arial'
        });

        // Add Bullet Points
        const bullets = slideData.bulletPoints.map(bp => ({
          text: bp,
          options: { bullet: true, indentLevel: 0, margin: 4 }
        }));

        slide.addText(bullets, {
          x: 0.8,
          y: 1.8,
          w: 8.5,
          h: 3.5,
          fontSize: 16,
          color: textColor,
          fontFace: 'Arial',
          lineSpacing: 24
        });
      });

      const fileName = `${aiCategory.trim().replace(/[^a-zA-Z0-9]/g, '_') || 'Presentation'}.pptx`;
      pptx.writeFile({ fileName });
    } catch (err: any) {
      console.error(err);
      alert(`PowerPoint download failed: ${err.message || 'Unknown error'}`);
    }
  };

  const handleSavePresentation = () => {
    if (aiSlides.length === 0) return;
    
    if (activePresentationId) {
      const updated = savedPresentations.map(p => {
        if (p.id === activePresentationId) {
          return {
            ...p,
            slides: aiSlides,
            theme: aiSlidesTheme
          };
        }
        return p;
      });
      setSavedPresentations(updated);
      localStorage.setItem('jrmd_saved_presentations', JSON.stringify(updated));
      alert("Presentation updated successfully!");
    } else {
      const newPres: SavedPresentation = {
        id: `pres-${Date.now()}`,
        title: aiCategory.trim() || 'Presentation Slide Deck',
        category: aiCategory.trim() || 'General',
        topicText: aiTopicText,
        slides: aiSlides,
        theme: aiSlidesTheme,
        createdAt: new Date().toISOString()
      };

      const updated = [...savedPresentations, newPres];
      setSavedPresentations(updated);
      localStorage.setItem('jrmd_saved_presentations', JSON.stringify(updated));
      setActivePresentationId(newPres.id);
      alert("Presentation saved to 'My Slides' successfully!");
    }
  };

  const handleImportAiQuestions = () => {
    if (aiGeneratedQuestions.length === 0) return;
    const updated = [...questions, ...aiGeneratedQuestions];
    handleSaveQuestions(updated);
    syncQuestionsToCloud(updated);
    alert(`Successfully added ${aiGeneratedQuestions.length} AI-generated questions to the database!`);
    setIsAiModalOpen(false);
    setAiGeneratedQuestions([]);
    setAiTopicText('');
  };

  // Batch Reassign Subject Helper (Consolidate / Move Questions to a single Subject)
  const handleBatchReassignSubject = () => {
    if (filteredQuestions.length === 0) return;
    const target = prompt(
      `Reassign / Move ${filteredQuestions.length} displayed questions to Subject name (e.g. Medicine, Surgery):`
    );
    if (!target || !target.trim()) return;

    const cleanSubject = target.trim();
    const targetIds = new Set(filteredQuestions.map((q) => q.id));

    const updated = questions.map((q) => {
      if (targetIds.has(q.id)) {
        return { ...q, subject: cleanSubject };
      }
      return q;
    });

    handleSaveQuestions(updated);
    setSelectedSubject(cleanSubject);
    setSelectedTopic('All Topics');
    alert(`Successfully moved ${filteredQuestions.length} questions to Subject: "${cleanSubject}"!`);
  };

  // Sync back to storage & Cloud when questions update
  const handleSaveQuestions = (updated: Question[]) => {
    setQuestions(updated);
    saveStoredQuestions(updated);
    syncQuestionsToCloud(updated);
  };

  const handleSaveQuestionEdit = (updatedQ: any) => {
    if (updatedQ.id.startsWith('q-ai-')) {
      const updated = aiGeneratedQuestions.map((q) => (q.id === updatedQ.id ? updatedQ : q));
      setAiGeneratedQuestions(updated);
    } else {
      const updated = questions.map((q) => (q.id === updatedQ.id ? updatedQ : q));
      handleSaveQuestions(updated);
    }
    setEditingQuestion(null);
    setEditingQuestionIndex(null);
  };

  // Filtered Question lists
  const filteredQuestions = useMemo(() => {
    const normSubj = selectedSubject.trim().toLowerCase();
    const normTopic = selectedTopic.trim().toLowerCase();

    return questions.filter((q) => {
      if (normSubj !== 'all subjects') {
        const qSubj = (q.subject || '').trim().toLowerCase();
        if (qSubj !== normSubj) return false;
      }

      if (normTopic !== 'all topics') {
        const qTopic = (q.category || '').trim().toLowerCase();
        if (qTopic !== normTopic) return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesText = q.questionText.toLowerCase().includes(query);
        const matchesCategory = q.category?.toLowerCase().includes(query);
        if (!matchesText && !matchesCategory) return false;
      }

      const qProg = progress[q.id];
      const isMastered = qProg?.isMastered;

      if (viewMode === 'unmastered') {
        // Active Unmastered Questions
        return !isMastered;
      } else if (viewMode === 'focus') {
        // Focus List = Attempted & Incorrect questions (needs focus/revision)
        const wasWrong = qProg && qProg.attempts > 0 && !isMastered;
        return Boolean(wasWrong);
      } else if (viewMode === 'mastered') {
        // 100% Mastered Questions ONLY
        return Boolean(isMastered);
      }
      return true; // 'all'
    });
  }, [questions, progress, selectedSubject, selectedTopic, viewMode, searchQuery]);

  // General Statistics
  const stats = useMemo(() => {
    const total = questions.length;
    let masteredCount = 0;
    let attemptedCount = 0;
    let focusCount = 0;

    questions.forEach((q) => {
      const p = progress[q.id];
      if (p) {
        if (p.isMastered) {
          masteredCount++;
        }
        if (p.attempts > 0) {
          attemptedCount++;
          if (!p.isMastered) {
            focusCount++;
          }
        }
      }
    });

    const masteredPercentage = total > 0 ? Math.round((masteredCount / total) * 100) : 0;
    return {
      total,
      masteredCount,
      unmasteredCount: total - masteredCount,
      focusCount,
      attemptedCount,
      masteredPercentage,
    };
  }, [questions, progress]);

  // Dynamic Subjects list derived from actual questions (Merged Case-Insensitively)
  const availableSubjects = useMemo(() => {
    const subjectMap = new Map<string, string>(); // lowercase key -> canonical display name
    questions.forEach((q) => {
      if (q.subject && q.subject.trim()) {
        const clean = q.subject.trim();
        const key = clean.toLowerCase();
        if (!subjectMap.has(key)) {
          subjectMap.set(key, clean);
        }
      }
    });
    return ['All Subjects', ...Array.from(subjectMap.values())];
  }, [questions]);

  // Dynamic Topics list under selected subject (Merged Case-Insensitively)
  const availableTopics = useMemo(() => {
    const topicMap = new Map<string, string>();
    const normSelected = selectedSubject.trim().toLowerCase();

    const relevant = normSelected === 'all subjects'
      ? questions
      : questions.filter((q) => (q.subject || '').trim().toLowerCase() === normSelected);

    relevant.forEach((q) => {
      if (q.category && q.category.trim()) {
        const clean = q.category.trim();
        const key = clean.toLowerCase();
        if (!topicMap.has(key)) {
          topicMap.set(key, clean);
        }
      }
    });

    return ['All Topics', ...Array.from(topicMap.values())];
  }, [questions, selectedSubject]);

  // Start Practice Test
  const startPracticeTest = () => {
    if (filteredQuestions.length === 0) return;
    setActiveQueue(filteredQuestions);
    setCurrentIndex(0);
    setUserAnswers({});
    setIsSubmitted(false);
    setShowExplanationMap({});
    setIsTestActive(true);
  };

  const startPracticeTestWithSelected = () => {
    const selectedQuestions = questions.filter(q => selectedQuestionIds.includes(q.id));
    if (selectedQuestions.length === 0) return;
    setActiveQueue(selectedQuestions);
    setCurrentIndex(0);
    setUserAnswers({});
    setIsSubmitted(false);
    setShowExplanationMap({});
    setIsTestActive(true);
  };

  const toggleSelectQuestion = (qId: string) => {
    setSelectedQuestionIds(prev =>
      prev.includes(qId) ? prev.filter(id => id !== qId) : [...prev, qId]
    );
  };

  const startAiPracticeTest = () => {
    if (aiGeneratedQuestions.length === 0) return;
    setActiveQueue(aiGeneratedQuestions);
    setCurrentIndex(0);
    setUserAnswers({});
    setIsSubmitted(false);
    setShowExplanationMap({});
    setIsTestActive(true);
    setIsAiModalOpen(false);
  };

  const handleEvaluateAnswerWithAi = async (q: any) => {
    if (!aiApiKey.trim()) {
      alert("Please configure your Gemini API Key in the Generator Hub first.");
      return;
    }
    const studentAnswer = userAnswers[q.id];
    if (!studentAnswer || !studentAnswer.trim()) {
      alert("Pehle answer type karein tabhi AI evaluate kar payega!");
      return;
    }

    setEvaluatingQuestionId(q.id);
    try {
      const maxMarks = q.questionType === 'very_short' ? 2 : q.questionType === 'long' ? 10 : 5;

      const systemInstruction = `
You are an expert medical and educational examiner. Evaluate the student's written answer against the ideal model answer.
Difficulty level: ${q.difficulty || 'Medium'}. Subject: ${q.subject}.

Assign a score out of exactly ${maxMarks} marks based on accuracy, completeness, and clarity.
Output a JSON object with:
- "score": number (between 0 and ${maxMarks}, can be integer or 0.5 steps)
- "feedback": string (in the selected language: ${aiLanguage}. Be encouraging but precise. Tell them exactly what key points they got right, what they missed, and how to get full marks).

Output only the JSON object. No markdown formatting.
`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash-lite:generateContent?key=${aiApiKey.trim()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `Question: ${q.questionText}\nIdeal Model Answer: ${q.answer}\nStudent's Answer: ${studentAnswer}` }]
            }
          ],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      let clean = text.trim();
      if (clean.startsWith('```')) clean = clean.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

      const parsed = JSON.parse(clean);
      setUserAnswers(prev => ({
        ...prev,
        [q.id + '_aiEvaluation']: {
          score: typeof parsed.score === 'number' ? parsed.score : 0,
          feedback: parsed.feedback || 'Evaluated successfully.',
          maxMarks
        }
      }));
    } catch (err: any) {
      console.error(err);
      alert(`AI evaluation failed: ... ${err.message || 'Unknown error'}`);
    } finally {
      setEvaluatingQuestionId(null);
    }
  };

  // Submit Answer for current question
  const selectOption = (optIndex: number) => {
    if (isSubmitted) return;
    const currentQ = activeQueue[currentIndex];
    setUserAnswers((prev) => ({ ...prev, [currentQ.id]: optIndex }));
  };

  // Complete session & evaluate
  const handleSubmitTest = () => {
    const newProgressMap = { ...progress };

    activeQueue.forEach((q) => {
      const selected = userAnswers[q.id];
      const updatedProg = recordQuestionAnswer(q.id, selected, q.correctOptionIndex);
      newProgressMap[q.id] = updatedProg;
    });

    setProgress(newProgressMap);
    saveStoredProgress(newProgressMap);
    setIsSubmitted(true);
  };

  // Session Results & Topic-Wise Weakness Analytics summary
  const testResults = useMemo(() => {
    if (!isSubmitted || activeQueue.length === 0) return null;
    let correctCount = 0;
    let incorrectCount = 0;
    let skippedCount = 0;

    // Topic performance breakdown map
    const topicStatsMap: Record<
      string,
      { total: number; attempted: number; correct: number; incorrect: number }
    > = {};

    activeQueue.forEach((q) => {
      const topic = (q.category || 'General Topic').trim();
      if (!topicStatsMap[topic]) {
        topicStatsMap[topic] = { total: 0, attempted: 0, correct: 0, incorrect: 0 };
      }
      topicStatsMap[topic].total++;

      const isMcq = q.options && q.options.length > 0;
      if (isMcq) {
        const sel = userAnswers[q.id];
        if (sel === undefined) {
          skippedCount++;
        } else {
          topicStatsMap[topic].attempted++;
          if (sel === q.correctOptionIndex) {
            correctCount++;
            topicStatsMap[topic].correct++;
          } else {
            incorrectCount++;
            topicStatsMap[topic].incorrect++;
          }
        }
      } else {
        const selfGrade = userAnswers[q.id + '_selfGrade'];
        if (selfGrade === undefined) {
          skippedCount++;
        } else {
          topicStatsMap[topic].attempted++;
          if (selfGrade === 'correct') {
            correctCount++;
            topicStatsMap[topic].correct++;
          } else {
            incorrectCount++;
            topicStatsMap[topic].incorrect++;
          }
        }
      }
    });

    const attemptedTotal = correctCount + incorrectCount;
    const scorePct = attemptedTotal > 0 ? Math.round((correctCount / attemptedTotal) * 100) : 0;

    // Convert topic map into sorted list of topic performance metrics (Weakest topics first)
    const topicBreakdown = Object.entries(topicStatsMap)
      .map(([topicName, data]) => {
        const accuracyPct = data.attempted > 0 ? Math.round((data.correct / data.attempted) * 100) : 0;
        let status: 'weak' | 'average' | 'strong' = 'strong';
        if (accuracyPct < 60) status = 'weak';
        else if (accuracyPct < 80) status = 'average';

        return {
          topicName,
          ...data,
          accuracyPct,
          status,
        };
      })
      .filter((t) => t.attempted > 0)
      .sort((a, b) => a.accuracyPct - b.accuracyPct);

    let totalMaxMarks = 0;
    let totalScoredMarks = 0;
    let hasWrittenQuestions = false;

    activeQueue.forEach((q) => {
      const isMcq = q.options && q.options.length > 0;
      const maxM = isMcq ? 1 : (q.questionType === 'very_short' ? 2 : q.questionType === 'long' ? 10 : 5);
      totalMaxMarks += maxM;
      if (!isMcq) hasWrittenQuestions = true;

      if (isMcq) {
        const sel = userAnswers[q.id];
        if (sel === q.correctOptionIndex) {
          totalScoredMarks += 1;
        }
      } else {
        const evalObj = userAnswers[q.id + '_aiEvaluation'];
        if (evalObj && typeof evalObj.score === 'number') {
          totalScoredMarks += evalObj.score;
        }
      }
    });

    return {
      total: activeQueue.length,
      attemptedCount: attemptedTotal,
      correctCount,
      incorrectCount,
      skippedCount,
      scorePct,
      topicBreakdown,
      totalMaxMarks,
      totalScoredMarks,
      hasWrittenQuestions
    };
  }, [isSubmitted, activeQueue, userAnswers]);

  // Toggle Explanation visibility
  const toggleExplanation = (qId: string) => {
    setShowExplanationMap((prev) => ({ ...prev, [qId]: !prev[qId] }));
  };

  // Print / Export Question Set to PDF
  const handlePrintQuestionSet = (qList: any[]) => {
    if (!qList || qList.length === 0) {
      alert("No questions to export!");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to print/export PDF!");
      return;
    }

    // Helper to clean raw Markdown syntax noise for pristine PDF reading UI
    const formatCleanText = (txt: string) => {
      if (!txt) return '';
      return txt
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/^###\s*/gm, '')
        .replace(/^>\s*/gm, '')
        .replace(/=>/g, '→')
        .replace(/->/g, '→')
        .trim();
    };

    const content = `
      <html>
        <head>
          <title>${selectedSubject} - Question Bank Export</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
            h1 { font-size: 24px; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 30px; text-transform: uppercase; letter-spacing: 0.5px; }
            .meta { font-size: 13px; color: #64748b; font-weight: 600; margin-bottom: 40px; background: #f8fafc; padding: 12px 20px; border-radius: 8px; border: 1px solid #edf2f7; }
            .question-card { margin-bottom: 35px; page-break-inside: avoid; }
            .question-title { font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 12px; }
            .options-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 10px; margin-bottom: 12px; margin-left: 15px; }
            .option-item { background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 15px; border-radius: 8px; font-size: 13px; font-weight: 600; display: flex; align-items: center; }
            .option-badge { font-weight: 900; margin-right: 8px; color: #475569; }
            .option-correct { border-color: #86efac; background: #f0fdf4; color: #14532d; }
            .option-correct .option-badge { color: #15803d; }
            .answer-box { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px 18px; border-radius: 8px; font-size: 13px; color: #14532d; font-weight: 600; margin-bottom: 12px; margin-left: 15px; }
            .explanation-box { background: #faf5ff; border: 1px solid #f3e8ff; padding: 12px 18px; border-radius: 8px; font-size: 13px; color: #581c87; font-weight: 500; margin-left: 15px; }
            .explanation-title { font-weight: 800; margin-bottom: 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b21a8; }
            @media print {
              body { padding: 20px; }
            }
          </style>
        </head>
        <body>
          <h1>📝 ${selectedSubject} — Study Bank</h1>
          <div class="meta">
            <span>Subject: <strong>${selectedSubject}</strong></span> &nbsp; | &nbsp;
            <span>Topic Filter: <strong>${selectedTopic}</strong></span> &nbsp; | &nbsp;
            <span>Total Questions: <strong>${qList.length}</strong></span> &nbsp; | &nbsp;
            <span>Generated: <strong>${new Date().toLocaleDateString()}</strong></span>
          </div>
          <div>
            ${qList.map((q, idx) => {
              const isMcq = q.options && q.options.length > 0;
              return `
                <div class="question-card">
                  <div class="question-title">Q${idx + 1}. ${formatCleanText(q.questionText)}</div>
                  ${isMcq ? `
                    <div class="options-grid">
                      ${q.options.map((opt: string, oIdx: number) => {
                        const isCorrect = oIdx === q.correctOptionIndex;
                        return `
                          <div class="option-item ${isCorrect ? 'option-correct' : ''}">
                            <span class="option-badge">${String.fromCharCode(65 + oIdx)}.</span>
                            <span>${formatCleanText(opt)}</span>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  ` : `
                    <div class="answer-box">
                      <strong>🎯 Answer:</strong> ${formatCleanText(q.answer || "")}
                    </div>
                  `}
                  ${q.explanation ? `
                    <div class="explanation-box">
                      <div class="explanation-title">💡 Explanation & Solution</div>
                      <div>${formatCleanText(q.explanation)}</div>
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  };

  // Add custom question handler
  const handleCreateQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim() || newOptions.some((o) => !o.trim())) return;

    const newQ: Question = {
      id: `q-custom-${Date.now()}`,
      subject: newSubject,
      category: newCategory.trim() || 'General',
      questionText: newQuestionText.trim(),
      options: newOptions.map((o) => o.trim()),
      correctOptionIndex: newCorrectIndex,
      explanation: newExplanation.trim() || 'Solution verified.',
      difficulty: 'Medium',
    };

    const updated = [...questions, newQ];
    handleSaveQuestions(updated);

    // Reset Form
    setNewQuestionText('');
    setNewOptions(['', '', '', '']);
    setNewExplanation('');
    setIsAddModalOpen(false);
  };

  // Delete Question
  const handleDeleteQuestion = async (id: string) => {
    if (await confirm('Kya aap is question ko permanent remove karna chahte hain?', { title: 'Confirm Delete', variant: 'destructive' })) {
      const updated = questions.filter((q) => q.id !== id);
      handleSaveQuestions(updated);
      deleteQuestionFromCloud(id);
    }
  };

  // Share link handler
  const copyShareLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  const handleResetProgress = async () => {
    if (await confirm('Kya aap saari mastery aur progress reset karna chahte hain? Saare 100% mastered questions dubara practice set me aa jayenge.', { title: 'Reset Progress' })) {
      resetAllProgress();
      setProgress({});
    }
  };

  const handleClearAllQuestions = async () => {
    if (await confirm('Kya aap sabhi questions ko DELETE karna chahte hain? Question bank completely khali (empty) ho jayega.', { title: 'Clear All Questions', variant: 'destructive' })) {
      clearAllQuestionsStorage();
      clearAllCloudQuestions();
      setQuestions([]);
      setProgress({});
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50/80 text-slate-900 flex flex-col font-sans overflow-x-hidden selection:bg-amber-500 selection:text-white">
      {/* Top Banner & Header - Full Width */}
      <header className="border-b border-slate-200/90 bg-white sticky top-0 z-40 px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="w-full flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500 text-slate-950 shadow-sm flex items-center justify-center">
              <GraduationCap className="w-6 h-6 stroke-[2.3]" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  JRMD Student Practice & Quiz Hub
                </h1>
                <span className="text-xs px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-950 border border-amber-300 font-extrabold uppercase tracking-wider">
                  Public Access
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                  <span>Cloud Synced</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={copyShareLink}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-bold transition-all border border-slate-200"
            >
              <Share2 className="w-4 h-4 text-amber-700" />
              <span>{copiedLink ? 'Link Copied!' : 'Share Hub'}</span>
            </button>

            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold shadow-sm transition-all transform hover:scale-[1.01]"
              title="Bulk import questions directly from PDF text"
            >
              <FileText className="w-4 h-4 text-amber-400" />
              <span>Bulk PDF Import</span>
            </button>

            <button
              onClick={() => setIsAiModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-extrabold shadow-sm transition-all transform hover:scale-[1.01]"
              title="Generate MCQs from any text using AI"
            >
              <Sparkles className="w-4 h-4 text-purple-200" />
              <span>AI MCQ Generator</span>
            </button>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black shadow-sm transition-all transform hover:scale-[1.01]"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Add Question</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container - Full Fluid Screen Width */}
      <main className="flex-1 w-full px-4 sm:px-8 py-6 space-y-6">
        {/* Progress & Stats Cards Overview - Enhanced Interactive Presentation */}
        {!isTestActive && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {/* Total Questions Card (Click -> View All) */}
            <div
              onClick={() => setViewMode('all')}
              className={`bg-white border rounded-2xl p-5 flex items-center justify-between shadow-xs transition-all cursor-pointer group ${
                viewMode === 'all'
                  ? 'border-amber-500 ring-2 ring-amber-500/30 shadow-sm'
                  : 'border-slate-200 hover:border-amber-400'
              }`}
              title="Click to view All Questions"
            >
              <div className="space-y-1">
                <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Total Questions</p>
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">{stats.total}</h3>
                <p className="text-xs text-amber-700 font-extrabold flex items-center gap-1">
                  <span>In Question Bank</span>
                  {viewMode === 'all' && <span className="px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 text-[10px]">Active Filter</span>}
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-amber-50 text-amber-800 border border-amber-200 group-hover:scale-105 transition-transform">
                <BookOpen className="w-7 h-7 text-amber-600" />
              </div>
            </div>

            {/* 100% Mastered Card (Click -> View Mastered) */}
            <div
              onClick={() => setViewMode('mastered')}
              className={`bg-white border rounded-2xl p-5 flex items-center justify-between shadow-xs transition-all cursor-pointer group ${
                viewMode === 'mastered'
                  ? 'border-emerald-500 ring-2 ring-emerald-500/30 shadow-sm'
                  : 'border-slate-200 hover:border-emerald-400'
              }`}
              title="Click to filter 100% Mastered Questions"
            >
              <div className="space-y-1">
                <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">100% Mastered</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">{stats.masteredCount}</h3>
                  <span className="text-xs text-emerald-700 font-black">({stats.masteredPercentage}%)</span>
                </div>
                <p className="text-xs text-emerald-700 font-extrabold flex items-center gap-1">
                  <span>Saved to Mastery</span>
                  {viewMode === 'mastered' && <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white text-[10px]">Active Filter</span>}
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 group-hover:scale-105 transition-transform">
                <Trophy className="w-7 h-7 text-emerald-600" />
              </div>
            </div>

            {/* Pending Practice / Focus Card (Click -> View Active Unmastered) */}
            <div
              onClick={() => setViewMode('unmastered')}
              className={`bg-white border rounded-2xl p-5 flex items-center justify-between shadow-xs transition-all cursor-pointer group ${
                viewMode === 'unmastered'
                  ? 'border-amber-500 ring-2 ring-amber-500/30 shadow-sm'
                  : 'border-slate-200 hover:border-amber-400'
              }`}
              title="Click to filter Active Unmastered Questions"
            >
              <div className="space-y-1">
                <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Needs Focus</p>
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">{stats.unmasteredCount}</h3>
                <p className="text-xs text-amber-700 font-extrabold flex items-center gap-1">
                  <span>Active Practice List</span>
                  {viewMode === 'unmastered' && <span className="px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 text-[10px]">Active Filter</span>}
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-amber-50 text-amber-800 border border-amber-200 group-hover:scale-105 transition-transform">
                <Flame className="w-7 h-7 text-amber-600" />
              </div>
            </div>

            {/* Overall Mastery Meter Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-xs hover:border-amber-400 transition-all">
              <div className="flex justify-between items-center">
                <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Mastery Level</p>
                <Sparkles className="w-5 h-5 text-amber-500" />
              </div>
              <div className="my-2">
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${stats.masteredPercentage}%` }}
                  />
                </div>
              </div>
              <div className="flex justify-between text-xs text-slate-500 font-bold">
                <span>0%</span>
                <span className="font-black text-amber-900">{stats.masteredPercentage}% Completed</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        )}

        {/* ACTIVE PRACTICE TEST MODE */}
        {isTestActive ? (
          <div className="space-y-6 max-w-4xl mx-auto">
            {/* Top Controller Bar */}
            <div className="bg-white border border-amber-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSubmitTest}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-sm"
                  title="Finish session and save solved questions score"
                >
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>
                    {Object.keys(userAnswers).length > 0
                      ? `Finish & Evaluate (${Object.keys(userAnswers).length} Solved)`
                      : 'Finish & Evaluate'}
                  </span>
                </button>

                <button
                  onClick={async () => {
                    const count = Object.keys(userAnswers).length;
                    if (count > 0 && !isSubmitted) {
                      if (await confirm(`Aapne ${count} questions solve kiye hain. Kya aap bina save kiye exit karna chahte hain?`, { title: 'Confirm Exit' })) {
                        setIsTestActive(false);
                      }
                    } else {
                      setIsTestActive(false);
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors border border-slate-300"
                  title="Exit without saving"
                >
                  <span>Discard & Quit</span>
                </button>

                <span className="text-slate-300">|</span>
                <div className="text-xs font-bold text-slate-700">
                  Question <span className="text-amber-800 text-sm font-black">{currentIndex + 1}</span> of{' '}
                  <span className="text-slate-500">{activeQueue.length}</span>
                </div>
              </div>

              {/* Progress Indicator & Finish Button */}
              <div className="flex items-center gap-3">
                <div className="hidden sm:block w-32 bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                  <div
                    className="bg-amber-500 h-full transition-all duration-300"
                    style={{ width: `${((currentIndex + 1) / activeQueue.length) * 100}%` }}
                  />
                </div>

                {!isSubmitted ? (
                  <button
                    onClick={handleSubmitTest}
                    className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-900 text-white font-black text-xs shadow-md flex items-center gap-1.5 transition-all transform hover:scale-[1.02]"
                  >
                    <CheckCircle2 className="w-4 h-4 text-amber-400" />
                    <span>
                      {Object.keys(userAnswers).length > 0
                        ? `Submit Session (${Object.keys(userAnswers).length} Solved)`
                        : 'Submit Session'}
                    </span>
                  </button>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-black flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> Evaluated
                  </span>
                )}
              </div>
            </div>

            {/* Test Completed / Evaluation Summary Card */}
            {isSubmitted && testResults && (
              <div className="bg-white border border-amber-300 rounded-3xl p-6 sm:p-10 space-y-6 shadow-md text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                  <Award className="w-64 h-64 text-amber-600" />
                </div>

                <div className="inline-flex p-4 rounded-full bg-amber-100 text-amber-900 border border-amber-300 mb-1 shadow-xs">
                  <Trophy className="w-10 h-10 text-amber-600 animate-bounce" />
                </div>

                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Session Result & Mastery Report</h2>
                  <p className="text-sm text-slate-600 mt-1 font-bold">
                    Questions answered correctly with 100% score are automatically marked as Mastered!
                  </p>
                </div>

                {/* Score Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center shadow-xs">
                    <p className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Accuracy</p>
                    <p className="text-3xl font-black text-amber-900">{testResults.scorePct}%</p>
                    <p className="text-[10px] text-slate-600 font-bold mt-1">
                      ({testResults.correctCount} of {testResults.attemptedCount} Solved Correct)
                    </p>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 text-center shadow-xs">
                    {testResults.hasWrittenQuestions ? (
                      <>
                        <p className="text-xs font-extrabold text-purple-800 uppercase tracking-wider">Marks Scored</p>
                        <p className="text-3xl font-black text-purple-900">{testResults.totalScoredMarks} / {testResults.totalMaxMarks}</p>
                        <p className="text-[10px] text-purple-800 font-bold mt-1">Scored via AI evaluation</p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider">100% Mastered</p>
                        <p className="text-3xl font-black text-emerald-900">{testResults.correctCount}</p>
                        <p className="text-[10px] text-emerald-800 font-bold mt-1">Saved to Mastery</p>
                      </>
                    )}
                  </div>
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-center shadow-xs">
                    <p className="text-xs font-extrabold text-rose-800 uppercase tracking-wider">Incorrect</p>
                    <p className="text-3xl font-black text-rose-900">{testResults.incorrectCount}</p>
                    <p className="text-[10px] text-rose-800 font-bold mt-1">Needs Review</p>
                  </div>
                  <div className="bg-slate-100 border border-slate-200 rounded-2xl p-4 text-center shadow-xs">
                    <p className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Unattempted</p>
                    <p className="text-3xl font-black text-slate-900">{testResults.skippedCount}</p>
                    <p className="text-[10px] text-slate-600 font-bold mt-1">Remaining</p>
                  </div>
                </div>

                {testResults.correctCount > 0 && (
                  <div className="bg-emerald-100 border border-emerald-300 rounded-2xl p-4 text-emerald-950 text-xs sm:text-sm font-black flex items-center justify-center gap-2 max-w-xl mx-auto shadow-xs">
                    <Sparkles className="w-5 h-5 text-emerald-700 flex-shrink-0" />
                    <span>
                      <strong>{testResults.correctCount} question(s)</strong> scored 100% and have been removed from your future practice sessions!
                    </span>
                  </div>
                )}

                {/* Topic-Wise Weak Spot & Performance Analytics Breakdown */}
                {testResults.topicBreakdown.length > 0 && (
                  <div className="space-y-3.5 pt-4 border-t border-slate-200 max-w-3xl mx-auto text-left">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <Target className="w-4.5 h-4.5 text-amber-600" />
                        <span>Topic-Wise Weak Spot & Score Analysis</span>
                      </h3>
                      <span className="text-[11px] text-slate-500 font-bold">Sorted by Weakest Topic First</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {testResults.topicBreakdown.map((item) => {
                        let badgeStyle = 'bg-emerald-50 border-emerald-200 text-emerald-950';
                        let statusLabel = '🟢 Strong Topic';

                        if (item.status === 'weak') {
                          badgeStyle = 'bg-rose-50 border-rose-200 text-rose-950';
                          statusLabel = '🔴 Weak Topic (Revise)';
                        } else if (item.status === 'average') {
                          badgeStyle = 'bg-amber-50 border-amber-200 text-amber-950';
                          statusLabel = '🟡 Needs Practice';
                        }

                        return (
                          <div
                            key={item.topicName}
                            className={`p-3.5 rounded-2xl border ${badgeStyle} space-y-2 transition-all shadow-xs`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-extrabold text-xs text-slate-900 truncate" title={item.topicName}>
                                {item.topicName}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black border bg-white shadow-xs">
                                {statusLabel}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-xs pt-0.5">
                              <div className="space-x-2 text-[11px]">
                                <span className="text-emerald-700 font-bold">✓ {item.correct} Correct</span>
                                <span className="text-rose-700 font-bold">✗ {item.incorrect} Wrong</span>
                              </div>
                              <span className="font-black text-xs text-slate-900">{item.accuracyPct}% Score</span>
                            </div>

                            {/* Accuracy Bar */}
                            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden border border-slate-300">
                              <div
                                className={`h-full transition-all duration-500 ${
                                  item.status === 'weak'
                                    ? 'bg-rose-600'
                                    : item.status === 'average'
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-600'
                                }`}
                                style={{ width: `${item.accuracyPct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                  <button
                    onClick={() => {
                      const qList = getStoredQuestions();
                      const pList = getStoredProgress();
                      setQuestions(qList);
                      setProgress(pList);
                      setIsTestActive(false);
                    }}
                    className="px-8 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black shadow-md text-sm flex items-center gap-2 transition-all transform hover:scale-[1.02]"
                  >
                    <ArrowRight className="w-4 h-4 stroke-[3]" />
                    <span>Return to Dashboard</span>
                  </button>
                </div>
              </div>
            )}

            {/* Question Card Box */}
            {activeQueue[currentIndex] && (
              <div className="bg-white border border-amber-200 rounded-3xl p-6 sm:p-9 space-y-6 shadow-sm relative">
                {/* Meta info */}
                <div className="flex items-center justify-between text-xs border-b border-slate-200 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-950 border border-amber-300 font-black">
                      {activeQueue[currentIndex].subject}
                    </span>
                    {activeQueue[currentIndex].category && (
                      <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-300 font-bold">
                        {activeQueue[currentIndex].category}
                      </span>
                    )}
                  </div>
                  {progress[activeQueue[currentIndex].id]?.isMastered && (
                    <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-black flex items-center gap-1">
                      <Trophy className="w-3.5 h-3.5 text-emerald-700" /> 100% Mastered Previously
                    </span>
                  )}
                </div>

                {/* Question Statement */}
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 leading-relaxed tracking-tight">
                    {currentIndex + 1}. {activeQueue[currentIndex].questionText}
                  </h3>
                </div>

                {/* Options / Answer Input List */}
                <div className="space-y-4 pt-2">
                  {activeQueue[currentIndex].options && activeQueue[currentIndex].options.length > 0 ? (
                    activeQueue[currentIndex].options.map((optText, optIdx) => {
                      const qId = activeQueue[currentIndex].id;
                      const isSelected = userAnswers[qId] === optIdx;
                      const isCorrect = activeQueue[currentIndex].correctOptionIndex === optIdx;

                      let optionStyle = 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-amber-50 hover:border-amber-300';

                      if (isSubmitted) {
                        if (isCorrect) {
                          optionStyle = 'bg-emerald-100 border-emerald-400 text-emerald-950 font-black shadow-xs';
                        } else if (isSelected && !isCorrect) {
                          optionStyle = 'bg-rose-100 border-rose-400 text-rose-950 line-through opacity-90 font-bold';
                        } else {
                          optionStyle = 'bg-slate-50 border-slate-200 text-slate-400 opacity-60';
                        }
                      } else if (isSelected) {
                        optionStyle = 'bg-amber-100 border-amber-500 text-amber-950 font-black ring-2 ring-amber-500/40 shadow-xs';
                      }

                      return (
                        <button
                          key={optIdx}
                          onClick={() => selectOption(optIdx)}
                          disabled={isSubmitted}
                          className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between gap-4 transition-all ${optionStyle}`}
                        >
                          <div className="flex items-center gap-3.5">
                            <span
                              className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black transition-colors ${
                                isSelected
                                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                                  : 'bg-white text-slate-700 border border-slate-300'
                              }`}
                            >
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span className="text-sm font-bold">{optText}</span>
                          </div>

                          {isSubmitted && (
                            <div>
                              {isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-700 stroke-[2.5]" />}
                              {isSelected && !isCorrect && <XCircle className="w-5 h-5 text-rose-600 stroke-[2.5]" />}
                            </div>
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2">Write Your Answer Below</label>
                        <textarea
                          placeholder="Yahan apna answer type karein..."
                          value={userAnswers[activeQueue[currentIndex].id] || ''}
                          disabled={isSubmitted}
                          onChange={(e) => {
                            const val = e.target.value;
                            setUserAnswers(prev => ({ ...prev, [activeQueue[currentIndex].id]: val }));
                          }}
                          rows={4}
                          className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-4 text-slate-900 font-semibold focus:outline-none focus:border-purple-500 placeholder:text-slate-400 font-sans"
                        />
                      </div>

                      {isSubmitted && (
                        <div className="space-y-4 border-t border-slate-200 pt-4">
                          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2">
                            <span className="block text-[11px] font-black text-emerald-800 uppercase tracking-wider">🎯 Ideal Model Answer</span>
                            <p className="text-sm text-emerald-950 font-bold leading-relaxed">{activeQueue[currentIndex].answer || "No model answer provided."}</p>
                          </div>

                          {/* AI Evaluation Section */}
                          {userAnswers[activeQueue[currentIndex].id + '_aiEvaluation'] ? (
                            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 space-y-3.5 shadow-sm">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                                  <Sparkles className="w-4 h-4 text-purple-700 animate-pulse" />
                                  <span>AI Evaluation Report</span>
                                </span>
                                <span className="px-3 py-1 bg-purple-100 text-purple-950 rounded-full font-black text-xs border border-purple-300">
                                  Score: {userAnswers[activeQueue[currentIndex].id + '_aiEvaluation'].score} / {userAnswers[activeQueue[currentIndex].id + '_aiEvaluation'].maxMarks} Marks
                                </span>
                              </div>
                              <div className="p-3.5 bg-white border border-purple-200 rounded-xl text-slate-800 text-xs font-bold leading-relaxed">
                                {userAnswers[activeQueue[currentIndex].id + '_aiEvaluation'].feedback}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                disabled={evaluatingQuestionId === activeQueue[currentIndex].id}
                                onClick={() => handleEvaluateAnswerWithAi(activeQueue[currentIndex])}
                                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-black text-xs rounded-xl shadow-sm flex items-center gap-2 transition-all"
                              >
                                {evaluatingQuestionId === activeQueue[currentIndex].id ? (
                                  <>
                                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>AI Evaluating...</span>
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>🤖 Evaluate Answer with AI</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}

                          <div className="flex flex-col sm:flex-row items-center gap-3">
                            <span className="text-xs font-black text-slate-600">Manual Grading (Backup):</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setUserAnswers(prev => ({
                                    ...prev,
                                    [activeQueue[currentIndex].id + '_selfGrade']: 'correct',
                                    [activeQueue[currentIndex].id + '_aiEvaluation']: {
                                      score: activeQueue[currentIndex].questionType === 'very_short' ? 2 : activeQueue[currentIndex].questionType === 'long' ? 10 : 5,
                                      feedback: 'Manually marked as correct by student.',
                                      maxMarks: activeQueue[currentIndex].questionType === 'very_short' ? 2 : activeQueue[currentIndex].questionType === 'long' ? 10 : 5
                                    }
                                  }));
                                }}
                                className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs border ${
                                  userAnswers[activeQueue[currentIndex].id + '_selfGrade'] === 'correct'
                                    ? 'bg-emerald-650 border-emerald-700 text-white'
                                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <span>🟢 I got it Correct</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setUserAnswers(prev => ({
                                    ...prev,
                                    [activeQueue[currentIndex].id + '_selfGrade']: 'incorrect',
                                    [activeQueue[currentIndex].id + '_aiEvaluation']: {
                                      score: 0,
                                      feedback: 'Manually marked as incorrect by student.',
                                      maxMarks: activeQueue[currentIndex].questionType === 'very_short' ? 2 : activeQueue[currentIndex].questionType === 'long' ? 10 : 5
                                    }
                                  }));
                                }}
                                className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs border ${
                                  userAnswers[activeQueue[currentIndex].id + '_selfGrade'] === 'incorrect'
                                    ? 'bg-rose-650 border-rose-700 text-white'
                                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <span>🔴 I got it Wrong</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Explanation Section */}
                {isSubmitted && (
                  <div className="mt-6 border-t border-slate-200 pt-6">
                    <button
                      onClick={() => toggleExplanation(activeQueue[currentIndex].id)}
                      className="w-full flex items-center justify-between p-4 rounded-2xl bg-amber-50 border border-amber-300 hover:bg-amber-100 transition-colors text-amber-950 font-black"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <Lightbulb className="w-5 h-5 text-amber-600 stroke-[2.5]" />
                        <span>Step-by-Step Solution & Explanation</span>
                      </div>
                      <span className="text-xs text-amber-800 uppercase tracking-wider">
                        {showExplanationMap[activeQueue[currentIndex].id] ? 'Hide Solution' : 'View Solution'}
                      </span>
                    </button>

                    {showExplanationMap[activeQueue[currentIndex].id] && (
                      <div className="mt-3 p-5 rounded-2xl bg-amber-50/80 border border-amber-300 text-slate-900 text-sm space-y-2.5 animate-fadeIn">
                        <p className="font-extrabold text-emerald-800 flex items-center gap-1.5">
                          <Check className="w-4 h-4 text-emerald-700 stroke-[3]" /> Correct Answer: Option{' '}
                          {String.fromCharCode(65 + activeQueue[currentIndex].correctOptionIndex)} (
                          {activeQueue[currentIndex].options[activeQueue[currentIndex].correctOptionIndex]})
                        </p>
                        <div className="p-3.5 rounded-xl bg-white border border-amber-300 text-slate-900 leading-relaxed font-bold">
                          {activeQueue[currentIndex].explanation}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Navigation Bar */}
                <div className="flex items-center justify-between border-t border-slate-200 pt-6">
                  <button
                    onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                    disabled={currentIndex === 0}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-extrabold flex items-center gap-1.5 transition-colors border border-slate-300"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </button>

                  <div className="flex items-center gap-2">
                    {!isSubmitted && (
                      <button
                        onClick={handleSubmitTest}
                        className="px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 text-white font-black text-xs shadow-md transition-all flex items-center gap-1.5 transform hover:scale-[1.02]"
                      >
                        <CheckCircle2 className="w-4 h-4 text-amber-400" />
                        <span>
                          {Object.keys(userAnswers).length > 0
                            ? `Finish & Evaluate (${Object.keys(userAnswers).length} Solved)`
                            : 'Finish Session'}
                        </span>
                      </button>
                    )}

                    {currentIndex < activeQueue.length - 1 && (
                      <button
                        onClick={() => setCurrentIndex((prev) => Math.min(activeQueue.length - 1, prev + 1))}
                        className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all shadow-xs"
                      >
                        Next <ChevronRight className="w-4 h-4 stroke-[3]" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* DASHBOARD & QUESTION MANAGEMENT VIEW */
          <div className="space-y-6">
            {/* Filter & Control Panel - Sleek Compact Layout */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xs">
              {/* Top Row: View Mode Tabs & Quick Management Actions */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                {/* View Mode Tabs (Active / Focus / Mastered / All / Slides) */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 flex-1">
                  <button
                    onClick={() => setViewMode('unmastered')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                      viewMode === 'unmastered'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'text-slate-700 hover:text-slate-900 hover:bg-white/80'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5 shrink-0" />
                    <span>Active ({stats.unmasteredCount})</span>
                  </button>

                  <button
                    onClick={() => setViewMode('focus')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                      viewMode === 'focus'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'text-slate-700 hover:text-slate-900 hover:bg-white/80'
                    }`}
                    title="Questions attempted but answered incorrectly (needs focus/revision)"
                  >
                    <Flame className="w-3.5 h-3.5 shrink-0" />
                    <span>Focus ({stats.focusCount})</span>
                  </button>

                  <button
                    onClick={() => setViewMode('mastered')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                      viewMode === 'mastered'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900 hover:bg-white/80'
                    }`}
                  >
                    <Trophy className="w-3.5 h-3.5 shrink-0" />
                    <span>Mastered ({stats.masteredCount})</span>
                  </button>

                  <button
                    onClick={() => setViewMode('all')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                      viewMode === 'all'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'text-slate-700 hover:text-slate-900 hover:bg-white/80'
                    }`}
                  >
                    <Brain className="w-3.5 h-3.5 shrink-0" />
                    <span>All ({stats.total})</span>
                  </button>

                  <button
                    onClick={() => setViewMode('presentations')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                      viewMode === 'presentations'
                        ? 'bg-purple-700 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900 hover:bg-white/80'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 shrink-0" />
                    <span>My Slides ({savedPresentations.length})</span>
                  </button>
                </div>

                {/* Management Action Buttons */}
                <div className="flex items-center gap-2 justify-end shrink-0">
                  <button
                    onClick={handleBatchReassignSubject}
                    className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-950 text-xs font-extrabold transition-colors border border-amber-200 flex items-center gap-1"
                    title="Move all displayed questions to a single Subject"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                    <span>Merge</span>
                  </button>

                  <button
                    onClick={handleResetProgress}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-extrabold transition-colors border border-slate-200 flex items-center gap-1"
                    title="Reset all mastered questions back to practice list"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                    <span>Reset</span>
                  </button>

                  <button
                    onClick={handleClearAllQuestions}
                    className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-extrabold transition-colors border border-rose-200 flex items-center gap-1"
                    title="Delete all questions from storage"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              {/* Bottom Row: Subject Filter Pills + Topic Selector Dropdown + Search Box */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
                {/* Left: Subject Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin flex-1">
                  {availableSubjects.map((subject) => {
                    const normS = subject.trim().toLowerCase();
                    const count = subject === 'All Subjects'
                      ? questions.length
                      : questions.filter((q) => (q.subject || '').trim().toLowerCase() === normS).length;
                    const isSelected = selectedSubject.trim().toLowerCase() === normS;
                    return (
                      <button
                        key={subject}
                        onClick={() => {
                          setSelectedSubject(subject);
                          setSelectedTopic('All Topics');
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-black whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="capitalize">{subject}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-black ${
                          isSelected ? 'bg-slate-950 text-amber-300' : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Right: Modern Custom Topic Dropdown + Search Box */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Modern Custom Floating Topic Selector */}
                  {availableTopics.length > 1 && (
                    <div className="relative" ref={topicDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsTopicDropdownOpen(!isTopicDropdownOpen)}
                        className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-amber-400 text-xs font-black text-slate-800 shadow-2xs transition-all min-w-[190px] max-w-[250px]"
                      >
                        <span className="truncate text-left">
                          {selectedTopic === 'All Topics' ? 'All Topics' : selectedTopic}
                        </span>
                        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isTopicDropdownOpen ? 'rotate-180 text-amber-600' : ''}`} />
                      </button>

                      {/* Floating Dropdown Card */}
                      {isTopicDropdownOpen && (
                        <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-white border border-amber-300/80 rounded-xl shadow-xl p-2 space-y-1 animate-fadeIn">
                          <div className="px-2 py-1 flex items-center justify-between border-b border-slate-100 mb-1">
                            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Select Practice Topic</span>
                            {selectedTopic !== 'All Topics' && (
                              <button
                                onClick={() => {
                                  setSelectedTopic('All Topics');
                                  setIsTopicDropdownOpen(false);
                                }}
                                className="text-[11px] text-amber-700 font-black hover:underline"
                              >
                                Reset
                              </button>
                            )}
                          </div>

                          <div className="max-h-60 overflow-y-auto space-y-0.5 scrollbar-thin">
                            {availableTopics.map((topic) => {
                              const normTop = topic.trim().toLowerCase();
                              const normSubj = selectedSubject.trim().toLowerCase();

                              const topicQuestions = questions.filter((q) => {
                                const qSubj = (q.subject || '').trim().toLowerCase();
                                const qTop = (q.category || '').trim().toLowerCase();
                                const matchesSubj = normSubj === 'all subjects' || qSubj === normSubj;
                                const matchesTop = normTop === 'all topics' || qTop === normTop;
                                return matchesSubj && matchesTop;
                              });

                              const isSelected = selectedTopic.trim().toLowerCase() === normTop;

                              return (
                                <button
                                  key={topic}
                                  onClick={() => {
                                    setSelectedTopic(topic);
                                    setIsTopicDropdownOpen(false);
                                  }}
                                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between gap-2 transition-colors ${
                                    isSelected
                                      ? 'bg-amber-500 text-slate-950 font-black'
                                      : 'text-slate-700 hover:bg-amber-50 hover:text-amber-950'
                                  }`}
                                >
                                  <span className="truncate">{topic}</span>
                                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-black shrink-0 ${
                                    isSelected ? 'bg-slate-950 text-amber-300' : 'bg-slate-100 text-slate-600 border border-slate-200'
                                  }`}>
                                    {topicQuestions.length}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Search Input */}
                  <div className="relative min-w-[200px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search questions..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 font-semibold"
                    />
                  </div>
                </div>
              </div>
                     {viewMode === 'presentations' ? (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Layers className="w-4.5 h-4.5 text-purple-700 animate-pulse" />
                    <span>My Saved Study Presentations ({savedPresentations.length})</span>
                  </h3>
                  <span className="text-[11px] text-slate-500 font-bold">
                    Saved slide decks are kept locally in your app dashboard
                  </span>
                </div>

                {savedPresentations.length === 0 ? (
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-12 text-center space-y-4 shadow-xs">
                    <Layers className="w-12 h-12 text-purple-400 mx-auto" />
                    <h4 className="text-base font-black text-slate-900">No Saved Slides Yet</h4>
                    <p className="text-xs text-slate-600 max-w-md mx-auto font-bold leading-relaxed">
                      You haven't saved any presentation decks yet. Generate a slides deck using the <strong>AI Creator Hub</strong>, and click <strong>"Save to My Slides"</strong> to store it here.
                    </p>
                    <button
                      onClick={() => { setIsAiModalOpen(true); setAiActiveTab('ppt'); }}
                      className="px-5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-black shadow-xs transition-colors"
                    >
                      Open AI Creator Hub
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {savedPresentations.map((pres) => (
                      <div
                        key={pres.id}
                        className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all hover:border-purple-400 cursor-pointer flex flex-col justify-between space-y-4 group relative overflow-hidden"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-950 font-black uppercase">
                              {pres.category}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">
                              {new Date(pres.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <h4 className="text-sm font-black text-slate-900 group-hover:text-purple-700 transition-colors line-clamp-2">
                            {pres.title}
                          </h4>
                          <p className="text-[11px] text-slate-600 line-clamp-3 font-semibold">
                            {pres.topicText}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                          <span className="text-xs text-slate-500 font-bold">
                            {pres.slides.length} slides
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const updated = savedPresentations.filter(p => p.id !== pres.id);
                                setSavedPresentations(updated);
                                localStorage.setItem('jrmd_saved_presentations', JSON.stringify(updated));
                              }}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                              title="Delete Presentation"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAiSlides(pres.slides);
                                setAiCategory(pres.category);
                                setAiTopicText(pres.topicText);
                                setAiSlidesTheme(pres.theme);
                                setCurrentSlideIndex(0);
                                setAiActiveTab('ppt');
                                setIsAiModalOpen(true);
                                setActivePresentationId(pres.id);
                              }}
                              className="px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white font-black text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1"
                            >
                              <span>Play Slides</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Launch Practice Test Banner */}
                <div className="bg-gradient-to-r from-amber-500 to-amber-600 border border-amber-400/80 rounded-2xl p-5 sm:p-7 flex flex-col sm:flex-row items-center justify-between gap-5 shadow-xs text-slate-950">
                  <div className="space-y-1 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <Sparkles className="w-5 h-5 text-slate-950 stroke-[2.2]" />
                      <h3 className="text-lg sm:text-xl font-black text-slate-950 tracking-tight">Ready to Start Practice Session?</h3>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-950/90 max-w-xl font-bold">
                      {viewMode === 'unmastered' &&
                        `Starting session with ${filteredQuestions.length} active questions. Questions you solve with 100% score will be removed automatically!`}
                      {viewMode === 'focus' &&
                        `Targeted revision with ${filteredQuestions.length} focus questions (wrongly answered or unattempted).`}
                      {viewMode === 'mastered' &&
                        `Reviewing ${filteredQuestions.length} questions that you have already mastered 100%.`}
                      {viewMode === 'all' && `Practicing across all ${filteredQuestions.length} questions in bank.`}
                    </p>
                  </div>

                  <button
                    onClick={startPracticeTest}
                    disabled={filteredQuestions.length === 0}
                    className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-slate-950 hover:bg-slate-900 disabled:opacity-40 text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-all transform hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <Brain className="w-4.5 h-4.5 text-amber-400" />
                    <span>Start Session ({filteredQuestions.length})</span>
                  </button>
                </div>

                {/* Question List Preview & Explanations Browser */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-amber-600" />
                        <span>Question Bank ({filteredQuestions.length})</span>
                      </h3>
                      {filteredQuestions.length > 0 && (
                        <button
                          onClick={() => handlePrintQuestionSet(filteredQuestions)}
                          className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-extrabold text-[11px] rounded-lg border border-amber-200 shadow-2xs flex items-center gap-1 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5 text-amber-750" />
                          <span>Export PDF / Print Set</span>
                        </button>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 font-bold">Click any question to view solution</span>
                  </div>

                  {selectedQuestionIds.length > 0 && (
                    <div className="bg-gradient-to-r from-purple-600 to-indigo-650 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm animate-fadeIn text-white">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 bg-green-400 rounded-full animate-ping" />
                        <span className="text-xs font-black">
                          {selectedQuestionIds.length} question(s) selected to build custom set
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={startPracticeTestWithSelected}
                          className="px-3.5 py-1.5 bg-white text-purple-950 font-black text-[11px] rounded-xl hover:bg-slate-50 transition-colors shadow-2xs flex items-center gap-1"
                        >
                          <Target className="w-3.5 h-3.5 text-purple-700" />
                          <span>🎯 Start Custom Test</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const selectedQs = questions.filter(q => selectedQuestionIds.includes(q.id));
                            handlePrintQuestionSet(selectedQs);
                          }}
                          className="px-3.5 py-1.5 bg-purple-700/60 border border-purple-500 text-white font-black text-[11px] rounded-xl hover:bg-purple-700/80 transition-colors flex items-center gap-1"
                        >
                          <FileText className="w-3.5 h-3.5 text-white" />
                          <span>📄 Export Selected to PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedQuestionIds([])}
                          className="px-2.5 py-1.5 bg-slate-100/10 hover:bg-slate-100/20 text-white font-bold text-[11px] rounded-xl transition-colors"
                        >
                          Clear Selection
                        </button>
                      </div>
                    </div>
                  )}

                  {filteredQuestions.length === 0 ? (
                    <div className="bg-white border border-slate-200/90 rounded-2xl p-10 text-center space-y-4 shadow-xs">
                      {stats.total === 0 ? (
                        <>
                          <FileText className="w-12 h-12 text-amber-500 mx-auto" />
                          <h4 className="text-base font-black text-slate-900">No Questions in Question Bank</h4>
                          <p className="text-xs text-slate-600 max-w-md mx-auto font-medium leading-relaxed">
                            Your question bank is empty. Click <strong>"Bulk PDF Import"</strong> to paste your PDF text and import questions instantly in 1 click!
                          </p>
                          <button
                            onClick={() => setIsBulkModalOpen(true)}
                            className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-black shadow-xs"
                          >
                            Open Bulk PDF Importer
                          </button>
                        </>
                      ) : (
                        <>
                          <Trophy className="w-10 h-10 text-emerald-500 mx-auto animate-bounce" />
                          <h4 className="text-base font-black text-slate-900">All Questions Mastered in this Filter!</h4>
                          <p className="text-xs text-slate-600 max-w-md mx-auto font-medium">
                            Congratulations! You have scored 100% on all questions under this category. Switch filters or reset mastery to practice again.
                          </p>
                          <button
                            onClick={() => setViewMode('all')}
                            className="px-4 py-2 rounded-xl bg-amber-500 text-xs font-black text-slate-950 shadow-xs"
                          >
                            View All Questions
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredQuestions.map((q, idx) => {
                        if (editingQuestion?.id === q.id) {
                          return (
                            <div key={q.id} className="bg-white border-2 border-purple-500 rounded-3xl p-5 space-y-4 shadow-md">
                              <div className="flex items-center justify-between border-b pb-2">
                                <span className="text-xs font-black text-purple-950 uppercase tracking-wider flex items-center gap-1">
                                  <span>✏️ Edit Question</span>
                                </span>
                                <button type="button" onClick={() => { setEditingQuestion(null); setEditingQuestionIndex(null); }} className="text-slate-400 hover:text-slate-700 text-lg leading-none">&times;</button>
                              </div>
                              <div>
                                <label className="block text-[11px] font-black text-slate-600 mb-1 uppercase tracking-wide">Question</label>
                                <textarea
                                  value={editingQuestion.questionText}
                                  onChange={(e) => setEditingQuestion((prev: any) => ({ ...prev, questionText: e.target.value }))}
                                  rows={2}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-purple-400 resize-none"
                                />
                              </div>
                              {(editingQuestion.options && editingQuestion.options.length > 0) ? (
                                <div>
                                  <label className="block text-[11px] font-black text-slate-600 mb-1.5 uppercase tracking-wide">Options</label>
                                  <div className="space-y-1.5">
                                    {editingQuestion.options.map((opt: string, oIdx: number) => (
                                      <div key={oIdx} className="flex items-center gap-2">
                                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${
                                          oIdx === editingQuestion.correctOptionIndex ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
                                        }`}>{String.fromCharCode(65 + oIdx)}</span>
                                        <input
                                          type="text"
                                          value={opt}
                                          onChange={(e) => {
                                            const newOpts = [...editingQuestion.options];
                                            newOpts[oIdx] = e.target.value;
                                            setEditingQuestion((prev: any) => ({ ...prev, options: newOpts }));
                                          }}
                                          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-purple-400"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => setEditingQuestion((prev: any) => ({ ...prev, correctOptionIndex: oIdx }))}
                                          className={`px-2 py-1 rounded-lg text-[10px] font-black transition-colors ${
                                            oIdx === editingQuestion.correctOptionIndex
                                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                              : 'bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'
                                          }`}
                                        >✓ Correct</button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <label className="block text-[11px] font-black text-slate-600 mb-1 uppercase tracking-wide">Answer</label>
                                  <textarea
                                    value={editingQuestion.answer || ''}
                                    onChange={(e) => setEditingQuestion((prev: any) => ({ ...prev, answer: e.target.value }))}
                                    rows={3}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-purple-400 resize-none"
                                  />
                                </div>
                              )}
                              <div>
                                <label className="block text-[11px] font-black text-slate-600 mb-1 uppercase tracking-wide">Explanation</label>
                                <textarea
                                  value={editingQuestion.explanation || ''}
                                  onChange={(e) => setEditingQuestion((prev: any) => ({ ...prev, explanation: e.target.value }))}
                                  rows={3}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-purple-400 resize-none"
                                />
                              </div>
                              <div className="flex gap-2 justify-end pt-1">
                                <button
                                  type="button"
                                  onClick={() => { setEditingQuestion(null); setEditingQuestionIndex(null); }}
                                  className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                                >Cancel</button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleSaveQuestionEdit(editingQuestion);
                                  }}
                                  className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs flex items-center gap-1.5"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[3]" /> Save Changes
                                </button>
                              </div>
                            </div>
                          );
                        }

                        const qProg = progress[q.id];
                        const isMastered = qProg?.isMastered;
                        const isOpenExp = !!showExplanationMap[q.id];

                        // Helper to clean raw Markdown syntax noise (*, **, ###, >, =>) for pristine reading UI
                        const formatCleanText = (txt: string) => {
                          if (!txt) return '';
                          return txt
                            .replace(/\*\*/g, '')
                            .replace(/\*/g, '')
                            .replace(/^###\s*/gm, '')
                            .replace(/^>\s*/gm, '')
                            .replace(/=>/g, '→')
                            .replace(/->/g, '→')
                            .trim();
                        };

                        const cleanQuestionText = formatCleanText(q.questionText);
                        const cleanExplanation = formatCleanText(q.explanation);

                        return (
                          <div
                            key={q.id}
                            className={`bg-white border rounded-2xl transition-all overflow-hidden shadow-xs hover:shadow-md ${
                              isMastered
                                ? 'border-emerald-300 bg-emerald-50/15 hover:border-emerald-400'
                                : 'border-slate-200 hover:border-amber-400'
                            }`}
                          >
                            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                              <div className="space-y-1.5 flex-1">
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <input
                                    type="checkbox"
                                    checked={selectedQuestionIds.includes(q.id)}
                                    onChange={() => toggleSelectQuestion(q.id)}
                                    className="w-4.5 h-4.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500/30 transition-all cursor-pointer mr-1 shrink-0"
                                    title="Select to form custom set"
                                  />
                                  <span className="px-2.5 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-black text-xs shadow-2xs">
                                    Q{idx + 1}
                                  </span>
                                  <span className="px-2.5 py-0.5 rounded-lg bg-amber-100/90 border border-amber-300 text-amber-950 font-black text-xs">
                                    {q.subject}
                                  </span>
                                  {q.category && (
                                    <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs">
                                      Topic: <strong className="text-slate-900">{q.category}</strong>
                                    </span>
                                  )}
                                  {isMastered && (
                                    <span className="px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 font-black flex items-center gap-1 text-xs">
                                      <Check className="w-3.5 h-3.5 text-emerald-700" /> 100% Mastered
                                    </span>
                                  )}
                                </div>

                                <h4 className="text-base sm:text-lg font-black text-slate-900 leading-snug tracking-tight pt-1">
                                  {cleanQuestionText}
                                </h4>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                  onClick={() => toggleExplanation(q.id)}
                                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-xs ${
                                    isOpenExp
                                      ? 'bg-slate-900 text-amber-400 hover:bg-slate-800'
                                      : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                                  }`}
                                >
                                  <Lightbulb className="w-4 h-4 stroke-[2.2]" />
                                  <span>{isOpenExp ? 'Hide Solution' : 'View Solution'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => { setEditingQuestion({ ...q }); setEditingQuestionIndex(idx); }}
                                  className="p-2 rounded-xl text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                                  title="Edit Question"
                                >
                                  <Pencil className="w-4.5 h-4.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteQuestion(q.id)}
                                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                  title="Delete Question"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Options Grid A, B, C, D */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                              {q.options.map((opt, oIdx) => {
                                const isCorrect = oIdx === q.correctOptionIndex;
                                const cleanOptText = formatCleanText(opt);

                                let cardStyle = 'bg-slate-50/80 border-slate-200 text-slate-800 hover:bg-amber-50/60 hover:border-amber-300';
                                let badgeStyle = 'bg-white text-slate-700 border border-slate-300';

                                if (isOpenExp && isCorrect) {
                                  cardStyle = 'bg-emerald-50 border-emerald-400 text-emerald-950 font-black ring-1 ring-emerald-400 shadow-xs';
                                  badgeStyle = 'bg-emerald-600 text-white shadow-xs';
                                }

                                return (
                                  <div
                                    key={oIdx}
                                    className={`p-3.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-start gap-3 transition-all ${cardStyle}`}
                                  >
                                    <span
                                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0 mt-0.5 ${badgeStyle}`}
                                    >
                                      {String.fromCharCode(65 + oIdx)}
                                    </span>
                                    <span className="leading-relaxed flex-1">{cleanOptText}</span>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Solution & Explanation Box (Clean Highlighted Block) */}
                            {isOpenExp && (
                              <div className="pt-3 border-t border-slate-200 space-y-3 animate-fadeIn">
                                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs sm:text-sm font-black flex items-center gap-2.5 shadow-2xs">
                                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 stroke-[2.2]" />
                                  <span>
                                    Correct Answer: Option {String.fromCharCode(65 + q.correctOptionIndex)} — {formatCleanText(q.options[q.correctOptionIndex])}
                                  </span>
                                </div>

                                <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-300 text-xs sm:text-sm text-slate-900 space-y-1.5 shadow-2xs">
                                  <div className="flex items-center gap-2 text-amber-950 font-black">
                                    <Lightbulb className="w-4.5 h-4.5 text-amber-600 stroke-[2.2]" />
                                    <span className="text-sm">Explanation & Solution (Vyakhya):</span>
                                  </div>
                                  <p className="leading-relaxed text-slate-800 font-bold pl-6">
                                    {cleanExplanation || 'No detailed explanation added.'}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
            </div>
          </div>
        )}
      </main>

      {/* ADD CUSTOM QUESTION MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-amber-300 rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-600 stroke-[3]" />
                <h3 className="text-lg font-black text-slate-900">Add Custom Question</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-900 text-sm p-1 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateQuestion} className="space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Subject</label>
                  <select
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold focus:outline-none focus:border-amber-500"
                  >
                    {DEFAULT_SUBJECTS.filter((s) => s !== 'All Subjects').map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Topic / Category</label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="e.g. Algebra, Formulas, GST"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Question Statement</label>
                <textarea
                  required
                  rows={3}
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  placeholder="Enter the question text here..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-700">Answer Options (4 Options)</label>
                {newOptions.map((opt, oIdx) => (
                  <div key={oIdx} className="flex items-center gap-2">
                    <span className="w-6 font-black text-amber-800 text-center">
                      {String.fromCharCode(65 + oIdx)}.
                    </span>
                    <input
                      type="text"
                      required
                      value={opt}
                      onChange={(e) => {
                        const copy = [...newOptions];
                        copy[oIdx] = e.target.value;
                        setNewOptions(copy);
                      }}
                      placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                      className="flex-1 bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold focus:outline-none focus:border-amber-500"
                    />
                    <input
                      type="radio"
                      name="correctOption"
                      checked={newCorrectIndex === oIdx}
                      onChange={() => setNewCorrectIndex(oIdx)}
                      className="w-4 h-4 accent-amber-600"
                      title="Select as Correct Answer"
                    />
                  </div>
                ))}
              </div>

              {/* Explanation */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Detailed Solution / Explanation
                </label>
                <textarea
                  rows={2}
                  value={newExplanation}
                  onChange={(e) => setNewExplanation(e.target.value)}
                  placeholder="Explain why this answer is correct..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-semibold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-extrabold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black shadow-sm"
                >
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK PDF / TEXT IMPORT MODAL */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-amber-300 rounded-3xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-xl overflow-y-auto max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-100 text-amber-900 border border-amber-300 shadow-xs">
                  <FileText className="w-6 h-6 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <span>Bulk PDF & Text Question Importer</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-300 font-extrabold uppercase">
                      Auto-AI Parser
                    </span>
                  </h3>
                  <p className="text-xs text-slate-600 font-bold">
                    Attach any PDF question file or paste raw text to parse and import 100s of questions at once.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {bulkImportSuccessMsg ? (
              <div className="p-8 text-center space-y-3 bg-emerald-50 border border-emerald-300 rounded-3xl animate-fadeIn">
                <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto animate-bounce" />
                <h4 className="text-2xl font-black text-emerald-950 tracking-tight">{bulkImportSuccessMsg}</h4>
                <p className="text-xs text-slate-700 font-bold">All questions have been loaded into your practice set & synced to cloud.</p>
              </div>
            ) : (
              <form onSubmit={handleExecuteBulkImport} className="space-y-5 text-xs sm:text-sm">
                {/* Compact PDF File Attachment Zone */}
                <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200 hover:border-amber-400 transition-all flex flex-wrap items-center justify-between gap-3">
                  <input
                    ref={pdfFileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handlePdfFileUpload}
                    className="hidden"
                  />
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                      {isPdfExtracting ? (
                        <RefreshCw className="w-5 h-5 animate-spin text-amber-700" />
                      ) : (
                        <Upload className="w-5 h-5 text-amber-700" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900">
                        {isPdfExtracting ? 'Extracting Text from PDF File...' : 'Attach PDF Question File'}
                      </p>
                      <p className="text-[11px] text-slate-600 font-semibold">
                        {isPdfExtracting
                          ? 'Reading pages, please wait...'
                          : 'Select any PDF file (.pdf) to extract and fill raw text automatically'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => pdfFileInputRef.current?.click()}
                    disabled={isPdfExtracting}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-amber-300 border border-slate-700 font-black text-xs shadow-xs transition-all flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span>Choose PDF File</span>
                  </button>
                </div>

                {/* Subject Selector with Manual Custom Subject Addition Option */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-black text-slate-700 text-xs">Default Subject Category</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomSubject(!isCustomSubject);
                        if (!isCustomSubject) setCustomSubject('');
                      }}
                      className="text-xs text-amber-800 hover:text-amber-950 font-black underline"
                    >
                      {isCustomSubject ? '← Select from Dropdown' : '+ Add Custom Subject Name'}
                    </button>
                  </div>

                  {isCustomSubject ? (
                    <input
                      type="text"
                      value={customSubject}
                      onChange={(e) => setCustomSubject(e.target.value)}
                      placeholder="Type custom subject name (e.g. Preventive & Social Medicine, Surgery)..."
                      className="w-full bg-white border border-amber-400 rounded-xl p-3 text-xs text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                    />
                  ) : (
                    <div className="relative">
                      <select
                        value={bulkSubject}
                        onChange={(e) => setBulkSubject(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl p-3 text-xs font-bold focus:outline-none focus:border-amber-500 cursor-pointer bg-white text-slate-900"
                      >
                        {availableSubjects.filter((s) => s !== 'All Subjects').map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                        {availableSubjects.length <= 1 && (
                          <>
                            <option value="Medical & Science">Medical & Science</option>
                            <option value="Mathematics">Mathematics</option>
                            <option value="Accounting & GST">Accounting & GST</option>
                            <option value="General Knowledge">General Knowledge</option>
                          </>
                        )}
                      </select>
                    </div>
                  )}
                </div>

                {/* Large Raw Text Box */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-black text-slate-700 text-xs">
                      Extracted / Raw Text (Questions, Options A-D, Answer & Explanations)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setBulkRawText(`Part 1: Medicine & Pediatrics (Q1 - Q50)
Q1. Which is the most common cause of Community-Acquired Pneumonia (CAP) worldwide?
(A) Mycoplasma pneumoniae
(B) Streptococcus pneumoniae
(C) Klebsiella pneumoniae
(D) Haemophilus influenzae
Answer: (B) Streptococcus pneumoniae
Explanation: Streptococcus pneumoniae (Pneumococcus) duniya bhar me Community-Acquired Pneumonia (CAP) ka sabse common bacterial cause hai.

Q2. A patient presents with chest pain. ECG shows ST elevation in leads II, III, and aVF. Which coronary artery is most likely occluded?
(A) Left anterior descending artery
(B) Right coronary artery
(C) Left circumflex artery
(D) Left main coronary artery
Answer: (B) Right coronary artery
Explanation: Leads II, III, aur aVF heart ke inferior wall ko represent karte hain. Inferior wall ki main blood supply Right Coronary Artery (RCA) se aati hai.`);
                      }}
                      className="text-xs text-amber-800 hover:text-amber-950 underline font-black"
                    >
                      Paste Sample PDF Text
                    </button>
                  </div>

                  <textarea
                    rows={14}
                    value={bulkRawText}
                    onChange={(e) => setBulkRawText(e.target.value)}
                    placeholder="Paste PDF raw text here or attach a PDF file above to extract text automatically..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-4 text-slate-900 font-sans text-xs font-semibold focus:outline-none focus:border-amber-500 leading-relaxed"
                  />
                </div>

                {/* Parser Result & Live Preview */}
                <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Brain className="w-5 h-5 text-amber-700" />
                      <div>
                        <p className="text-xs font-black text-slate-900">Live Parser Status:</p>
                        <p className="text-xs text-slate-600 font-semibold">
                          {parsedPreviewQuestions.length > 0
                            ? `Successfully detected ${parsedPreviewQuestions.length} complete questions with options & explanations!`
                            : 'Attach a PDF file or paste text above to start automatic parsing.'}
                        </p>
                      </div>
                    </div>

                    {parsedPreviewQuestions.length > 0 && (
                      <span className="px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-300 text-xs font-black flex items-center gap-1.5 shadow-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>{parsedPreviewQuestions.length} Questions Ready</span>
                      </span>
                    )}
                  </div>

                  {/* Sample Live Question Preview Card */}
                  {parsedPreviewQuestions.length > 0 && (
                    <div className="mt-2 p-3.5 rounded-xl bg-white border border-amber-200 space-y-2 text-xs">
                      <p className="text-[11px] font-black text-amber-800 uppercase tracking-wider">
                        Sample Preview (Question 1 of {parsedPreviewQuestions.length}):
                      </p>
                      <p className="font-black text-slate-900">{parsedPreviewQuestions[0].questionText}</p>
                      <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
                        {parsedPreviewQuestions[0].options.map((opt, oIdx) => (
                          <div
                            key={oIdx}
                            className={`p-1.5 px-2.5 rounded-lg border ${
                              oIdx === parsedPreviewQuestions[0].correctOptionIndex
                                ? 'bg-emerald-100 border-emerald-400 text-emerald-950 font-black'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            <span className="font-black mr-1">{String.fromCharCode(65 + oIdx)}.</span> {opt}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
                  <span className="text-xs text-slate-500 font-bold">
                    * Supports Q1., (A)-(D), Answer:, and Explanation: formats.
                  </span>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsBulkModalOpen(false)}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-extrabold hover:bg-slate-200"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={parsedPreviewQuestions.length === 0}
                      className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-950 text-xs font-black shadow-md flex items-center gap-2 transition-all transform hover:scale-[1.01]"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>
                        Import {parsedPreviewQuestions.length > 0 ? `${parsedPreviewQuestions.length} Questions` : 'Questions'}
                      </span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* AI MCQ GENERATOR MODAL */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-purple-300 rounded-3xl max-w-4xl w-full p-6 sm:p-8 space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-purple-100 text-purple-900 border border-purple-300 shadow-xs">
                  <Sparkles className="w-6 h-6 text-purple-700 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <span>AI Creator Hub</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-950 border border-purple-300 font-extrabold uppercase">
                      Powered by Gemini
                    </span>
                  </h3>
                  <p className="text-xs text-slate-600 font-bold">
                    Generate Quiz questions or structured Presentation slides from any study material.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const key = prompt("Enter your Gemini API Key:", aiApiKey);
                    if (key !== null) {
                      setAiApiKey(key);
                      localStorage.setItem('jrmd_gemini_api_key', key.trim());
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl text-slate-600 hover:text-purple-700 hover:bg-purple-50 transition-colors font-extrabold text-xs flex items-center gap-1 border border-slate-200"
                  title="Configure Gemini API Key"
                >
                  <span>⚙️ Set API Key</span>
                </button>
                <button
                  onClick={() => setIsAiModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors font-bold text-sm"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200">
              <button
                type="button"
                onClick={() => { setAiActiveTab('mcq'); setAiGeneratedQuestions([]); setAiSlides([]); }}
                className={`py-2.5 px-5 text-xs font-extrabold border-b-2 transition-all flex items-center gap-1.5 ${
                  aiActiveTab === 'mcq'
                    ? 'border-purple-600 text-purple-950 bg-purple-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Generate Quiz MCQs</span>
              </button>
              <button
                type="button"
                onClick={() => { setAiActiveTab('ppt'); setAiGeneratedQuestions([]); setAiSlides([]); }}
                className={`py-2.5 px-5 text-xs font-extrabold border-b-2 transition-all flex items-center gap-1.5 ${
                  aiActiveTab === 'ppt'
                    ? 'border-purple-600 text-purple-950 bg-purple-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Layers className="w-4 h-4 text-purple-600" />
                <span>Generate PPT Slides</span>
              </button>
            </div>

            {/* Form / Content */}
            <form onSubmit={aiActiveTab === 'mcq' ? handleGenerateAiMcqs : handleGenerateAiSlides} className="space-y-5 text-xs sm:text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Left Column: Topic text & OCR */}
                <div className="flex flex-col h-full space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-slate-700 text-xs">
                      Paste Topic Content / Study Material
                    </label>

                    {/* Image / Photo uploader trigger */}
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        id="ai-image-upload"
                        accept="image/*"
                        onChange={handleImageSelection}
                        className="hidden"
                      />
                      <label
                        htmlFor="ai-image-upload"
                        className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-black cursor-pointer flex items-center gap-1 transition-colors"
                        title="Upload a screenshot or photo of textbook/notes"
                      >
                        <ImageIcon className="w-3 h-3" />
                        <span>Upload Photo</span>
                      </label>
                      <label
                        htmlFor="ai-image-upload"
                        onClick={(e) => {
                          const input = document.getElementById('ai-image-upload') as HTMLInputElement;
                          if (input) {
                            input.setAttribute('capture', 'environment');
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-black cursor-pointer flex items-center gap-1 transition-colors"
                        title="Take a photo of physical textbook page using Camera"
                      >
                        <Camera className="w-3 h-3" />
                        <span>Camera</span>
                      </label>
                    </div>
                  </div>

                  {/* Selected Image Preview & Extraction Button */}
                  {selectedImageBase64 && (
                    <div className="p-3.5 rounded-2xl bg-purple-50/50 border border-purple-200 flex items-center justify-between gap-3 animate-in fade-in duration-200">
                      <div className="flex items-center gap-3">
                        <img
                          src={selectedImageBase64}
                          alt="selected notes"
                          className="w-12 h-12 object-cover rounded-lg border border-purple-300 shadow-xs"
                        />
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-black text-purple-950 uppercase tracking-wider">Image selected</p>
                          <p className="text-[9px] text-slate-500 font-bold">Ready to extract text with Gemini Vision AI</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isImageExtracting}
                          onClick={extractTextFromImage}
                          className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-[10px] font-black shadow-xs flex items-center gap-1 transition-all"
                        >
                          {isImageExtracting ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>Extracting...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3 text-purple-200" />
                              <span>Extract Text</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedImageBase64(null)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}

                  <textarea
                    required
                    value={aiTopicText}
                    onChange={(e) => setAiTopicText(e.target.value)}
                    placeholder="Paste your paragraph or topic text here, or upload/snap a photo of study notes/diagrams above..."
                    className="w-full flex-1 bg-slate-50 border border-slate-300 rounded-2xl p-4 text-slate-955 font-semibold focus:outline-none focus:border-purple-500 placeholder:text-slate-400 font-sans min-h-[300px]"
                  />
                </div>

                {/* Right Column: Settings and Parameters */}
                <div className="space-y-4">
                  {aiActiveTab === 'mcq' ? (
                    <>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1.5">Target Subject</label>
                        <CustomSelectPopover
                          value={aiSubject}
                          onChange={setAiSubject}
                          options={DEFAULT_SUBJECTS.filter((s) => s !== 'All Subjects').map((s) => {
                            let icon = <GraduationCap className="w-3.5 h-3.5" />;
                            if (s.toLowerCase().includes('medical') || s.toLowerCase().includes('science')) {
                              icon = <Brain className="w-3.5 h-3.5" />;
                            } else if (s.toLowerCase().includes('history') || s.toLowerCase().includes('social')) {
                              icon = <Bookmark className="w-3.5 h-3.5" />;
                            } else if (s.toLowerCase().includes('language') || s.toLowerCase().includes('lit')) {
                              icon = <BookOpen className="w-3.5 h-3.5" />;
                            }
                            return { value: s, label: s, icon };
                          })}
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1.5">Topic / Sub-category Name</label>
                        <input
                          type="text"
                          required
                          value={aiCategory}
                          onChange={(e) => setAiCategory(e.target.value)}
                          placeholder="e.g. Cardiac Anatomy, Surgery Risks, etc."
                          className="w-full bg-white border border-slate-200 rounded-xl h-9 px-3 text-xs text-slate-900 font-extrabold focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all shadow-xs"
                        />
                      </div>

                      {aiQuestionType === 'mixed' ? (
                        <div className="space-y-3">
                          <label className="block font-bold text-slate-700">📊 Questions per Type</label>
                          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-3.5 space-y-2.5">
                            {[
                              { key: 'mcq', label: 'MCQ (Factual / Direct)', badge: 'bg-purple-100 text-purple-800', badgeText: 'MCQ' },
                              { key: 'scenario', label: 'MCQ (Clinical Scenario)', badge: 'bg-indigo-100 text-indigo-800', badgeText: 'CS' },
                              { key: 'vsa', label: 'Very Short Answer', badge: 'bg-amber-100 text-amber-800', badgeText: 'VSA' },
                              { key: 'sa', label: 'Short Answer', badge: 'bg-teal-100 text-teal-800', badgeText: 'SA' },
                              { key: 'la', label: 'Long Answer / Essay', badge: 'bg-rose-100 text-rose-800', badgeText: 'LA' },
                            ].map(({ key, label, badge, badgeText }) => (
                              <div key={key} className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg shrink-0 ${badge}`}>{badgeText}</span>
                                  <span className="text-xs font-bold text-slate-700 truncate">{label}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setAiMixedCounts(prev => ({ ...prev, [key]: Math.max(0, (prev as any)[key] - 1) }))}
                                    className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 font-black text-base hover:bg-slate-100 flex items-center justify-center leading-none transition-colors"
                                  >−</button>
                                  <span className="w-7 text-center text-sm font-black text-slate-900">{(aiMixedCounts as any)[key]}</span>
                                  <button
                                    type="button"
                                    onClick={() => setAiMixedCounts(prev => ({ ...prev, [key]: Math.min(10, (prev as any)[key] + 1) }))}
                                    className="w-7 h-7 rounded-lg bg-purple-600 text-white font-black text-base hover:bg-purple-700 flex items-center justify-center leading-none transition-colors"
                                  >+</button>
                                </div>
                              </div>
                            ))}
                            <div className="pt-1.5 border-t border-purple-200 flex items-center justify-between">
                              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Total Questions</span>
                              <span className="text-sm font-black text-purple-700 bg-purple-100 px-3 py-0.5 rounded-full border border-purple-300">
                                {aiMixedCounts.mcq + aiMixedCounts.scenario + aiMixedCounts.vsa + aiMixedCounts.sa + aiMixedCounts.la}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block font-bold text-slate-700 mb-1.5">Number of Questions</label>
                            <CustomSelectPopover
                              value={aiCount}
                              onChange={setAiCount}
                              options={[
                                { value: 3, label: '3 Questions', icon: <HelpCircle className="w-3.5 h-3.5 text-slate-400" /> },
                                { value: 5, label: '5 Questions', icon: <HelpCircle className="w-3.5 h-3.5 text-slate-400" /> },
                                { value: 10, label: '10 Questions', icon: <HelpCircle className="w-3.5 h-3.5 text-slate-400" /> },
                                { value: 15, label: '15 Questions', icon: <HelpCircle className="w-3.5 h-3.5 text-slate-400" /> },
                                { value: 20, label: '20 Questions', icon: <HelpCircle className="w-3.5 h-3.5 text-slate-400" /> }
                              ]}
                            />
                          </div>

                          <div>
                            <label className="block font-bold text-slate-700 mb-1.5">Difficulty Level</label>
                            <CustomSelectPopover
                              value={aiDifficulty}
                              onChange={setAiDifficulty as any}
                              options={[
                                { value: 'Mixed', label: 'Mixed (All levels)', icon: <LayoutGrid className="w-3.5 h-3.5 text-slate-400" /> },
                                { value: 'Easy', label: 'Easy', icon: <Award className="w-3.5 h-3.5 text-green-500" /> },
                                { value: 'Medium', label: 'Medium', icon: <Award className="w-3.5 h-3.5 text-amber-500" /> },
                                { value: 'Hard', label: 'Hard', icon: <Award className="w-3.5 h-3.5 text-red-500" /> }
                              ]}
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block font-bold text-slate-700 mb-1.5">Question Type / Approach</label>
                        <CustomSelectPopover
                          value={aiQuestionType}
                          onChange={setAiQuestionType as any}
                          options={[
                            { value: 'factual', label: 'MCQ — Factual / Direct', desc: 'Multiple choice, direct concepts', icon: <BookOpen className="w-3.5 h-3.5 text-purple-500" /> },
                            { value: 'scenario', label: 'MCQ — Clinical Scenario', desc: 'Case-based MCQs', icon: <Brain className="w-3.5 h-3.5 text-indigo-500" /> },
                            { value: 'very_short', label: 'Very Short Answer', desc: '1 line / single term answer', icon: <span className="text-xs font-black text-amber-600">VSA</span> },
                            { value: 'short', label: 'Short Answer', desc: '2–4 sentences answer', icon: <span className="text-xs font-black text-teal-600">SA</span> },
                            { value: 'long', label: 'Long Answer / Essay', desc: 'Detailed 6–10 sentence answer', icon: <span className="text-xs font-black text-rose-600">LA</span> },
                            { value: 'mixed', label: '🎯 Mixed — All Types Together', desc: 'Set custom count per type', icon: <LayoutGrid className="w-3.5 h-3.5 text-violet-600" /> },
                          ]}
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1.5">🌐 Output Language</label>
                        <CustomSelectPopover
                          value={aiLanguage}
                          onChange={setAiLanguage as any}
                          options={[
                            { value: 'english', label: 'English', desc: 'All questions in English', icon: <span className="text-xs font-black">EN</span> },
                            { value: 'hindi', label: 'हिंदी (Pure Hindi)', desc: 'सब कुछ हिंदी में', icon: <span className="text-xs font-black">HI</span> },
                            { value: 'hinglish', label: 'Hinglish (मिश्रित)', desc: 'Hindi + English mix', icon: <span className="text-xs font-black">HE</span> }
                          ]}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1.5">Presentation Slide Count</label>
                        <CustomSelectPopover
                          value={aiSlidesCount}
                          onChange={setAiSlidesCount}
                          options={[
                            { value: 3, label: '3 Slides (Brief Summary)', icon: <Presentation className="w-3.5 h-3.5 text-slate-400" /> },
                            { value: 5, label: '5 Slides (Recommended)', icon: <Presentation className="w-3.5 h-3.5 text-slate-400" /> },
                            { value: 8, label: '8 Slides (Detailed)', icon: <Presentation className="w-3.5 h-3.5 text-slate-400" /> },
                            { value: 10, label: '10 Slides (Comprehensive)', icon: <Presentation className="w-3.5 h-3.5 text-slate-400" /> },
                            { value: 12, label: '12 Slides (Full Deck)', icon: <Presentation className="w-3.5 h-3.5 text-slate-400" /> }
                          ]}
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1.5">Slides Theme Style</label>
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { id: 'dark', label: 'Neo Dark', class: 'bg-slate-950 text-slate-100' },
                            { id: 'light', label: 'Warm Light', class: 'bg-slate-100 text-slate-900 border border-slate-300' },
                            { id: 'purple', label: 'Royal Purple', class: 'bg-purple-950 text-purple-100' },
                            { id: 'emerald', label: 'Teal Forest', class: 'bg-emerald-950 text-emerald-100' }
                          ].map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setAiSlidesTheme(t.id as any)}
                              className={`p-2 rounded-xl text-[10px] font-black text-center transition-all ${t.class} ${
                                aiSlidesTheme === t.id ? 'ring-2 ring-purple-600 ring-offset-2 scale-102 shadow-sm' : 'opacity-80 hover:opacity-100'
                              }`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1.5">🌐 Output Language</label>
                        <CustomSelectPopover
                          value={aiLanguage}
                          onChange={setAiLanguage as any}
                          options={[
                            { value: 'english', label: 'English', desc: 'Slides content in English', icon: <span className="text-xs font-black">EN</span> },
                            { value: 'hindi', label: 'हिंदी (Pure Hindi)', desc: 'स्लाइड हिंदी में', icon: <span className="text-xs font-black">HI</span> },
                            { value: 'hinglish', label: 'Hinglish (मिश्रित)', desc: 'Hindi + English mix', icon: <span className="text-xs font-black">HE</span> }
                          ]}
                        />
                      </div>

                      {savedPresentations.length > 0 && (
                        <div className="bg-purple-50/50 p-3.5 rounded-2xl border border-purple-200 space-y-2">
                          <label className="block font-black text-purple-950 text-[10px] uppercase tracking-wider">
                            📂 Open Saved Presentation
                          </label>
                          <CustomSelectPopover
                            value={activePresentationId || ''}
                            onChange={(val) => {
                              if (!val) {
                                setActivePresentationId(null);
                                return;
                              }
                              const pres = savedPresentations.find(p => p.id === val);
                              if (pres) {
                                setAiSlides(pres.slides);
                                setAiCategory(pres.category);
                                setAiTopicText(pres.topicText);
                                setAiSlidesTheme(pres.theme);
                                setCurrentSlideIndex(0);
                                setActivePresentationId(pres.id);
                              }
                            }}
                            placeholder="Choose a saved slide deck..."
                            options={savedPresentations.map((pres) => ({
                              value: pres.id,
                              label: `${pres.title} (${pres.slides.length} slides)`,
                              icon: <Presentation className="w-3.5 h-3.5 text-purple-600" />
                            }))}
                          />
                        </div>
                      )}

                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                        <span className="text-[10px] text-slate-600 font-extrabold uppercase tracking-wide block mb-1">How it works:</span>
                        <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                          AI generates structural slides from your text content. You can present them in our full-screen viewer or copy/export slide texts directly into Microsoft PowerPoint or Google Slides!
                        </p>
                      </div>
                    </>
                  )}

                  {rateLimitError && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 flex items-start gap-2.5 animate-in fade-in duration-200">
                      <span className="text-base">⚠️</span>
                      <div className="space-y-0.5">
                        <p className="font-extrabold text-[11px] uppercase tracking-wide">Rate Limit Encountered</p>
                        <p className="text-[10px] font-bold leading-normal text-amber-800">
                          Google Gemini API is temporarily busy. Retry in <span className="font-black text-amber-950 underline">{rateLimitCooldown}s</span>.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isAiGenerating || rateLimitCooldown > 0 || !aiTopicText.trim()}
                      className="w-full py-3.5 rounded-2xl bg-purple-700 hover:bg-purple-800 disabled:opacity-40 text-white font-black shadow-md flex items-center justify-center gap-2.5 transition-all transform hover:scale-[1.01]"
                    >
                      {isAiGenerating ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          <span>Generating content... Please wait</span>
                        </>
                      ) : rateLimitCooldown > 0 ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin text-purple-300" />
                          <span>Rate Limit Cooldown: {rateLimitCooldown}s</span>
                        </>
                      ) : (
                        <>
                          {aiActiveTab === 'mcq' ? (
                            <Sparkles className="w-5 h-5 text-purple-200" />
                          ) : (
                            <Layers className="w-5 h-5 text-purple-200" />
                          )}
                          <span>{aiActiveTab === 'mcq' ? 'Generate MCQs using AI' : 'Generate PPT Slides'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* AI Generated Preview Section for MCQs */}
              {aiActiveTab === 'mcq' && aiGeneratedQuestions.length > 0 && (
                <div className="bg-purple-50/50 border border-purple-200 rounded-3xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-purple-200 pb-3">
                    <span className="text-xs font-black text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-700" />
                      <span>AI Generated Questions Preview ({aiGeneratedQuestions.length})</span>
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handlePrintQuestionSet(aiGeneratedQuestions)}
                        className="px-5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-extrabold text-xs rounded-xl shadow-sm border border-amber-200 flex items-center gap-1.5 transition-colors"
                      >
                        <FileText className="w-4 h-4 text-amber-750" />
                        <span>Export PDF / Print Set</span>
                      </button>
                      <button
                        type="button"
                        onClick={startAiPracticeTest}
                        className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-colors"
                      >
                        <Target className="w-4 h-4 text-white" />
                        <span>🎯 Start Practice Test Now</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleImportAiQuestions}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-colors"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Import all to Quiz Bank</span>
                      </button>
                    </div>
                  </div>

                  {/* Inline Edit Panel */}
                  {editingQuestion !== null && editingQuestionIndex !== null && (
                    <div className="bg-white border-2 border-purple-400 rounded-2xl p-4 space-y-3 shadow-md">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-purple-800 uppercase tracking-wider">✏️ Editing Q{editingQuestionIndex + 1}</span>
                        <button type="button" onClick={() => { setEditingQuestion(null); setEditingQuestionIndex(null); }} className="text-slate-400 hover:text-slate-700 text-lg leading-none">&times;</button>
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-slate-600 mb-1 uppercase tracking-wide">Question</label>
                        <textarea
                          value={editingQuestion.questionText}
                          onChange={(e) => setEditingQuestion((q: any) => ({ ...q, questionText: e.target.value }))}
                          rows={2}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-purple-400 resize-none"
                        />
                      </div>
                      {(editingQuestion.options && editingQuestion.options.length > 0) ? (
                        <div>
                          <label className="block text-[11px] font-black text-slate-600 mb-1.5 uppercase tracking-wide">Options</label>
                          <div className="space-y-1.5">
                            {editingQuestion.options.map((opt: string, oIdx: number) => (
                              <div key={oIdx} className="flex items-center gap-2">
                                <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${
                                  oIdx === editingQuestion.correctOptionIndex ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
                                }`}>{String.fromCharCode(65 + oIdx)}</span>
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => {
                                    const newOpts = [...editingQuestion.options];
                                    newOpts[oIdx] = e.target.value;
                                    setEditingQuestion((q: any) => ({ ...q, options: newOpts }));
                                  }}
                                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-purple-400"
                                />
                                <button
                                  type="button"
                                  onClick={() => setEditingQuestion((q: any) => ({ ...q, correctOptionIndex: oIdx }))}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-black transition-colors ${
                                    oIdx === editingQuestion.correctOptionIndex
                                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                      : 'bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'
                                  }`}
                                >✓ Correct</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[11px] font-black text-slate-600 mb-1 uppercase tracking-wide">Answer</label>
                          <textarea
                            value={editingQuestion.answer || ''}
                            onChange={(e) => setEditingQuestion((q: any) => ({ ...q, answer: e.target.value }))}
                            rows={3}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-purple-400 resize-none"
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-[11px] font-black text-slate-600 mb-1 uppercase tracking-wide">Explanation</label>
                        <textarea
                          value={editingQuestion.explanation || ''}
                          onChange={(e) => setEditingQuestion((q: any) => ({ ...q, explanation: e.target.value }))}
                          rows={3}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-purple-400 resize-none"
                        />
                      </div>
                      <div className="flex gap-2 justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => { setEditingQuestion(null); setEditingQuestionIndex(null); }}
                          className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                        >Cancel</button>
                        <button
                          type="button"
                          onClick={() => {
                            handleSaveQuestionEdit(editingQuestion);
                          }}
                          className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" /> Save Changes
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="max-h-72 overflow-y-auto space-y-4 pr-2">
                    {aiGeneratedQuestions.map((q, idx) => (
                      <div key={q.id} className="bg-white p-4 rounded-2xl border border-purple-100 space-y-2.5 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                          <span className="font-extrabold text-slate-900 text-xs sm:text-sm flex-1">
                            Q{idx + 1}. {q.questionText}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-extrabold uppercase ${
                              q.options?.length > 0 ? 'bg-purple-100 text-purple-950 border border-purple-200' :
                              (q.questionType === 'very_short' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                              q.questionType === 'long' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                              'bg-teal-100 text-teal-800 border border-teal-200')
                            }`}>
                              {q.options?.length > 0 ? 'MCQ' : (q.questionType === 'very_short' ? 'VSA' : q.questionType === 'long' ? 'LA' : 'SA')}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-extrabold uppercase">{q.difficulty}</span>
                            <button
                              type="button"
                              onClick={() => { setEditingQuestion({ ...q }); setEditingQuestionIndex(idx); }}
                              className="p-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-600 border border-purple-200 transition-colors"
                              title="Edit this question"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {q.options && q.options.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-1.5">
                            {q.options.map((opt: string, oIdx: number) => (
                              <div
                                key={oIdx}
                                className={`px-3 py-2 rounded-xl text-xs font-bold ${
                                  oIdx === q.correctOptionIndex
                                    ? 'bg-emerald-50 text-emerald-950 border border-emerald-300'
                                    : 'bg-slate-50 text-slate-600 border border-slate-100'
                                }`}
                              >
                                <span className="font-black text-[11px] mr-1">
                                  {String.fromCharCode(65 + oIdx)}.
                                </span>
                                {opt}
                              </div>
                            ))}
                          </div>
                        )}

                        {q.answer && (
                          <div className="text-xs bg-emerald-50/80 p-2.5 rounded-xl text-emerald-900 border border-emerald-200">
                            <span className="font-black text-emerald-800 mr-1">Answer:</span>
                            {q.answer}
                          </div>
                        )}

                        {q.explanation && (
                          <div className="text-xs bg-slate-50/80 p-2.5 rounded-xl text-slate-700 border border-slate-100">
                            <span className="font-black text-slate-900 mr-1">Explanation:</span>
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Generated Preview Section for Slides (PPT Presenter) */}
              {aiActiveTab === 'ppt' && aiSlides.length > 0 && (
                <div className="bg-purple-50/50 border border-purple-200 rounded-3xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-purple-200 pb-3">
                    <span className="text-xs font-black text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-purple-700" />
                      <span>Interactive Presentation Viewer ({aiSlides.length} Slides)</span>
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {savedPresentations.length > 0 && (
                        <select
                          value={activePresentationId || ''}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            if (!selectedId) {
                              setActivePresentationId(null);
                              return;
                            }
                            const pres = savedPresentations.find(p => p.id === selectedId);
                            if (pres) {
                              setAiSlides(pres.slides);
                              setAiCategory(pres.category);
                              setAiTopicText(pres.topicText);
                              setAiSlidesTheme(pres.theme);
                              setCurrentSlideIndex(0);
                              setActivePresentationId(pres.id);
                            }
                          }}
                          className="bg-purple-100 text-purple-950 border border-purple-300 rounded-xl py-1.5 px-3 font-black text-xs focus:outline-none focus:border-purple-500 cursor-pointer shadow-xs"
                        >
                          <option value="">📂 Open Saved PPT ({savedPresentations.length})</option>
                          {savedPresentations.map((pres) => (
                            <option key={pres.id} value={pres.id}>
                              {pres.title} ({pres.slides.length} slides)
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        type="button"
                        onClick={handleCopySlidesContent}
                        className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-950 font-black text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors border border-purple-300"
                      >
                        <Share2 className="w-4 h-4 text-purple-700" />
                        <span>Copy Text</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSavePresentation}
                        className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-black text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-colors"
                      >
                        <Bookmark className="w-4 h-4 text-purple-200 fill-current" />
                        <span>Save to My Slides</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsPptFullScreen(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-colors border border-indigo-500"
                      >
                        <Eye className="w-4 h-4 text-indigo-200" />
                        <span>Play Fullscreen</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadPptx}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-colors"
                      >
                        <Upload className="w-4 h-4 text-white rotate-180" />
                        <span>Download PowerPoint (.pptx)</span>
                      </button>
                    </div>
                  </div>

                  {/* Active Slide Display */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Slides List sidebar */}
                    <div className="lg:col-span-1 border border-purple-200 bg-white rounded-2xl p-3 max-h-60 overflow-y-auto space-y-1.5">
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase block mb-1">Slide Outline</span>
                      {aiSlides.map((slide, sIdx) => (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => setCurrentSlideIndex(sIdx)}
                          className={`w-full text-left p-2 rounded-xl text-xs font-bold transition-all border ${
                            currentSlideIndex === sIdx
                              ? 'bg-purple-50 text-purple-950 border-purple-300'
                              : 'bg-transparent text-slate-600 border-transparent hover:bg-slate-50'
                          }`}
                        >
                          {sIdx + 1}. {slide.title}
                        </button>
                      ))}
                    </div>

                    {/* Active Slide Board */}
                    {(() => {
                      const themeStyles = {
                        dark: {
                          bg: "bg-slate-950 text-slate-100 border border-slate-800 shadow-2xl",
                          titleColor: "text-purple-300",
                          bulletColor: "bg-purple-400",
                          borderColor: "border-slate-800/80",
                          navBtn: "border-slate-800 hover:bg-slate-900 text-slate-300",
                          accent: "text-purple-400",
                          textColor: "text-slate-300",
                          titleText: "text-white"
                        },
                        purple: {
                          bg: "bg-gradient-to-br from-purple-900 to-indigo-950 text-purple-100 border border-purple-800/40 shadow-2xl",
                          titleColor: "text-pink-300",
                          bulletColor: "bg-pink-400",
                          borderColor: "border-purple-800/50",
                          navBtn: "border-purple-800 hover:bg-purple-900/60 text-purple-200",
                          accent: "text-pink-400",
                          textColor: "text-purple-200",
                          titleText: "text-white"
                        },
                        emerald: {
                          bg: "bg-gradient-to-br from-emerald-900 to-teal-950 text-emerald-100 border border-emerald-800/40 shadow-2xl",
                          titleColor: "text-teal-300",
                          bulletColor: "bg-teal-400",
                          borderColor: "border-emerald-800/50",
                          navBtn: "border-emerald-800 hover:bg-emerald-900/60 text-emerald-200",
                          accent: "text-teal-400",
                          textColor: "text-teal-200",
                          titleText: "text-white"
                        },
                        light: {
                          bg: "bg-white text-slate-900 border border-slate-200 shadow-md",
                          titleColor: "text-purple-700",
                          bulletColor: "bg-purple-600",
                          borderColor: "border-slate-200",
                          navBtn: "border-slate-300 hover:bg-slate-200 text-slate-700",
                          accent: "text-purple-600",
                          textColor: "text-slate-600",
                          titleText: "text-slate-900"
                        }
                      };
                      const activeTheme = themeStyles[aiSlidesTheme] || themeStyles.dark;

                      const getSlideIcon = (idx: number) => {
                        const icons = [
                          <Sparkles className="w-4 h-4" />,
                          <Target className="w-4 h-4" />,
                          <Flame className="w-4 h-4" />,
                          <Trophy className="w-4 h-4" />,
                          <Brain className="w-4 h-4" />,
                          <Lightbulb className="w-4 h-4" />,
                          <Award className="w-4 h-4" />
                        ];
                        return icons[idx % icons.length];
                      };

                      return (
                        <div className={`lg:col-span-2 rounded-3xl p-6.5 min-h-[340px] flex flex-col justify-between relative overflow-hidden transition-all ${activeTheme.bg}`}>
                          {/* Decorative Top Accent Strip */}
                          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 z-30" />

                          <style>{`
                            @keyframes slideIn {
                              from { opacity: 0; transform: translateY(6px); }
                              to { opacity: 1; transform: translateY(0); }
                            }
                            .animate-slide-in {
                              animation: slideIn 0.25s ease-out forwards;
                            }
                          `}</style>

                          <div key={currentSlideIndex} className="space-y-5 animate-slide-in flex-1">
                            <div className={`flex items-center justify-between border-b pb-3.5 ${activeTheme.borderColor}`}>
                              <h4 className={`text-base sm:text-lg font-black tracking-tight uppercase ${activeTheme.titleColor}`}>
                                {aiSlides[currentSlideIndex]?.title}
                              </h4>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 text-[10px]">
                                  <span className="font-bold opacity-80">Layout:</span>
                                  <select
                                    value={aiSlides[currentSlideIndex]?.layoutType || 'standard'}
                                    onChange={(e) => {
                                      const newLayout = e.target.value;
                                      const updatedSlides = [...aiSlides];
                                      updatedSlides[currentSlideIndex] = {
                                        ...updatedSlides[currentSlideIndex],
                                        layoutType: newLayout
                                      };
                                      setAiSlides(updatedSlides);
                                    }}
                                    className="bg-slate-900/60 text-slate-100 border border-slate-700/60 rounded-lg py-1 px-2 font-black focus:outline-none focus:border-purple-500 cursor-pointer"
                                  >
                                    <option value="standard">Standard list</option>
                                    <option value="timeline">Timeline flow</option>
                                    <option value="objectives">3D Ribbons</option>
                                    <option value="hub">Central Hub</option>
                                    <option value="grid">2x2 Grid</option>
                                    <option value="split">Split Highlight</option>
                                    <option value="columns">Key Pillars</option>
                                    <option value="cycle">Cycle Wheel</option>
                                    <option value="workflow">Workflow Path</option>
                                    <option value="target">Target Arch</option>
                                  </select>
                                </div>
                                <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold ${activeTheme.borderColor} ${activeTheme.accent}`}>
                                  Slide {currentSlideIndex + 1} of {aiSlides.length}
                                </span>
                              </div>
                            </div>
                            {(() => {
                              const slide = aiSlides[currentSlideIndex];
                              // Programmatically rotate layouts to guarantee variation if AI returns standard
                              let layout = slide?.layoutType || 'standard';
                              if (layout === 'standard') {
                                const layouts = ['standard', 'timeline', 'objectives', 'hub', 'grid', 'split', 'columns', 'cycle', 'workflow', 'target'];
                                layout = layouts[currentSlideIndex % layouts.length];
                              }

                              const isLight = aiSlidesTheme === 'light';
                              const localTheme = themeStyles[aiSlidesTheme] || themeStyles.dark;
                              const activeTheme = {
                                ...localTheme,
                                titleText: isLight ? "text-slate-100" : localTheme.titleText
                              };
                              const getAdaptedColors = (idx: number) => {
                                const darkColors = [
                                  { border: "border-teal-500/30", bg: "from-teal-500/10 to-teal-950/40 text-teal-100", text: "text-teal-400", badge: "bg-teal-500/20 text-teal-300", iconBg: "bg-teal-900/50 text-teal-400", strip: "border-l-4 border-l-teal-500", stripTop: "border-t-4 border-t-teal-500" },
                                  { border: "border-amber-500/30", bg: "from-amber-500/10 to-amber-950/40 text-amber-100", text: "text-amber-400", badge: "bg-amber-500/20 text-amber-300", iconBg: "bg-amber-900/50 text-amber-400", strip: "border-l-4 border-l-amber-500", stripTop: "border-t-4 border-t-amber-500" },
                                  { border: "border-cyan-500/30", bg: "from-cyan-500/10 to-cyan-950/40 text-cyan-100", text: "text-cyan-400", badge: "bg-cyan-500/20 text-cyan-300", iconBg: "bg-cyan-900/50 text-cyan-400", strip: "border-l-4 border-l-cyan-500", stripTop: "border-t-4 border-t-cyan-500" },
                                  { border: "border-rose-500/30", bg: "from-rose-500/10 to-rose-950/40 text-rose-100", text: "text-rose-400", badge: "bg-rose-500/20 text-rose-300", iconBg: "bg-rose-900/50 text-rose-400", strip: "border-l-4 border-l-rose-500", stripTop: "border-t-4 border-t-rose-500" },
                                  { border: "border-purple-500/30", bg: "from-purple-500/10 to-purple-950/40 text-purple-100", text: "text-purple-400", badge: "bg-purple-500/20 text-purple-300", iconBg: "bg-purple-900/50 text-purple-400", strip: "border-l-4 border-l-purple-500", stripTop: "border-t-4 border-t-purple-500" }
                                ];
                                const lightColors = [
                                  { border: "border-[#3f36d2]", bg: "from-[#4f46e5] to-[#4f46e5] text-white", text: "text-white", badge: "bg-[#312e81] text-white border-none", iconBg: "bg-[#312e81] text-white", strip: "border-l-4 border-l-[#1e1b4b]", stripTop: "border-t-4 border-t-[#1e1b4b]" },
                                  { border: "border-[#6d28d9]", bg: "from-[#7c3aed] to-[#7c3aed] text-white", text: "text-white", badge: "bg-[#4c1d95] text-white border-none", iconBg: "bg-[#4c1d95] text-white", strip: "border-l-4 border-l-[#2e1065]", stripTop: "border-t-4 border-t-[#2e1065]" },
                                  { border: "border-[#047857]", bg: "from-[#059669] to-[#059669] text-white", text: "text-white", badge: "bg-[#064e3b] text-white border-none", iconBg: "bg-[#064e3b] text-white", strip: "border-l-4 border-l-[#022c22]", stripTop: "border-t-4 border-t-[#022c22]" },
                                  { border: "border-[#d97706]", bg: "from-[#f59e0b] to-[#f59e0b] text-white", text: "text-white", badge: "bg-[#78350f] text-white border-none", iconBg: "bg-[#78350f] text-white", strip: "border-l-4 border-l-[#451a03]", stripTop: "border-t-4 border-t-[#451a03]" },
                                  { border: "border-[#be123c]", bg: "from-[#f43f5e] to-[#f43f5e] text-white", text: "text-white", badge: "bg-[#881337] text-white border-none", iconBg: "bg-[#881337] text-white", strip: "border-l-4 border-l-[#4c0519]", stripTop: "border-t-4 border-t-[#4c0519]" },
                                  { border: "border-[#334155]", bg: "from-[#475569] to-[#475569] text-white", text: "text-white", badge: "bg-[#1e293b] text-white border-none", iconBg: "bg-[#1e293b] text-white", strip: "border-l-4 border-l-[#0f172a]", stripTop: "border-t-4 border-t-[#0f172a]" }
                                ];
                                return isLight ? lightColors[idx % lightColors.length] : darkColors[idx % darkColors.length];
                              };

                              if (layout === 'timeline') {
                                return (
                                  <div className="relative pt-6 pb-2">
                                    <div className={`absolute top-12 left-10 right-10 h-0.5 border-t-2 border-dashed ${isLight ? 'border-slate-300' : 'border-slate-800'} hidden sm:block z-0`} />
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-4 relative z-10">
                                      {slide.bulletPoints.map((bp: string, bpIdx: number) => {
                                        const col = getAdaptedColors(bpIdx);
                                        return (
                                          <div key={bpIdx} className={`p-4 rounded-2xl border ${col.border} ${col.stripTop} bg-gradient-to-b ${col.bg} backdrop-blur-md flex flex-col items-center text-center space-y-3 shadow-md hover:-translate-y-0.5 transition-transform duration-300`}>
                                            <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${col.badge} shadow-sm shrink-0 border border-white/20`}>
                                              {bpIdx + 1}
                                            </span>
                                            <div className="space-y-1">
                                              <p className={`text-[9px] uppercase font-black tracking-widest ${col.text}`}>Step {bpIdx + 1}</p>
                                              <p className={`text-[11px] font-extrabold leading-relaxed ${activeTheme.titleText}`}>{bp}</p>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              }

                              if (layout === 'grid') {
                                return (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                    {slide.bulletPoints.map((bp: string, bpIdx: number) => {
                                      const col = getAdaptedColors(bpIdx);
                                      return (
                                        <div key={bpIdx} className={`p-4 rounded-2xl border ${col.border} ${col.strip} bg-gradient-to-br ${col.bg} backdrop-blur-md flex items-start gap-3.5 shadow-sm hover:-translate-y-0.5 transition-transform`}>
                                          <div className={`p-2 rounded-xl ${col.iconBg} shrink-0 shadow-sm border border-white/10`}>
                                            {getSlideIcon(bpIdx)}
                                          </div>
                                          <div className="space-y-1 flex-1">
                                            <span className={`text-[9px] uppercase font-black tracking-widest ${col.text}`}>Pillar 0{bpIdx + 1}</span>
                                            <p className={`text-xs font-bold leading-relaxed ${activeTheme.titleText}`}>{bp}</p>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              }

                              if (layout === 'objectives') {
                                return (
                                  <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-center pt-2">
                                    <div className="md:col-span-3 space-y-4 pr-3 pl-5">
                                      {slide.bulletPoints.map((bp: string, bpIdx: number) => {
                                        const col = getAdaptedColors(bpIdx);
                                        return (
                                          <div key={bpIdx} className="relative z-10 flex items-center group">
                                            <div className={`flex-1 pl-10 pr-4 py-3 rounded-r-3xl rounded-bl-3xl border-l-4 border-l-current ${col.border} bg-gradient-to-r ${col.bg} shadow-md flex items-center justify-between relative`}>
                                              <div className="absolute left-[-4px] top-[100%] w-0 h-0 border-t-[6px] border-r-[6px] border-b-[6px] border-l-[6px] border-transparent"
                                                   style={{ borderTopColor: 'currentColor', borderRightColor: 'currentColor', opacity: 0.8 }} />

                                              <div className={`absolute -left-5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center font-black text-xs border-2 shadow-md ${col.badge} border-white`}>
                                                {bpIdx + 1}
                                              </div>

                                              <p className={`text-xs font-bold leading-relaxed pr-2 ${activeTheme.titleText}`}>{bp}</p>
                                              
                                              <div className={`w-8 h-8 rounded-full ${isLight ? 'bg-slate-200/50' : 'bg-white/5'} border border-white/10 flex items-center justify-center shadow-xs shrink-0 ml-3 ${col.text}`}>
                                                {getSlideIcon(bpIdx)}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>

                                    <div className={`md:col-span-2 p-6 rounded-3xl border ${isLight ? 'bg-slate-100/60 border-slate-200 text-slate-800' : 'bg-gradient-to-br from-indigo-950/20 to-purple-950/30 border-purple-500/25 text-purple-100'} flex flex-col justify-center min-h-[220px] text-center md:text-left shadow-sm`}>
                                      <span className={`text-[10px] uppercase font-black tracking-widest ${activeTheme.accent} block mb-1`}>Structure Outline</span>
                                      <h3 className={`text-base font-black leading-tight mb-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>{slide.title}</h3>
                                      <p className={`text-[11px] font-semibold leading-relaxed ${activeTheme.textColor}`}>
                                        Each point represents a critical layer of this concept. Hover/explore each step to master the study targets.
                                      </p>
                                    </div>
                                  </div>
                                );
                              }

                              if (layout === 'split') {
                                return (
                                  <div className="grid grid-cols-1 md:grid-cols-5 gap-5 pt-2">
                                    <div className={`md:col-span-2 p-5.5 rounded-3xl border ${isLight ? 'bg-purple-100/50 border-purple-200 border-l-4 border-l-purple-600' : 'border-purple-500/30 bg-gradient-to-br from-purple-800/30 to-indigo-950/20 border-l-4 border-l-purple-400'} flex flex-col justify-center space-y-5 shadow-md min-h-[180px]`}>
                                      <div className={`p-2.5 ${isLight ? 'bg-purple-600 text-white shadow-xs' : 'bg-purple-500 text-white'} rounded-xl w-fit animate-pulse`}>
                                        <Brain className="w-5 h-5" />
                                      </div>
                                      <div className="space-y-1">
                                        <span className={`text-[9px] font-black uppercase tracking-widest ${isLight ? 'text-purple-700' : 'text-purple-300'}`}>Key Theme</span>
                                        <p className={`text-sm sm:text-base font-black leading-relaxed ${isLight ? 'text-purple-955' : 'text-white'}`}>{slide.bulletPoints[0]}</p>
                                      </div>
                                    </div>
                                    <div className="md:col-span-3 space-y-3">
                                      {slide.bulletPoints.slice(1).map((bp: string, bpIdx: number) => {
                                        const col = getAdaptedColors(bpIdx + 1);
                                        return (
                                          <div key={bpIdx} className={`p-3.5 rounded-2xl border ${col.border} ${col.strip} bg-gradient-to-r ${col.bg} flex items-start gap-3 shadow-xs hover:scale-[1.01] transition-transform`}>
                                            <span className={`p-1.5 rounded-lg ${col.iconBg} shrink-0`}>
                                              {getSlideIcon(bpIdx + 1)}
                                            </span>
                                            <p className={`text-xs font-bold leading-normal ${activeTheme.titleText}`}>{bp}</p>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              }

                              if (layout === 'hub') {
                                const leftBullets = slide.bulletPoints.filter((_, i) => i % 2 === 0);
                                const rightBullets = slide.bulletPoints.filter((_, i) => i % 2 !== 0);

                                return (
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center pt-2 relative">
                                    <div className="space-y-3.5 z-10">
                                      {leftBullets.map((bp: string, idx: number) => {
                                        const originalIdx = idx * 2;
                                        const col = getAdaptedColors(originalIdx);
                                        return (
                                          <div key={idx} className={`p-3 rounded-2xl border ${col.border} ${col.strip} bg-gradient-to-r ${col.bg} flex items-start gap-3 shadow-md transform hover:scale-101 transition-all`}>
                                            <div className={`p-2 rounded-xl ${col.iconBg} shrink-0`}>
                                              {getSlideIcon(originalIdx)}
                                            </div>
                                            <div>
                                              <span className={`text-[8px] uppercase font-black tracking-widest ${col.text}`}>Section 0{originalIdx + 1}</span>
                                              <p className={`text-xs sm:text-[13px] font-bold leading-normal ${activeTheme.titleText}`}>{bp}</p>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>

                                    <div className="flex justify-center items-center relative z-20 py-2">
                                      <div className={`w-32 h-32 rounded-full border-4 border-dashed ${isLight ? 'bg-white border-purple-400' : 'bg-slate-900 border-purple-500/40'} shadow-2xl flex items-center justify-center text-center p-4 relative overflow-hidden group`}>
                                        <div className="absolute inset-0 bg-purple-500/5 animate-[pulse_3s_infinite]" />
                                        <p className={`text-[12px] font-black leading-tight uppercase select-none tracking-wide ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                          {slide.title}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="space-y-3.5 z-10">
                                      {rightBullets.map((bp: string, idx: number) => {
                                        const originalIdx = idx * 2 + 1;
                                        const col = getAdaptedColors(originalIdx);
                                        return (
                                          <div key={idx} className={`p-3 rounded-2xl border ${col.border} ${col.strip} bg-gradient-to-r ${col.bg} flex items-start gap-3 shadow-md transform hover:scale-101 transition-all`}>
                                            <div className="flex-1 text-right">
                                              <span className={`text-[8px] uppercase font-black tracking-widest ${col.text}`}>Section 0{originalIdx + 1}</span>
                                              <p className={`text-xs sm:text-[13px] font-bold leading-normal ${activeTheme.titleText}`}>{bp}</p>
                                            </div>
                                            <div className={`p-2 rounded-xl ${col.iconBg} shrink-0`}>
                                              {getSlideIcon(originalIdx)}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              }

                              if (layout === 'columns') {
                                return (
                                  <div className="space-y-5 pt-2">
                                    <div className="flex flex-col items-center">
                                      <div className="px-5 py-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-[10px] shadow-md relative uppercase tracking-wider">
                                        <span>Key Pillars & Core Concepts</span>
                                        <div className="absolute top-[100%] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-blue-600" />
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                                      {slide.bulletPoints.map((bp: string, bpIdx: number) => {
                                        const col = getAdaptedColors(bpIdx);
                                        return (
                                          <div key={bpIdx} className={`p-4 rounded-3xl border ${col.border} ${col.stripTop} bg-gradient-to-b ${col.bg} shadow-lg flex flex-col items-center text-center space-y-3.5 transform hover:scale-102 transition-all min-h-[170px]`}>
                                            <div className={`p-2.5 rounded-full ${col.iconBg} shadow-inner`}>
                                              {getSlideIcon(bpIdx)}
                                            </div>
                                            <div className="space-y-1 flex-1 flex flex-col justify-center">
                                              <h5 className={`text-[10px] font-black uppercase tracking-wider ${col.text}`}>Focus 0{bpIdx + 1}</h5>
                                              <p className={`text-xs sm:text-[13px] font-bold leading-relaxed ${activeTheme.titleText}`}>{bp}</p>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              }

                              if (layout === 'cycle') {
                                return (
                                  <div className="space-y-6 pt-2">
                                    <div className="flex justify-center items-center">
                                      <div className={`relative w-24 h-24 flex items-center justify-center rounded-full border-4 border-dashed ${isLight ? 'border-teal-300 bg-white' : 'border-teal-500/30'} animate-[spin_25s_linear_infinite]`}>
                                        <div className={`absolute w-18 h-18 rounded-full border-4 border-double ${isLight ? 'border-amber-300' : 'border-amber-500/30'} flex items-center justify-center`}>
                                          <RefreshCw className="w-6 h-6 text-teal-500 animate-pulse" />
                                        </div>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                      {slide.bulletPoints.map((bp: string, bpIdx: number) => {
                                        const col = getAdaptedColors(bpIdx);
                                        return (
                                          <div key={bpIdx} className="flex flex-col items-center text-center space-y-2">
                                            <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border-2 shadow-md ${isLight ? 'bg-teal-500 text-white' : col.badge} border-white`}>
                                              0{bpIdx + 1}
                                            </span>
                                            <div className="space-y-1">
                                              <span className={`text-[9px] uppercase font-black tracking-widest ${col.text}`}>Phase 0{bpIdx + 1}</span>
                                              <p className={`text-xs sm:text-[13px] font-bold leading-relaxed ${isLight ? 'text-slate-900' : 'text-white'}`}>{bp}</p>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              }

                              if (layout === 'workflow') {
                                return (
                                  <div className="grid grid-cols-1 md:grid-cols-10 gap-4 items-center pt-2 relative">
                                    <div className={`md:col-span-3 flex flex-col items-center justify-center p-4 rounded-3xl border ${isLight ? 'bg-slate-100 border-slate-200 border-l-4 border-l-purple-500' : 'bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800 border-l-4 border-l-purple-500'} shadow-xl relative min-h-[140px] text-center`}>
                                      <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/5 to-transparent rounded-3xl" />
                                      <div className={`w-11 h-11 rounded-full border-2 ${isLight ? 'border-purple-300 bg-white' : 'border-purple-500/50 bg-slate-900'} flex items-center justify-center mb-2 shadow-inner`}>
                                        <Brain className="w-6 h-6 text-purple-500 animate-pulse" />
                                      </div>
                                      <span className={`text-[8px] uppercase font-black tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Core Workflow</span>
                                      <p className={`text-[10px] font-black leading-tight mt-1 ${activeTheme.titleText}`}>{slide.title}</p>
                                    </div>

                                    <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-4 gap-3 relative">
                                      <div className={`absolute top-1/2 left-4 right-4 h-0.5 border-t border-dashed ${isLight ? 'border-slate-300' : 'border-slate-700'} hidden sm:block z-0`} />
                                      
                                      {slide.bulletPoints.map((bp: string, bpIdx: number) => {
                                        const col = getAdaptedColors(bpIdx);
                                        return (
                                          <div key={bpIdx} className={`p-3 rounded-2xl border ${col.border} ${col.strip} bg-gradient-to-b ${col.bg} relative z-10 flex flex-col justify-between space-y-3 shadow-md transform hover:-translate-y-1 transition-all min-h-[140px]`}>
                                            <div className="flex items-center justify-between">
                                              <span className={`text-[9px] font-black uppercase tracking-wider ${col.text}`}>Step 0{bpIdx + 1}</span>
                                              <div className={`${col.text}`}>
                                                {getSlideIcon(bpIdx)}
                                              </div>
                                            </div>
                                            <p className={`text-[11px] font-extrabold leading-normal flex-1 flex items-center ${activeTheme.titleText}`}>
                                              {bp}
                                            </p>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              }

                              if (layout === 'target') {
                                return (
                                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center pt-2">
                                    <div className="md:col-span-4 flex justify-center py-2">
                                      <div className={`w-32 h-32 rounded-full border-8 ${isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-900/60'} shadow-xl flex items-center justify-center relative overflow-hidden group`}>
                                        <div className="absolute w-24 h-24 rounded-full border-4 border-dashed border-red-500/40 animate-[spin_10s_linear_infinite]" />
                                        <div className="absolute w-16 h-16 rounded-full border-4 border-double border-yellow-500/30" />
                                        <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center shadow-inner relative z-10 animate-pulse">
                                          <Target className="w-4 h-4 text-white" />
                                        </div>
                                      </div>
                                    </div>

                                    <div className="md:col-span-8 space-y-2.5">
                                      {slide.bulletPoints.map((bp: string, bpIdx: number) => {
                                        const col = getAdaptedColors(bpIdx);
                                        return (
                                          <div key={bpIdx} className={`p-3 rounded-2xl border ${col.border} ${col.strip} bg-gradient-to-r ${col.bg} flex items-center justify-between shadow-xs hover:scale-[1.01] transition-transform`}>
                                            <div className="flex items-center gap-3">
                                              <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs ${isLight ? 'bg-red-500 text-white' : col.badge} border border-white/10 shrink-0`}>
                                                {bpIdx + 1}
                                              </span>
                                              <p className={`text-xs font-bold leading-normal ${activeTheme.titleText}`}>{bp}</p>
                                            </div>
                                            <div className={`p-1.5 rounded-lg border ${col.border} text-slate-400 shrink-0`}>
                                              {getSlideIcon(bpIdx)}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <ul className="space-y-3.5 pl-1.5 font-bold leading-relaxed text-xs sm:text-sm">
                                  {slide.bulletPoints.map((bp: string, bpIdx: number) => (
                                    <li key={bpIdx} className="flex items-start gap-3">
                                      <span className={`mt-2 w-1.5 h-1.5 rounded-full shrink-0 ${activeTheme.bulletColor}`} />
                                      <span>{bp}</span>
                                    </li>
                                  ))}
                                </ul>
                              );
                            })()}
                          </div>

                          {/* Navigation Panel */}
                          <div className={`flex items-center justify-between pt-4 border-t mt-6 ${activeTheme.borderColor}`}>
                            <button
                              type="button"
                              disabled={currentSlideIndex === 0}
                              onClick={() => setCurrentSlideIndex(prev => prev - 1)}
                              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-black disabled:opacity-30 disabled:pointer-events-none transition-all ${activeTheme.navBtn}`}
                            >
                              <ChevronLeft className="w-4 h-4" />
                              <span>Prev</span>
                            </button>

                            {/* Progress Bar */}
                            <div className="flex-1 max-w-40 mx-4 h-2 rounded-full bg-slate-300/25 overflow-hidden">
                              <div
                                className="h-full bg-purple-500 transition-all duration-300"
                                style={{ width: `${((currentSlideIndex + 1) / aiSlides.length) * 100}%` }}
                              />
                            </div>

                            <button
                              type="button"
                              disabled={currentSlideIndex === aiSlides.length - 1}
                              onClick={() => setCurrentSlideIndex(prev => prev + 1)}
                              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-black disabled:opacity-30 disabled:pointer-events-none transition-all ${activeTheme.navBtn}`}
                            >
                              <span>Next</span>
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
      {/* PPT FULLSCREEN VIEW MODE */}
      {isPptFullScreen && aiSlides.length > 0 && (() => {
        const themeStyles = {
          dark: {
            bg: "bg-slate-950 text-slate-100",
            titleColor: "text-purple-300",
            bulletColor: "bg-purple-400",
            borderColor: "border-slate-800",
            navBtn: "border-slate-800 hover:bg-slate-900 text-slate-300",
            accent: "text-purple-400",
            textColor: "text-slate-300",
            titleText: "text-white",
            select: "bg-slate-900 text-slate-100 border-slate-700/60",
            headerBg: "bg-slate-900 border-b border-slate-850 shadow-md text-slate-100"
          },
          purple: {
            bg: "bg-gradient-to-br from-purple-950 to-slate-950 text-purple-100",
            titleColor: "text-pink-300",
            bulletColor: "bg-pink-400",
            borderColor: "border-purple-900/50",
            navBtn: "border-purple-900/50 hover:bg-purple-900/30 text-purple-200",
            accent: "text-pink-400",
            textColor: "text-purple-200",
            titleText: "text-white",
            select: "bg-purple-900/60 text-purple-100 border-purple-800",
            headerBg: "bg-purple-950 border-b border-purple-900 shadow-md text-purple-100"
          },
          emerald: {
            bg: "bg-gradient-to-br from-emerald-950 to-slate-950 text-emerald-100",
            titleColor: "text-teal-300",
            bulletColor: "bg-teal-400",
            borderColor: "border-emerald-900/50",
            navBtn: "border-emerald-900/50 hover:bg-emerald-900/30 text-emerald-200",
            accent: "text-teal-400",
            textColor: "text-teal-200",
            titleText: "text-white",
            select: "bg-emerald-900/60 text-emerald-100 border-emerald-800",
            headerBg: "bg-emerald-950 border-b border-emerald-900 shadow-md text-emerald-100"
          },
          light: {
            bg: "bg-white text-slate-900",
            titleColor: "text-purple-700",
            bulletColor: "bg-purple-600",
            borderColor: "border-slate-200",
            navBtn: "border-slate-300 hover:bg-slate-200 text-slate-700",
            accent: "text-purple-600",
            textColor: "text-slate-600",
            titleText: "text-slate-900",
            select: "bg-white text-slate-900 border-slate-300",
            headerBg: "bg-white border-b border-slate-200 shadow-sm text-slate-900"
          }
        };
        const activeTheme = themeStyles[aiSlidesTheme] || themeStyles.dark;

        const themeDropdownStyles = {
          dark: { bg: "bg-slate-900 border-slate-700 text-slate-100 hover:bg-slate-800", icon: "text-purple-400", chevron: "%23a855f7" },
          purple: { bg: "bg-purple-900 border-purple-800 text-purple-100 hover:bg-purple-850", icon: "text-pink-400", chevron: "%23f472b6" },
          emerald: { bg: "bg-emerald-950/80 border-emerald-800 text-emerald-100 hover:bg-emerald-900", icon: "text-teal-400", chevron: "%232dd4bf" },
          light: { bg: "bg-white border-slate-300 text-slate-900 hover:bg-slate-50", icon: "text-purple-600", chevron: "%237c3aed" }
        };
        const currentDropdownStyle = themeDropdownStyles[aiSlidesTheme] || themeDropdownStyles.dark;

        const getSlideIcon = (idx: number) => {
          const icons = [
            <Sparkles key="1" className="w-5 h-5" />,
            <Target key="2" className="w-5 h-5" />,
            <Flame key="3" className="w-5 h-5" />,
            <Trophy key="4" className="w-5 h-5" />,
            <Brain key="5" className="w-5 h-5" />,
            <Lightbulb key="6" className="w-5 h-5" />,
            <Award key="7" className="w-5 h-5" />
          ];
          return icons[idx % icons.length];
        };
        const slide = aiSlides[currentSlideIndex];
        let layout = slide?.layoutType || 'standard';
        if (layout === 'standard') {
          const layouts = ['standard', 'timeline', 'objectives', 'hub', 'grid', 'split', 'columns', 'cycle', 'workflow', 'target'];
          layout = layouts[currentSlideIndex % layouts.length];
        }

        return (
          <div className={`fixed inset-0 z-[100] flex flex-col overflow-hidden transition-all duration-300 ${activeTheme.bg}`}>
            {/* Soft decorative background glow blobs for premium deck feel (hidden on simple white theme) */}
            {aiSlidesTheme !== 'light' && (
              <>
                <div className="absolute top-[20%] left-[10%] w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] rounded-full bg-purple-500/10 blur-[130px] pointer-events-none z-0" />
                <div className="absolute bottom-[20%] right-[10%] w-[300px] sm:w-[450px] h-[300px] sm:h-[450px] rounded-full bg-cyan-500/10 blur-[110px] pointer-events-none z-0" />
              </>
            )}
            
            {/* Decorative Top Accent Strip */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 z-30" />

            {/* Solid Distinct Header Control Bar with compact padding */}
            <div className={`flex items-center justify-between px-6 sm:px-8 py-3.5 z-20 relative w-full ${activeTheme.headerBg}`}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
                  <Presentation className="w-4 h-4" />
                </div>
                <div className="h-6 w-[1px] bg-slate-350 dark:bg-slate-800" />
                <div className="space-y-0.5">
                  <span className={`text-[9px] font-black uppercase tracking-widest ${activeTheme.accent}`}>{aiCategory} Deck</span>
                  <h2 className="text-xs sm:text-sm font-black tracking-tight">{aiCategory || 'Study Presentation'}</h2>
                </div>
              </div>

              {/* Toolbar */}
              <div className="flex items-center gap-3 z-20 relative">
                {/* Slide Navigation Controls directly in Header */}
                <div className={`flex items-center gap-1 p-1 rounded-xl border shadow-sm transition-all ${
                  aiSlidesTheme === 'light'
                    ? 'bg-slate-100 border-slate-300 text-slate-950'
                    : 'bg-slate-800 border-slate-700 text-slate-100'
                }`}>
                  <button
                    type="button"
                    disabled={currentSlideIndex === 0}
                    onClick={() => setCurrentSlideIndex(prev => prev - 1)}
                    className={`p-1.5 rounded-lg transition-all disabled:opacity-20 disabled:pointer-events-none ${
                      aiSlidesTheme === 'light' ? 'hover:bg-slate-200 text-slate-950' : 'hover:bg-slate-700 text-slate-100'
                    }`}
                    title="Previous Slide"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[11px] font-black tracking-wider px-1.5 shrink-0">
                    {currentSlideIndex + 1} / {aiSlides.length}
                  </span>
                  <button
                    type="button"
                    disabled={currentSlideIndex === aiSlides.length - 1}
                    onClick={() => setCurrentSlideIndex(prev => prev + 1)}
                    className={`p-1.5 rounded-lg transition-all disabled:opacity-20 disabled:pointer-events-none ${
                      aiSlidesTheme === 'light' ? 'hover:bg-slate-200 text-slate-950' : 'hover:bg-slate-700 text-slate-100'
                    }`}
                    title="Next Slide"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="h-6 w-[1px] bg-slate-350 dark:bg-slate-805" />

                {/* Theme Selector Popover */}
                <div className="relative" ref={pptThemeRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPptThemeDropdownOpen(!isPptThemeDropdownOpen);
                      setIsPptLayoutDropdownOpen(false);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border shadow-xs transition-all duration-200 text-xs font-black ${currentDropdownStyle.bg}`}
                  >
                    <Palette className={`w-3.5 h-3.5 shrink-0 ${currentDropdownStyle.icon}`} />
                    <span className="opacity-60 text-[10px] uppercase tracking-wider">Theme:</span>
                    <span>
                      {aiSlidesTheme === 'dark' && 'Midnight Dark'}
                      {aiSlidesTheme === 'purple' && 'Cosmic Purple'}
                      {aiSlidesTheme === 'emerald' && 'Forest Emerald'}
                      {aiSlidesTheme === 'light' && 'Crisp Light'}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
                  </button>

                  {isPptThemeDropdownOpen && (
                    <div className="absolute right-0 mt-1.5 w-48 rounded-xl shadow-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 py-1.5 z-[110] animate-in fade-in slide-in-from-top-1 duration-100">
                      {[
                        { id: 'dark', label: 'Midnight Dark', desc: 'Sleek dark theme' },
                        { id: 'purple', label: 'Cosmic Purple', desc: 'Vibrant neon purple' },
                        { id: 'emerald', label: 'Forest Emerald', desc: 'Natural green accents' },
                        { id: 'light', label: 'Crisp Light', desc: 'Clean high contrast light' }
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setAiSlidesTheme(t.id as any);
                            setIsPptThemeDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 text-xs font-bold transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 ${
                            aiSlidesTheme === t.id 
                              ? 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 font-black' 
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div>{t.label}</div>
                          <div className="text-[9px] opacity-50 font-semibold">{t.desc}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Layout Selector Popover */}
                <div className="relative" ref={pptLayoutRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPptLayoutDropdownOpen(!isPptLayoutDropdownOpen);
                      setIsPptThemeDropdownOpen(false);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border shadow-xs transition-all duration-200 text-xs font-black ${currentDropdownStyle.bg}`}
                  >
                    <LayoutGrid className={`w-3.5 h-3.5 shrink-0 ${currentDropdownStyle.icon}`} />
                    <span className="opacity-60 text-[10px] uppercase tracking-wider">Layout:</span>
                    <span>
                      {slide?.layoutType === 'standard' && 'Standard List'}
                      {slide?.layoutType === 'timeline' && 'Timeline Flow'}
                      {slide?.layoutType === 'objectives' && '3D Ribbons'}
                      {slide?.layoutType === 'hub' && 'Central Hub'}
                      {slide?.layoutType === 'grid' && '2x2 Grid'}
                      {slide?.layoutType === 'split' && 'Split Highlight'}
                      {slide?.layoutType === 'columns' && 'Key Pillars'}
                      {slide?.layoutType === 'cycle' && 'Cycle Wheel'}
                      {slide?.layoutType === 'workflow' && 'Workflow Path'}
                      {slide?.layoutType === 'target' && 'Target Arch'}
                      {(!slide?.layoutType || slide?.layoutType === 'standard') && 'Standard List'}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
                  </button>

                  {isPptLayoutDropdownOpen && (
                    <div className="absolute right-0 mt-1.5 w-52 rounded-xl shadow-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 py-1.5 z-[110] max-h-72 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-100">
                      {[
                        { id: 'standard', label: 'Standard list', desc: 'Classic bullet points' },
                        { id: 'timeline', label: 'Timeline flow', desc: 'Linear step progression' },
                        { id: 'objectives', label: '3D Ribbons', desc: 'Modern dimensional ribbons' },
                        { id: 'hub', label: 'Central Hub', desc: 'Core concept with spokens' },
                        { id: 'grid', label: '2x2 Grid', desc: 'Quad quadrant overview' },
                        { id: 'split', label: 'Split Highlight', desc: 'Key theme side-by-side' },
                        { id: 'columns', label: 'Key Pillars', desc: 'Vertical concept pillars' },
                        { id: 'cycle', label: 'Cycle Wheel', desc: 'Continuous circular flow' },
                        { id: 'workflow', label: 'Workflow Path', desc: 'Step-by-step connection' },
                        { id: 'target', label: 'Target Arch', desc: 'Concentric ring goals' }
                      ].map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => {
                            const updatedSlides = [...aiSlides];
                            updatedSlides[currentSlideIndex] = {
                              ...updatedSlides[currentSlideIndex],
                              layoutType: l.id
                            };
                            setAiSlides(updatedSlides);
                            setIsPptLayoutDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 text-xs font-bold transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 ${
                            (slide?.layoutType || 'standard') === l.id 
                              ? 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 font-black' 
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div>{l.label}</div>
                          <div className="text-[9px] opacity-50 font-semibold">{l.desc}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="h-6 w-[1px] bg-slate-350 dark:bg-slate-805" />

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setIsPptFullScreen(false)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 border border-rose-600 hover:border-rose-750"
                >
                  <span>✕ Exit Presenter</span>
                </button>
              </div>
            </div>

            {/* Slide Body Wrapper with animation & padded canvas */}
            <div key={currentSlideIndex} className="flex-1 flex flex-col justify-center max-w-6xl mx-auto w-full px-8 sm:px-12 py-10 space-y-8 z-10 relative animate-slide-in">
              <div className="flex items-start gap-4">
                <div className={`w-1.5 h-14 rounded-full shrink-0 mt-2 bg-gradient-to-b ${aiSlidesTheme === 'light' ? 'from-purple-600 to-indigo-600' : 'from-purple-400 to-indigo-400'}`} />
                <div className="space-y-1">
                  <span className={`text-[10px] sm:text-xs font-black uppercase tracking-widest ${activeTheme.accent}`}>Slide Title</span>
                  <h1 className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black uppercase tracking-tight leading-tight ${activeTheme.titleColor}`}>
                    {slide?.title}
                  </h1>
                </div>
              </div>

              {/* Render dynamic layouts inside fullscreen mode */}
              <div className="min-h-[300px] flex flex-col justify-center">
                {(() => {
                  const isLight = aiSlidesTheme === 'light';
                  const localTheme = themeStyles[aiSlidesTheme] || themeStyles.dark;
                  const activeTheme = {
                    ...localTheme,
                    titleText: isLight ? "text-slate-100" : localTheme.titleText
                  };
                  const getAdaptedColors = (idx: number) => {
                    const darkColors = [
                      { border: "border-teal-500/30", bg: "from-teal-500/10 to-teal-950/40 text-teal-100", text: "text-teal-400", badge: "bg-teal-500/20 text-teal-300", iconBg: "bg-teal-900/50 text-teal-400", strip: "border-l-4 border-l-teal-500", stripTop: "border-t-4 border-t-teal-500" },
                      { border: "border-amber-500/30", bg: "from-amber-500/10 to-amber-950/40 text-amber-100", text: "text-amber-400", badge: "bg-amber-500/20 text-amber-300", iconBg: "bg-amber-900/50 text-amber-400", strip: "border-l-4 border-l-amber-500", stripTop: "border-t-4 border-t-amber-500" },
                      { border: "border-cyan-500/30", bg: "from-cyan-500/10 to-cyan-950/40 text-cyan-100", text: "text-cyan-400", badge: "bg-cyan-500/20 text-cyan-300", iconBg: "bg-cyan-900/50 text-cyan-400", strip: "border-l-4 border-l-cyan-500", stripTop: "border-t-4 border-t-cyan-500" },
                      { border: "border-rose-500/30", bg: "from-rose-500/10 to-rose-950/40 text-rose-100", text: "text-rose-400", badge: "bg-rose-500/20 text-rose-300", iconBg: "bg-rose-900/50 text-rose-400", strip: "border-l-4 border-l-rose-500", stripTop: "border-t-4 border-t-rose-500" },
                      { border: "border-purple-500/30", bg: "from-purple-500/10 to-purple-950/40 text-purple-100", text: "text-purple-400", badge: "bg-purple-500/20 text-purple-300", iconBg: "bg-purple-900/50 text-purple-400", strip: "border-l-4 border-l-purple-500", stripTop: "border-t-4 border-t-purple-500" }
                    ];
                    const lightColors = [
                      { border: "border-[#3f36d2]", bg: "from-[#4f46e5] to-[#4f46e5] text-white", text: "text-white", badge: "bg-[#312e81] text-white border-none", iconBg: "bg-[#312e81] text-white", strip: "border-l-4 border-l-[#1e1b4b]", stripTop: "border-t-4 border-t-[#1e1b4b]" },
                      { border: "border-[#6d28d9]", bg: "from-[#7c3aed] to-[#7c3aed] text-white", text: "text-white", badge: "bg-[#4c1d95] text-white border-none", iconBg: "bg-[#4c1d95] text-white", strip: "border-l-4 border-l-[#2e1065]", stripTop: "border-t-4 border-t-[#2e1065]" },
                      { border: "border-[#047857]", bg: "from-[#059669] to-[#059669] text-white", text: "text-white", badge: "bg-[#064e3b] text-white border-none", iconBg: "bg-[#064e3b] text-white", strip: "border-l-4 border-l-[#022c22]", stripTop: "border-t-4 border-t-[#022c22]" },
                      { border: "border-[#d97706]", bg: "from-[#f59e0b] to-[#f59e0b] text-white", text: "text-white", badge: "bg-[#78350f] text-white border-none", iconBg: "bg-[#78350f] text-white", strip: "border-l-4 border-l-[#451a03]", stripTop: "border-t-4 border-t-[#451a03]" },
                      { border: "border-[#be123c]", bg: "from-[#f43f5e] to-[#f43f5e] text-white", text: "text-white", badge: "bg-[#881337] text-white border-none", iconBg: "bg-[#881337] text-white", strip: "border-l-4 border-l-[#4c0519]", stripTop: "border-t-4 border-t-[#4c0519]" },
                      { border: "border-[#334155]", bg: "from-[#475569] to-[#475569] text-white", text: "text-white", badge: "bg-[#1e293b] text-white border-none", iconBg: "bg-[#1e293b] text-white", strip: "border-l-4 border-l-[#0f172a]", stripTop: "border-t-4 border-t-[#0f172a]" }
                    ];
                    return isLight ? lightColors[idx % lightColors.length] : darkColors[idx % darkColors.length];
                  };

                  if (layout === 'timeline') {
                    return (
                      <div className="relative pt-10 pb-4">
                        <div className={`absolute top-16 left-16 right-16 h-0.5 border-t-2 border-dashed ${isLight ? 'border-slate-300' : 'border-slate-700/60'} hidden sm:block z-0`} />
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-6 relative z-10">
                          {slide.bulletPoints.map((bp: string, bpIdx: number) => {
                            const col = getAdaptedColors(bpIdx);
                            return (
                              <div key={bpIdx} className={`p-6 rounded-3xl border ${col.border} ${col.stripTop} bg-gradient-to-b ${col.bg} backdrop-blur-md flex flex-col items-center text-center space-y-4 shadow-md transform hover:scale-105 transition-all`}>
                                <span className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${col.badge} shadow-sm shrink-0 border border-white/20`}>
                                  {bpIdx + 1}
                                </span>
                                <div className="space-y-1.5">
                                  <p className={`text-[10px] uppercase font-black tracking-widest ${col.text}`}>Step {bpIdx + 1}</p>
                                  <p className={`text-xs sm:text-sm font-extrabold leading-relaxed ${activeTheme.titleText}`}>{bp}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  if (layout === 'grid') {
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                        {slide.bulletPoints.map((bp: string, bpIdx: number) => {
                          const col = getAdaptedColors(bpIdx);
                          return (
                            <div key={bpIdx} className={`p-6 rounded-3xl border ${col.border} ${col.strip} bg-gradient-to-br ${col.bg} backdrop-blur-md flex items-start gap-4.5 shadow-sm hover:scale-[1.01] transition-transform`}>
                              <div className={`p-3 rounded-2xl ${col.iconBg} shrink-0 shadow-sm border border-white/10`}>
                                {getSlideIcon(bpIdx)}
                              </div>
                              <div className="space-y-1.5 flex-1">
                                <span className={`text-[10px] uppercase font-black tracking-widest ${col.text}`}>Pillar 0{bpIdx + 1}</span>
                                <p className={`text-sm font-bold leading-relaxed ${activeTheme.titleText}`}>{bp}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }

                  if (layout === 'objectives') {
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-center pt-2">
                        <div className="md:col-span-3 space-y-5 pr-3 pl-6">
                          {slide.bulletPoints.map((bp: string, bpIdx: number) => {
                            const col = getAdaptedColors(bpIdx);
                            return (
                              <div key={bpIdx} className="relative z-10 flex items-center group">
                                <div className={`flex-1 pl-12 pr-6 py-4 rounded-r-3xl rounded-bl-3xl border-l-4 border-l-current ${col.border} bg-gradient-to-r ${col.bg} shadow-md flex items-center justify-between relative`}>
                                  <div className="absolute left-[-4px] top-[100%] w-0 h-0 border-t-[8px] border-r-[8px] border-b-[8px] border-l-[8px] border-transparent"
                                       style={{ borderTopColor: 'currentColor', borderRightColor: 'currentColor', opacity: 0.8 }} />

                                  <div className={`absolute -left-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center font-black text-sm border-2 shadow-md ${col.badge} border-white`}>
                                    {bpIdx + 1}
                                  </div>

                                  <p className={`text-sm font-bold leading-relaxed pr-2 ${activeTheme.titleText}`}>{bp}</p>
                                  
                                  <div className={`w-9 h-9 rounded-full ${isLight ? 'bg-slate-200/50' : 'bg-white/5'} border border-white/10 flex items-center justify-center shadow-xs shrink-0 ml-3 ${col.text}`}>
                                    {getSlideIcon(bpIdx)}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className={`md:col-span-2 p-8 rounded-3xl border ${isLight ? 'bg-slate-100/60 border-slate-200 text-slate-800' : 'bg-gradient-to-br from-indigo-950/30 to-purple-950/40 border-purple-500/25 text-purple-100'} flex flex-col justify-center min-h-[250px] shadow-sm`}>
                          <span className={`text-[10px] uppercase font-black tracking-widest ${activeTheme.accent} block mb-1.5`}>Structure Outline</span>
                          <h3 className={`text-lg font-black leading-tight mb-3 ${isLight ? 'text-slate-900' : 'text-white'}`}>{slide?.title}</h3>
                          <p className={`text-xs font-semibold leading-relaxed ${activeTheme.textColor}`}>
                            Each point represents a critical layer of this concept. Explore the steps sequentially to review the study targets.
                          </p>
                        </div>
                      </div>
                    );
                  }

                  if (layout === 'hub') {
                    const leftBullets = slide.bulletPoints.filter((_, i) => i % 2 === 0);
                    const rightBullets = slide.bulletPoints.filter((_, i) => i % 2 !== 0);

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center pt-2 relative">
                        <div className="space-y-4 z-10">
                          {leftBullets.map((bp: string, idx: number) => {
                            const originalIdx = idx * 2;
                            const col = getAdaptedColors(originalIdx);
                            return (
                              <div key={idx} className={`p-4 rounded-3xl border ${col.border} ${col.strip} bg-gradient-to-r ${col.bg} flex items-start gap-4 shadow-md transform hover:scale-102 transition-all`}>
                                <div className={`p-3 rounded-2xl ${col.iconBg} shrink-0`}>
                                  {getSlideIcon(originalIdx)}
                                </div>
                                <div>
                                  <span className={`text-[9px] uppercase font-black tracking-widest ${col.text}`}>Section 0{originalIdx + 1}</span>
                                  <p className={`text-xs font-bold leading-normal ${activeTheme.titleText}`}>{bp}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex justify-center items-center relative z-20 py-4">
                          <div className={`w-40 h-40 rounded-full border-4 border-dashed ${isLight ? 'bg-white border-purple-400' : 'bg-slate-900 border-purple-500/40'} shadow-2xl flex items-center justify-center text-center p-5 relative overflow-hidden`}>
                            <div className="absolute inset-0 bg-purple-500/5 animate-[pulse_3s_infinite]" />
                            <p className={`text-xs font-black leading-tight uppercase select-none tracking-wide ${isLight ? 'text-slate-900' : 'text-white'}`}>
                              {slide?.title}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4 z-10">
                          {rightBullets.map((bp: string, idx: number) => {
                            const originalIdx = idx * 2 + 1;
                            const col = getAdaptedColors(originalIdx);
                            return (
                              <div key={idx} className={`p-4 rounded-3xl border ${col.border} ${col.strip} bg-gradient-to-r ${col.bg} flex items-start gap-4 shadow-md transform hover:scale-102 transition-all`}>
                                <div className="flex-1 text-right">
                                  <span className={`text-[9px] uppercase font-black tracking-widest ${col.text}`}>Section 0{originalIdx + 1}</span>
                                  <p className={`text-xs font-bold leading-normal ${activeTheme.titleText}`}>{bp}</p>
                                </div>
                                <div className={`p-3 rounded-2xl ${col.iconBg} shrink-0`}>
                                  {getSlideIcon(originalIdx)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  if (layout === 'split') {
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 pt-2">
                        <div className={`md:col-span-2 p-6.5 rounded-3xl border ${isLight ? 'bg-purple-100/50 border-purple-200 border-l-4 border-l-purple-600' : 'border-purple-500/30 bg-gradient-to-br from-purple-800/30 to-indigo-950/20 border-l-4 border-l-purple-400'} flex flex-col justify-center space-y-6 shadow-md min-h-[220px]`}>
                          <div className={`p-3 ${isLight ? 'bg-purple-600 text-white shadow-xs' : 'bg-purple-500 text-white'} rounded-2xl w-fit animate-pulse`}>
                            <Brain className="w-6 h-6" />
                          </div>
                          <div className="space-y-2">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${isLight ? 'text-purple-700' : 'text-purple-300'}`}>Key Theme</span>
                            <p className={`text-base sm:text-lg md:text-xl font-black leading-relaxed ${isLight ? 'text-purple-950' : 'text-white'}`}>{slide.bulletPoints[0]}</p>
                          </div>
                        </div>
                        <div className="md:col-span-3 space-y-4">
                          {slide.bulletPoints.slice(1).map((bp: string, bpIdx: number) => {
                            const col = getAdaptedColors(bpIdx + 1);
                            return (
                              <div key={bpIdx} className={`p-4 rounded-3xl border ${col.border} ${col.strip} bg-gradient-to-r ${col.bg} flex items-start gap-4 shadow-xs hover:scale-[1.01] transition-transform`}>
                                <span className={`p-2 rounded-xl ${col.iconBg} shrink-0`}>
                                  {getSlideIcon(bpIdx + 1)}
                                </span>
                                <p className={`text-xs sm:text-sm font-bold leading-normal ${activeTheme.titleText}`}>{bp}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  if (layout === 'columns') {
                    return (
                      <div className="space-y-6 pt-2">
                        <div className="flex flex-col items-center">
                          <div className="px-6 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-xs shadow-md relative uppercase tracking-wider">
                            <span>Key Pillars & Core Concepts</span>
                            <div className="absolute top-[100%] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-blue-600" />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          {slide.bulletPoints.map((bp: string, bpIdx: number) => {
                            const col = getAdaptedColors(bpIdx);
                            return (
                              <div key={bpIdx} className={`p-5 rounded-3xl border ${col.border} ${col.stripTop} bg-gradient-to-b ${col.bg} shadow-lg flex flex-col items-center text-center space-y-4 transform hover:scale-105 transition-all min-h-[190px]`}>
                                <div className={`p-3 rounded-full ${col.iconBg} shadow-inner`}>
                                  {getSlideIcon(bpIdx)}
                                </div>
                                <div className="space-y-1.5 flex-1 flex flex-col justify-center">
                                  <h5 className={`text-xs font-black uppercase tracking-wider ${col.text}`}>Focus 0{bpIdx + 1}</h5>
                                  <p className={`text-xs font-bold leading-relaxed ${activeTheme.titleText}`}>{bp}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  if (layout === 'cycle') {
                    return (
                      <div className="space-y-6 pt-2">
                        <div className="flex justify-center items-center">
                          <div className={`relative w-28 h-28 flex items-center justify-center rounded-full border-4 border-dashed ${isLight ? 'border-teal-300 bg-white' : 'border-teal-500/30'} animate-[spin_25s_linear_infinite]`}>
                            <div className={`absolute w-20 h-20 rounded-full border-4 border-double ${isLight ? 'border-amber-300' : 'border-amber-500/30'} flex items-center justify-center`}>
                              <RefreshCw className="w-8 h-8 text-teal-500 animate-pulse" />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
                          {slide.bulletPoints.map((bp: string, bpIdx: number) => {
                            const col = getAdaptedColors(bpIdx);
                            return (
                              <div key={bpIdx} className="flex flex-col items-center text-center space-y-3">
                                <span className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border-2 shadow-md ${isLight ? 'bg-teal-500 text-white' : col.badge} border-white`}>
                                  0{bpIdx + 1}
                                </span>
                                <div className="space-y-1.5">
                                  <span className={`text-[10px] uppercase font-black tracking-widest ${col.text}`}>Phase 0{bpIdx + 1}</span>
                                  <p className={`text-xs sm:text-sm font-bold leading-relaxed ${isLight ? 'text-slate-900' : 'text-white'}`}>{bp}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  if (layout === 'workflow') {
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-10 gap-6 items-center pt-2 relative">
                        <div className={`md:col-span-3 flex flex-col items-center justify-center p-5 rounded-3xl border ${isLight ? 'bg-slate-100 border-slate-200 border-l-4 border-l-purple-500' : 'bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800 border-l-4 border-l-purple-500'} shadow-xl relative min-h-[160px] text-center`}>
                          <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/5 to-transparent rounded-3xl" />
                          <div className={`w-14 h-14 rounded-full border-2 ${isLight ? 'border-purple-300 bg-white' : 'border-purple-500/50 bg-slate-900'} flex items-center justify-center mb-3 shadow-inner`}>
                            <Brain className="w-7 h-7 text-purple-500 animate-pulse" />
                          </div>
                          <span className={`text-[10px] uppercase font-black tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Core Workflow</span>
                          <p className={`text-xs font-black leading-tight mt-1.5 ${isLight ? 'text-slate-950' : 'text-white'}`}>{slide.title}</p>
                        </div>

                        <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-4 gap-4 relative">
                          <div className={`absolute top-1/2 left-6 right-6 h-0.5 border-t border-dashed ${isLight ? 'border-slate-300' : 'border-slate-700'} hidden sm:block z-0`} />
                          
                          {slide.bulletPoints.map((bp: string, bpIdx: number) => {
                            const col = getAdaptedColors(bpIdx);
                            return (
                              <div key={bpIdx} className={`p-4 rounded-2xl border ${col.border} ${col.strip} bg-gradient-to-b ${col.bg} relative z-10 flex flex-col justify-between space-y-4 shadow-md transform hover:-translate-y-1 transition-all min-h-[160px]`}>
                                <div className="flex items-center justify-between">
                                  <span className={`text-[10px] font-black uppercase tracking-wider ${col.text}`}>Step 0{bpIdx + 1}</span>
                                  <div className={`${col.text}`}>
                                    {getSlideIcon(bpIdx)}
                                  </div>
                                </div>
                                <p className={`text-xs sm:text-sm font-extrabold leading-normal flex-1 flex items-center ${activeTheme.titleText}`}>{bp}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  if (layout === 'target') {
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center pt-2">
                        <div className="md:col-span-4 flex justify-center py-4">
                          <div className={`w-40 h-40 rounded-full border-8 ${isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-900/60'} shadow-xl flex items-center justify-center relative overflow-hidden group`}>
                            <div className="absolute w-32 h-32 rounded-full border-4 border-dashed border-red-500/40 animate-[spin_10s_linear_infinite]" />
                            <div className="absolute w-20 h-20 rounded-full border-4 border-double border-yellow-500/30" />
                            <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center shadow-inner relative z-10 animate-pulse">
                              <Target className="w-5 h-5 text-white" />
                            </div>
                          </div>
                        </div>

                        <div className="md:col-span-8 space-y-3.5">
                          {slide.bulletPoints.map((bp: string, bpIdx: number) => {
                            const col = getAdaptedColors(bpIdx);
                            return (
                              <div key={bpIdx} className={`p-4.5 rounded-2xl border ${col.border} ${col.strip} bg-gradient-to-r ${col.bg} flex items-center justify-between shadow-xs hover:scale-[1.01] transition-transform`}>
                                <div className="flex items-center gap-4">
                                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm ${isLight ? 'bg-red-500 text-white' : col.badge} border border-white/10 shrink-0`}>
                                    {bpIdx + 1}
                                  </span>
                                  <p className={`text-xs sm:text-sm font-bold leading-normal ${activeTheme.titleText}`}>{bp}</p>
                                </div>
                                <div className={`p-2 rounded-lg border ${col.border} text-slate-400 shrink-0`}>
                                  {getSlideIcon(bpIdx)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <ul className="space-y-4 pl-2 font-bold leading-relaxed text-sm sm:text-base">
                      {slide.bulletPoints.map((bp: string, bpIdx: number) => (
                        <li key={bpIdx} className="flex items-start gap-3.5">
                          <span className={`mt-2.5 w-2 h-2 rounded-full shrink-0 ${activeTheme.bulletColor}`} />
                          <span>{bp}</span>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </div>
            </div>

          </div>
        );
      })()}

    </div>
  );
}
