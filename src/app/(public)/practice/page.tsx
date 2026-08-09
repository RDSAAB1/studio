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
  Zap,
  Target,
  GraduationCap,
  Layers,
  Search,
  Cloud,
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

export default function StudentPracticePage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [progress, setProgress] = useState<Record<string, QuestionProgress>>({});
  const [selectedSubject, setSelectedSubject] = useState<string>('All Subjects');
  const [selectedTopic, setSelectedTopic] = useState<string>('All Topics');
  const [viewMode, setViewMode] = useState<'unmastered' | 'focus' | 'all' | 'mastered'>('unmastered');
  
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

    // Subscribe to Firestore Cloud updates in real-time
    const unsubscribe = subscribeToCloudQuestions((cloudQuestions) => {
      if (cloudQuestions && cloudQuestions.length > 0) {
        setQuestions(cloudQuestions);
      }
    });

    return () => unsubscribe();
  }, []);

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

    return {
      total: activeQueue.length,
      attemptedCount: attemptedTotal,
      correctCount,
      incorrectCount,
      skippedCount,
      scorePct,
      topicBreakdown,
    };
  }, [isSubmitted, activeQueue, userAnswers]);

  // Toggle Explanation visibility
  const toggleExplanation = (qId: string) => {
    setShowExplanationMap((prev) => ({ ...prev, [qId]: !prev[qId] }));
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
  const handleDeleteQuestion = (id: string) => {
    if (confirm('Kya aap is question ko permanent remove karna chahte hain?')) {
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

  const handleResetProgress = () => {
    if (confirm('Kya aap saari mastery aur progress reset karna chahte hain? Saare 100% mastered questions dubara practice set me aa jayenge.')) {
      resetAllProgress();
      setProgress({});
    }
  };

  const handleClearAllQuestions = () => {
    if (confirm('Kya aap sabhi questions ko DELETE karna chahte hain? Question bank completely khali (empty) ho jayega.')) {
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
                  onClick={() => {
                    const count = Object.keys(userAnswers).length;
                    if (count > 0 && !isSubmitted) {
                      if (confirm(`Aapne ${count} questions solve kiye hain. Kya aap bina save kiye exit karna chahte hain?`)) {
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
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center shadow-xs">
                    <p className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider">100% Mastered</p>
                    <p className="text-3xl font-black text-emerald-900">{testResults.correctCount}</p>
                    <p className="text-[10px] text-emerald-800 font-bold mt-1">Saved to Mastery</p>
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

                {/* Options List */}
                <div className="space-y-3 pt-2">
                  {activeQueue[currentIndex].options.map((optText, optIdx) => {
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
                  })}
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
                {/* View Mode Tabs (Active / Focus / Mastered / All) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 flex-1">
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
            </div>

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
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-600" />
                  <span>Question Bank ({filteredQuestions.length})</span>
                </h3>
                <span className="text-xs text-slate-500 font-bold">Click any question to view solution</span>
              </div>

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
                        <div className="p-5 space-y-4">
                          {/* Question Top Header */}
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-2 flex-1">
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="px-2.5 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-black text-xs shadow-2xs">
                                  #{idx + 1}
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
                      </div>
                    );
                  })}
                </div>
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
    </div>
  );
}
