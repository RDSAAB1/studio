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
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col font-sans overflow-x-hidden selection:bg-indigo-500 selection:text-white">
      {/* Top Banner & Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/95 backdrop-blur-xl sticky top-0 z-40 px-4 py-3 sm:px-6 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2.5 rounded-xl bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white transition-all border border-slate-700/60 shadow-md"
              title="Return to App Dashboard"
            >
              <Home className="w-4 h-4 sm:w-5 sm:h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                  <GraduationCap className="w-5 h-5 text-indigo-400" />
                </div>
                <h1 className="text-lg sm:text-xl font-black bg-gradient-to-r from-indigo-300 via-purple-200 to-pink-300 bg-clip-text text-transparent tracking-tight">
                  JRMD Student Practice & Quiz Hub
                </h1>
                <span className="text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold uppercase tracking-wider">
                  Public Access (No Login)
                </span>
                <span className="text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 font-semibold uppercase tracking-wider flex items-center gap-1.5" title="Real-time Firebase Cloud sync enabled across all devices">
                  <Cloud className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                  <span>Cloud Synced</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={copyShareLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all border border-slate-700/70"
            >
              <Share2 className="w-4 h-4 text-indigo-400" />
              <span>{copiedLink ? 'Link Copied!' : 'Share'}</span>
            </button>

            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              title="Bulk import questions directly from PDF text"
            >
              <FileText className="w-4 h-4" />
              <span>Bulk PDF Import</span>
            </button>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Add Question</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Progress & Stats Cards Overview */}
        {!isTestActive && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Questions Card */}
            <div className="bg-slate-900/80 backdrop-blur-lg border border-slate-800/90 rounded-2xl p-5 flex items-center gap-4 relative overflow-hidden group hover:border-indigo-500/40 transition-all shadow-lg">
              <div className="p-3.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-110 transition-transform">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Questions</p>
                <h3 className="text-2xl font-black text-white tracking-tight">{stats.total}</h3>
                <p className="text-[11px] text-slate-500 font-medium">In Question Bank</p>
              </div>
            </div>

            {/* 100% Mastered Card */}
            <div className="bg-slate-900/80 backdrop-blur-lg border border-emerald-900/40 rounded-2xl p-5 flex items-center gap-4 relative overflow-hidden group hover:border-emerald-500/50 transition-all shadow-lg">
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-emerald-400/90 uppercase tracking-wider">100% Mastered</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-black text-emerald-300 tracking-tight">{stats.masteredCount}</h3>
                  <span className="text-xs text-emerald-400/80 font-extrabold">({stats.masteredPercentage}%)</span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">Removed from next session</p>
              </div>
            </div>

            {/* Pending Practice / Focus Card */}
            <div className="bg-slate-900/80 backdrop-blur-lg border border-amber-900/40 rounded-2xl p-5 flex items-center gap-4 relative overflow-hidden group hover:border-amber-500/50 transition-all shadow-lg">
              <div className="p-3.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-110 transition-transform">
                <Flame className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-amber-400/90 uppercase tracking-wider">Needs Focus</p>
                <h3 className="text-2xl font-black text-amber-300 tracking-tight">{stats.unmasteredCount}</h3>
                <p className="text-[11px] text-slate-500 font-medium">Wrong or Unattempted</p>
              </div>
            </div>

            {/* Overall Mastery Meter Card */}
            <div className="bg-slate-900/80 backdrop-blur-lg border border-purple-900/40 rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group hover:border-purple-500/50 transition-all shadow-lg">
              <div className="flex justify-between items-center">
                <p className="text-[11px] font-bold text-purple-300 uppercase tracking-wider">Mastery Level</p>
                <Sparkles className="w-5 h-5 text-purple-400" />
              </div>
              <div className="my-2">
                <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800 p-0.5">
                  <div
                    className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 h-full rounded-full transition-all duration-700 ease-out shadow-sm shadow-purple-500/50"
                    style={{ width: `${stats.masteredPercentage}%` }}
                  />
                </div>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                <span>0%</span>
                <span className="font-extrabold text-purple-300">{stats.masteredPercentage}% Completed</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        )}

        {/* ACTIVE PRACTICE TEST MODE */}
        {isTestActive ? (
          <div className="space-y-6 max-w-4xl mx-auto">
            {/* Top Controller Bar */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSubmitTest}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/30"
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
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors border border-slate-700/60"
                  title="Exit without saving"
                >
                  <span>Discard & Quit</span>
                </button>

                <span className="text-slate-700">|</span>
                <div className="text-xs font-bold text-slate-300">
                  Question <span className="text-indigo-400 text-sm font-black">{currentIndex + 1}</span> of{' '}
                  <span className="text-slate-400">{activeQueue.length}</span>
                </div>
              </div>

              {/* Progress Indicator & Finish Button */}
              <div className="flex items-center gap-3">
                <div className="hidden sm:block w-32 bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className="bg-indigo-500 h-full transition-all duration-300"
                    style={{ width: `${((currentIndex + 1) / activeQueue.length) * 100}%` }}
                  />
                </div>

                {!isSubmitted ? (
                  <button
                    onClick={handleSubmitTest}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-xs shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition-all transform hover:scale-[1.02]"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {Object.keys(userAnswers).length > 0
                        ? `Submit Session (${Object.keys(userAnswers).length} Solved)`
                        : 'Submit Session'}
                    </span>
                  </button>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Evaluated
                  </span>
                )}
              </div>
            </div>

            {/* Test Completed / Evaluation Summary Card */}
            {isSubmitted && testResults && (
              <div className="bg-gradient-to-br from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-500/40 rounded-3xl p-6 sm:p-10 space-y-6 shadow-2xl text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  <Award className="w-64 h-64 text-indigo-400" />
                </div>

                <div className="inline-flex p-4 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 mb-1 shadow-lg shadow-indigo-500/20">
                  <Trophy className="w-10 h-10 text-amber-400 animate-bounce" />
                </div>

                <div>
                  <h2 className="text-3xl font-black text-white tracking-tight">Session Result & Mastery Report</h2>
                  <p className="text-sm text-slate-300 mt-1 font-medium">
                    Questions answered correctly with 100% score are automatically marked as Mastered!
                  </p>
                </div>

                {/* Score Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
                  <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 text-center shadow-md">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Accuracy</p>
                    <p className="text-3xl font-black text-indigo-400">{testResults.scorePct}%</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">
                      ({testResults.correctCount} of {testResults.attemptedCount} Solved Correct)
                    </p>
                  </div>
                  <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-2xl p-4 text-center shadow-md">
                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">100% Mastered</p>
                    <p className="text-3xl font-black text-emerald-300">{testResults.correctCount}</p>
                    <p className="text-[10px] text-emerald-400/80 font-bold mt-1">Saved to Mastery</p>
                  </div>
                  <div className="bg-rose-950/40 border border-rose-800/40 rounded-2xl p-4 text-center shadow-md">
                    <p className="text-xs font-bold text-rose-400 uppercase tracking-wider">Incorrect</p>
                    <p className="text-3xl font-black text-rose-300">{testResults.incorrectCount}</p>
                    <p className="text-[10px] text-rose-400/80 font-bold mt-1">Needs Review</p>
                  </div>
                  <div className="bg-amber-950/40 border border-amber-800/40 rounded-2xl p-4 text-center shadow-md">
                    <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">Unattempted</p>
                    <p className="text-3xl font-black text-amber-300">{testResults.skippedCount}</p>
                    <p className="text-[10px] text-amber-400/80 font-bold mt-1">Remaining</p>
                  </div>
                </div>

                {testResults.correctCount > 0 && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-emerald-300 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 max-w-xl mx-auto">
                    <Sparkles className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <span>
                      <strong>{testResults.correctCount} question(s)</strong> scored 100% and have been removed from your future practice sessions!
                    </span>
                  </div>
                )}

                {/* Topic-Wise Weak Spot & Performance Analytics Breakdown */}
                {testResults.topicBreakdown.length > 0 && (
                  <div className="space-y-3.5 pt-4 border-t border-slate-800/80 max-w-3xl mx-auto text-left">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black text-white flex items-center gap-2">
                        <Target className="w-4.5 h-4.5 text-amber-400" />
                        <span>Topic-Wise Weak Spot & Score Analysis</span>
                      </h3>
                      <span className="text-[11px] text-slate-400 font-semibold">Sorted by Weakest Topic First</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {testResults.topicBreakdown.map((item) => {
                        let badgeStyle = 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300';
                        let statusLabel = '🟢 Strong Topic';

                        if (item.status === 'weak') {
                          badgeStyle = 'bg-rose-950/70 border-rose-500/50 text-rose-200';
                          statusLabel = '🔴 Weak Topic (Revise)';
                        } else if (item.status === 'average') {
                          badgeStyle = 'bg-amber-950/60 border-amber-500/40 text-amber-300';
                          statusLabel = '🟡 Needs Practice';
                        }

                        return (
                          <div
                            key={item.topicName}
                            className={`p-3.5 rounded-2xl border ${badgeStyle} space-y-2 transition-all shadow-md`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-extrabold text-xs text-white truncate" title={item.topicName}>
                                {item.topicName}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black border bg-slate-950/80">
                                {statusLabel}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-xs pt-0.5">
                              <div className="space-x-2 text-[11px]">
                                <span className="text-emerald-400 font-bold">✓ {item.correct} Correct</span>
                                <span className="text-rose-400 font-bold">✗ {item.incorrect} Wrong</span>
                              </div>
                              <span className="font-black text-xs text-white">{item.accuracyPct}% Score</span>
                            </div>

                            {/* Accuracy Bar */}
                            <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                              <div
                                className={`h-full transition-all duration-500 ${
                                  item.status === 'weak'
                                    ? 'bg-rose-500'
                                    : item.status === 'average'
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
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
                    className="px-8 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold shadow-xl shadow-indigo-600/30 text-sm flex items-center gap-2 transition-all transform hover:scale-[1.02]"
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>Return to Dashboard</span>
                  </button>
                </div>
              </div>
            )}

            {/* Question Card Box */}
            {activeQueue[currentIndex] && (
              <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 sm:p-9 space-y-6 shadow-2xl relative backdrop-blur-xl">
                {/* Meta info */}
                <div className="flex items-center justify-between text-xs border-b border-slate-800/80 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-bold">
                      {activeQueue[currentIndex].subject}
                    </span>
                    {activeQueue[currentIndex].category && (
                      <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-medium">
                        {activeQueue[currentIndex].category}
                      </span>
                    )}
                  </div>
                  {progress[activeQueue[currentIndex].id]?.isMastered && (
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1">
                      <Trophy className="w-3.5 h-3.5" /> 100% Mastered Previously
                    </span>
                  )}
                </div>

                {/* Question Statement */}
                <div>
                  <h3 className="text-lg sm:text-xl font-extrabold text-white leading-relaxed tracking-tight">
                    {currentIndex + 1}. {activeQueue[currentIndex].questionText}
                  </h3>
                </div>

                {/* Options List */}
                <div className="space-y-3 pt-2">
                  {activeQueue[currentIndex].options.map((optText, optIdx) => {
                    const qId = activeQueue[currentIndex].id;
                    const isSelected = userAnswers[qId] === optIdx;
                    const isCorrect = activeQueue[currentIndex].correctOptionIndex === optIdx;

                    let optionStyle = 'bg-slate-950/70 border-slate-800 text-slate-200 hover:bg-slate-800/80 hover:border-slate-700';

                    if (isSubmitted) {
                      if (isCorrect) {
                        optionStyle = 'bg-emerald-950/80 border-emerald-500 text-emerald-200 font-bold shadow-lg shadow-emerald-900/30';
                      } else if (isSelected && !isCorrect) {
                        optionStyle = 'bg-rose-950/80 border-rose-500 text-rose-200 line-through opacity-80';
                      } else {
                        optionStyle = 'bg-slate-950/30 border-slate-900 text-slate-500 opacity-50';
                      }
                    } else if (isSelected) {
                      optionStyle = 'bg-indigo-950/90 border-indigo-500 text-indigo-100 font-bold ring-2 ring-indigo-500/50 shadow-lg shadow-indigo-950/50';
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
                                ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/40'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span className="text-sm font-medium">{optText}</span>
                        </div>

                        {isSubmitted && (
                          <div>
                            {isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                            {isSelected && !isCorrect && <XCircle className="w-5 h-5 text-rose-400" />}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Explanation Section */}
                {isSubmitted && (
                  <div className="mt-6 border-t border-slate-800 pt-6">
                    <button
                      onClick={() => toggleExplanation(activeQueue[currentIndex].id)}
                      className="w-full flex items-center justify-between p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 hover:bg-indigo-950/50 transition-colors text-indigo-300"
                    >
                      <div className="flex items-center gap-2 font-bold text-sm">
                        <Lightbulb className="w-5 h-5 text-amber-400" />
                        <span>Step-by-Step Solution & Explanation</span>
                      </div>
                      <span className="text-xs font-extrabold text-indigo-400">
                        {showExplanationMap[activeQueue[currentIndex].id] ? 'Hide Solution' : 'View Solution'}
                      </span>
                    </button>

                    {showExplanationMap[activeQueue[currentIndex].id] && (
                      <div className="mt-3 p-5 rounded-2xl bg-slate-950 border border-indigo-900/50 text-slate-300 text-sm space-y-2.5 animate-fadeIn">
                        <p className="font-bold text-emerald-400 flex items-center gap-1.5">
                          <Check className="w-4 h-4 text-emerald-400" /> Correct Answer: Option{' '}
                          {String.fromCharCode(65 + activeQueue[currentIndex].correctOptionIndex)} (
                          {activeQueue[currentIndex].options[activeQueue[currentIndex].correctOptionIndex]})
                        </p>
                        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 leading-relaxed font-medium">
                          {activeQueue[currentIndex].explanation}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Navigation Bar */}
                <div className="flex items-center justify-between border-t border-slate-800/80 pt-6">
                  <button
                    onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                    disabled={currentIndex === 0}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-700/60"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </button>

                  <div className="flex items-center gap-2">
                    {!isSubmitted && (
                      <button
                        onClick={handleSubmitTest}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-xl shadow-emerald-600/30 transition-all flex items-center gap-1.5 transform hover:scale-[1.02]"
                      >
                        <CheckCircle2 className="w-4 h-4" />
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
                        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20"
                      >
                        Next <ChevronRight className="w-4 h-4" />
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
            {/* Filter & Control Panel */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <Filter className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-base font-extrabold text-white tracking-tight">Filter & Select Practice Set</h2>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleBatchReassignSubject}
                    className="px-3 py-1.5 rounded-xl bg-indigo-950/80 hover:bg-indigo-900/80 text-indigo-300 text-xs font-semibold transition-colors border border-indigo-700/60 flex items-center gap-1.5 shadow-sm"
                    title="Move all displayed questions to a single Subject"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Merge to Subject</span>
                  </button>

                  <button
                    onClick={handleResetProgress}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors border border-slate-700/80 flex items-center gap-1.5"
                    title="Reset all mastered questions back to practice list"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Reset Mastery</span>
                  </button>

                  <button
                    onClick={handleClearAllQuestions}
                    className="px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 text-xs font-semibold transition-colors border border-rose-800/60 flex items-center gap-1.5"
                    title="Delete all questions from storage"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Clear Storage</span>
                  </button>
                </div>
              </div>

              {/* View Mode Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                <button
                  onClick={() => setViewMode('unmastered')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                    viewMode === 'unmastered'
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                  }`}
                >
                  <span>Active Questions</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-900/80 text-[10px] font-black">
                    {stats.unmasteredCount}
                  </span>
                </button>

                <button
                  onClick={() => setViewMode('focus')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                    viewMode === 'focus'
                      ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                  }`}
                  title="Questions attempted but answered incorrectly (needs focus/revision)"
                >
                  <Flame className="w-3.5 h-3.5 text-amber-300" />
                  <span>Focus List</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-900/80 text-[10px] font-black">
                    {stats.focusCount}
                  </span>
                </button>

                <button
                  onClick={() => setViewMode('mastered')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                    viewMode === 'mastered'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>100% Mastered</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-900/80 text-[10px] font-black">
                    {stats.masteredCount}
                  </span>
                </button>

                <button
                  onClick={() => setViewMode('all')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                    viewMode === 'all'
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                  }`}
                >
                  <span>All Questions</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-900/80 text-[10px] font-black">{stats.total}</span>
                </button>
              </div>

              {/* Subject Category Selectors & Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {availableSubjects.map((subject) => {
                    const normS = subject.trim().toLowerCase();
                    const count = subject === 'All Subjects'
                      ? questions.length
                      : questions.filter((q) => (q.subject || '').trim().toLowerCase() === normS).length;
                    return (
                      <button
                        key={subject}
                        onClick={() => {
                          setSelectedSubject(subject);
                          setSelectedTopic('All Topics');
                        }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                          selectedSubject.trim().toLowerCase() === normS
                            ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300 shadow-md'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-300'
                        }`}
                      >
                        <span>{subject}</span>
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-900 text-[10px] text-indigo-300 font-black">
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="relative min-w-[220px]">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search questions..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Topic Sub-Category Pills (Level 2 Filter under Subject) */}
              {availableTopics.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-2 scrollbar-thin border-t border-slate-800/60">
                  <span className="text-[11px] font-extrabold text-slate-400 whitespace-nowrap flex items-center gap-1 shrink-0">
                    <Filter className="w-3 h-3 text-indigo-400" /> Topics:
                  </span>
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
                    return (
                      <button
                        key={topic}
                        onClick={() => setSelectedTopic(topic)}
                        className={`px-3 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                          selectedTopic.trim().toLowerCase() === normTop
                            ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-sm font-bold'
                            : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
                        }`}
                      >
                        <span>{topic}</span>
                        <span className="px-1.5 py-0.5 rounded-full bg-slate-900 text-[10px] text-slate-300 font-extrabold">
                          {topicQuestions.length}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Launch Practice Test Banner */}
            <div className="bg-gradient-to-r from-indigo-900/50 via-purple-900/40 to-slate-900 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl backdrop-blur-xl">
              <div className="space-y-1.5 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                  <h3 className="text-xl font-black text-white tracking-tight">Ready to Start Practice Session?</h3>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 max-w-xl font-medium">
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
                className="w-full sm:w-auto px-9 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 disabled:opacity-40 text-white font-black text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2.5 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <Brain className="w-5 h-5" />
                <span>Start Session ({filteredQuestions.length})</span>
              </button>
            </div>

            {/* Question List Preview & Explanations Browser */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                  <span>Question Bank ({filteredQuestions.length})</span>
                </h3>
                <span className="text-xs text-slate-500 font-medium">Click any question to view solution</span>
              </div>

              {filteredQuestions.length === 0 ? (
                <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center space-y-4 shadow-xl">
                  {stats.total === 0 ? (
                    <>
                      <FileText className="w-14 h-14 text-indigo-400 mx-auto" />
                      <h4 className="text-lg font-bold text-white">No Questions in Question Bank</h4>
                      <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                        Your question bank is empty. Click <strong>"Bulk PDF Import"</strong> to paste your PDF text and import questions instantly in 1 click!
                      </p>
                      <button
                        onClick={() => setIsBulkModalOpen(true)}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold shadow-lg shadow-emerald-600/30"
                      >
                        Open Bulk PDF Importer
                      </button>
                    </>
                  ) : (
                    <>
                      <Trophy className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                      <h4 className="text-base font-bold text-white">All Questions Mastered in this Filter!</h4>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        Congratulations! You have scored 100% on all questions under this category. Switch filters or reset mastery to practice again.
                      </p>
                      <button
                        onClick={() => setViewMode('all')}
                        className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-indigo-300 border border-slate-700"
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

                    return (
                      <div
                        key={q.id}
                        className={`bg-slate-900/80 backdrop-blur-lg border rounded-2xl transition-all overflow-hidden shadow-md ${
                          isMastered
                            ? 'border-emerald-900/50 hover:border-emerald-500/50'
                            : 'border-slate-800/90 hover:border-slate-700'
                        }`}
                      >
                        <div className="p-4 sm:p-5 space-y-4">
                          {/* Question Top Header */}
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1.5 flex-1">
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="font-black text-indigo-400">#{idx + 1}</span>
                                <span className="px-2.5 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-900/60 text-indigo-300 font-bold text-[11px]">
                                  {q.subject}
                                </span>
                                {q.category && (
                                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800/90 text-slate-300 border border-slate-700/80 font-semibold text-[11px]">
                                    Topic: <strong className="text-white">{q.category}</strong>
                                  </span>
                                )}
                                {isMastered && (
                                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1 text-[11px]">
                                    <Check className="w-3 h-3" /> 100% Mastered
                                  </span>
                                )}
                              </div>
                              <h4 className="text-sm sm:text-base font-extrabold text-white leading-relaxed pt-1">
                                {q.questionText}
                              </h4>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                onClick={() => toggleExplanation(q.id)}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 bg-indigo-950/70 text-indigo-300 hover:bg-indigo-900/80 border border-indigo-500/30 shadow-md"
                              >
                                <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                                <span>{isOpenExp ? 'Hide Solution' : 'View Solution'}</span>
                              </button>

                              <button
                                onClick={() => handleDeleteQuestion(q.id)}
                                className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                                title="Delete Question"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Options Grid A, B, C, D (Always Rendered Below Question Statement) */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                            {q.options.map((opt, oIdx) => {
                              const isCorrect = oIdx === q.correctOptionIndex;
                              return (
                                <div
                                  key={oIdx}
                                  className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2.5 transition-all ${
                                    isOpenExp && isCorrect
                                      ? 'bg-emerald-950/70 border-emerald-500/80 text-emerald-200 font-bold shadow-md'
                                      : 'bg-slate-950/60 border-slate-800/90 text-slate-300'
                                  }`}
                                >
                                  <span
                                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0 ${
                                      isOpenExp && isCorrect
                                        ? 'bg-emerald-500 text-slate-950'
                                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                                    }`}
                                  >
                                    {String.fromCharCode(65 + oIdx)}
                                  </span>
                                  <span className="leading-snug">{opt}</span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Correct Answer & Explanation / Solution Box (Expanded AT THE BOTTOM) */}
                          {isOpenExp && (
                            <div className="pt-3 border-t border-slate-800/80 space-y-3 animate-fadeIn">
                              <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 shadow-sm">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                <span>
                                  Correct Answer: Option {String.fromCharCode(65 + q.correctOptionIndex)} — {q.options[q.correctOptionIndex]}
                                </span>
                              </div>

                              <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-slate-200 space-y-1.5">
                                <div className="flex items-center gap-1.5 text-indigo-300 font-extrabold">
                                  <Lightbulb className="w-4 h-4 text-amber-400" />
                                  <span>Explanation & Solution (Vyakhya):</span>
                                </div>
                                <p className="leading-relaxed text-slate-300 font-medium">{q.explanation}</p>
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
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white">Add Custom Question</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateQuestion} className="space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Subject</label>
                  <select
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                  >
                    {DEFAULT_SUBJECTS.filter((s) => s !== 'All Subjects').map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Topic / Category</label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="e.g. Algebra, Formulas, GST"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Question Statement</label>
                <textarea
                  required
                  rows={3}
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  placeholder="Enter the question text here..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className="block font-medium text-slate-300">Answer Options (4 Options)</label>
                {newOptions.map((opt, oIdx) => (
                  <div key={oIdx} className="flex items-center gap-2">
                    <span className="w-6 font-bold text-indigo-400 text-center">
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
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                    />
                    <input
                      type="radio"
                      name="correctOption"
                      checked={newCorrectIndex === oIdx}
                      onChange={() => setNewCorrectIndex(oIdx)}
                      className="w-4 h-4 accent-indigo-500"
                      title="Select as Correct Answer"
                    />
                  </div>
                ))}
              </div>

              {/* Explanation */}
              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Detailed Solution / Explanation
                </label>
                <textarea
                  rows={2}
                  value={newExplanation}
                  onChange={(e) => setNewExplanation(e.target.value)}
                  placeholder="Explain why this answer is correct..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30"
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
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh] backdrop-blur-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30 shadow-md">
                  <FileText className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
                    <span>Bulk PDF & Text Question Importer</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold uppercase">
                      Auto-AI Parser
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Attach any PDF question file or paste raw text to parse and import 100s of questions at once.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {bulkImportSuccessMsg ? (
              <div className="p-8 text-center space-y-3 bg-emerald-950/40 border border-emerald-500/40 rounded-3xl animate-fadeIn">
                <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto animate-bounce" />
                <h4 className="text-2xl font-black text-emerald-300 tracking-tight">{bulkImportSuccessMsg}</h4>
                <p className="text-xs text-slate-300 font-medium">All questions have been loaded into your practice set & synced to cloud.</p>
              </div>
            ) : (
              <form onSubmit={handleExecuteBulkImport} className="space-y-5 text-xs sm:text-sm">
                {/* Compact PDF File Attachment Zone */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 transition-all flex flex-wrap items-center justify-between gap-3 shadow-inner">
                  <input
                    ref={pdfFileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handlePdfFileUpload}
                    className="hidden"
                  />
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                      {isPdfExtracting ? (
                        <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
                      ) : (
                        <Upload className="w-5 h-5 text-emerald-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-white">
                        {isPdfExtracting ? 'Extracting Text from PDF File...' : 'Attach PDF Question File'}
                      </p>
                      <p className="text-[11px] text-slate-400 font-medium">
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
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-emerald-400 border border-emerald-500/30 font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Choose PDF File</span>
                  </button>
                </div>

                {/* Subject Selector with Manual Custom Subject Addition Option */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-slate-300 text-xs">Default Subject Category</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomSubject(!isCustomSubject);
                        if (!isCustomSubject) setCustomSubject('');
                      }}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-bold underline"
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
                      className="w-full bg-slate-950 border border-indigo-500/80 rounded-xl p-3 text-xs text-white font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-inner"
                    />
                  ) : (
                    <div className="relative">
                      <select
                        value={bulkSubject}
                        onChange={(e) => setBulkSubject(e.target.value)}
                        className="w-full border border-slate-800 rounded-xl p-3 text-xs font-bold focus:outline-none focus:border-indigo-500 shadow-inner cursor-pointer"
                        style={{ backgroundColor: '#020617', color: '#f8fafc' }}
                      >
                        {availableSubjects.filter((s) => s !== 'All Subjects').map((s) => (
                          <option key={s} value={s} style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>
                            {s}
                          </option>
                        ))}
                        {availableSubjects.length <= 1 && (
                          <>
                            <option value="Medical & Science" style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>
                              Medical & Science
                            </option>
                            <option value="Mathematics" style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>
                              Mathematics
                            </option>
                            <option value="Accounting & GST" style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>
                              Accounting & GST
                            </option>
                            <option value="General Knowledge" style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>
                              General Knowledge
                            </option>
                          </>
                        )}
                      </select>
                    </div>
                  )}
                </div>

                {/* Large Raw Text Box */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-slate-300 text-xs">
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
                      className="text-xs text-indigo-400 hover:text-indigo-300 underline font-bold"
                    >
                      Paste Sample PDF Text
                    </button>
                  </div>

                  <textarea
                    rows={14}
                    value={bulkRawText}
                    onChange={(e) => setBulkRawText(e.target.value)}
                    placeholder="Paste PDF raw text here or attach a PDF file above to extract text automatically..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-slate-200 font-sans text-xs focus:outline-none focus:border-indigo-500 leading-relaxed shadow-inner"
                  />
                </div>

                {/* Parser Result & Live Preview */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Brain className="w-5 h-5 text-indigo-400" />
                      <div>
                        <p className="text-xs font-extrabold text-white">Live Parser Status:</p>
                        <p className="text-xs text-slate-400 font-medium">
                          {parsedPreviewQuestions.length > 0
                            ? `Successfully detected ${parsedPreviewQuestions.length} complete questions with options & explanations!`
                            : 'Attach a PDF file or paste text above to start automatic parsing.'}
                        </p>
                      </div>
                    </div>

                    {parsedPreviewQuestions.length > 0 && (
                      <span className="px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black flex items-center gap-1.5 shadow-sm">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{parsedPreviewQuestions.length} Questions Ready</span>
                      </span>
                    )}
                  </div>

                  {/* Sample Live Question Preview Card */}
                  {parsedPreviewQuestions.length > 0 && (
                    <div className="mt-2 p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
                      <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                        Sample Preview (Question 1 of {parsedPreviewQuestions.length}):
                      </p>
                      <p className="font-extrabold text-white">{parsedPreviewQuestions[0].questionText}</p>
                      <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
                        {parsedPreviewQuestions[0].options.map((opt, oIdx) => (
                          <div
                            key={oIdx}
                            className={`p-1.5 px-2.5 rounded-lg border ${
                              oIdx === parsedPreviewQuestions[0].correctOptionIndex
                                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 font-bold'
                                : 'bg-slate-950/60 border-slate-800 text-slate-400'
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
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
                  <span className="text-xs text-slate-500 font-medium">
                    * Supports Q1., (A)-(D), Answer:, and Explanation: formats.
                  </span>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsBulkModalOpen(false)}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={parsedPreviewQuestions.length === 0}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-40 text-white text-xs font-black shadow-xl shadow-emerald-600/30 flex items-center gap-2 transform hover:scale-[1.02] transition-all"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Import {parsedPreviewQuestions.length} Questions (1-Click)</span>
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
