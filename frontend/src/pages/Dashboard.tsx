import { motion, AnimatePresence } from "motion/react";
import {
  MessageSquare, Mic, Settings, User, Brain, Activity, LogOut, Loader2,
  Zap, TrendingUp, Target, CheckCircle, Clock, Search, Sparkles,
  ChevronRight, ArrowRight, BookOpen, Lightbulb, Bell, MoreVertical,
  Calendar, BarChart3, PlusCircle, PieChart, Cpu, Database, Shield, Play,
  History, Rocket
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTutorial } from "../context/TutorialContext";
import React, { useEffect, useState, useRef } from "react";
import SpotifyPlayer from "../components/SpotifyPlayer";
import CalendarWidget from "../components/CalendarWidget";
import LoadingAnimation from "../components/LoadingAnimation";
import ConversationLauncher from "../components/ConversationLauncher";
import { buildApiUrl } from "../constants";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

function timeAgo(dateInput?: string | number | Date | null) {
  if (!dateInput) return "Just now";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "Just now";
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const INSIGHT_TEMPLATES = [
  (s: number, k: number) => `You've been consistent for ${s} day${s === 1 ? "" : "s"} — your twin is starting to anticipate your routines before you log them.`,
  (s: number, k: number) => `Your twin has picked up on ${k} distinct knowledge points. Patterns are emerging in how you make decisions.`,
  (s: number, k: number) => `Every conversation sharpens the model of you. Keep talking — the twin learns fastest from real dialogue, not forms.`,
  (s: number, k: number) => `Your activity streak suggests mornings are when you're most reflective. Consider checking in with your twin early today.`,
  (s: number, k: number) => `Small, frequent updates teach your twin more than long ones. A 30-second check-in today keeps the model sharp.`,
];

/* ------------------------------------------------------------------ */
/* Small presentational primitives                                    */
/* ------------------------------------------------------------------ */

function CircularProgress({ percentage, size = 56, stroke = 5, label }: { percentage: number; size?: number; stroke?: number; label?: string }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percentage));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="transparent"
          className="text-white/10"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#twinGradient)"
          strokeWidth={stroke}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
        <defs>
          <linearGradient id="twinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-primary, #7C6BFF)" />
            <stop offset="100%" stopColor="var(--color-secondary, #34D8B0)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-xs font-bold">{Math.round(clamped)}%</span>
        {label && <span className="text-[7px] text-white/40 uppercase tracking-wider">{label}</span>}
      </div>
    </div>
  );
}

function AnimatedCounter({ value, duration = 1200, decimals = 0 }: { value: number; duration?: number; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const to = value || 0;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(from + (to - from) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(to);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <>{display.toFixed(decimals)}</>;
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-white/5 rounded-2xl ${className}`} />;
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { startTutorial } = useTutorial();
  const navigate = useNavigate();
  const [twinData, setTwinData] = useState<any>(null);
  const [msgCount, setMsgCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAvatarLoading, setIsAvatarLoading] = useState(true);
  const [quickAsk, setQuickAsk] = useState("");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const [todayData, setTodayData] = useState<any>(null);
  const [memoryData, setMemoryData] = useState<any>(null);
  const [streak, setStreak] = useState(0);
  const [dashSummary, setDashSummary] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // --- New "living twin" state ---
  const [lastSynced, setLastSynced] = useState<string>("Just now");
  const [todaySummary, setTodaySummary] = useState<any>(null);
  const [prediction, setPrediction] = useState<any>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);
  const [showLauncher, setShowLauncher] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    // Auto-start tutorial for new users
    const hasSeenTutorial = localStorage.getItem('vitra_tutorial_completed');
    if (!hasSeenTutorial) {
      setTimeout(() => {
        startTutorial();
      }, 1500);
    }

    const fetchData = async () => {
      try {
        const token = localStorage.getItem("vitra_token");
        const headers = { "Authorization": `Bearer ${token}` };

        // Fetch Twin Data
        const twinRes = await fetch(buildApiUrl("/api/twins"), { headers });
        let twin: any = null;
        if (twinRes.ok) {
          twin = await twinRes.json();
          setTwinData(twin);
          if (!twin?.avatarUrl && !user?.photoURL) {
            setIsAvatarLoading(false);
          } else {
            setIsAvatarLoading(true);
          }
          setLastSynced(timeAgo(twin?.updatedAt || twin?.lastSyncedAt));
        }

        // Fetch Sessions to count messages
        let sessions: any[] = [];
        const sessionsRes = await fetch(buildApiUrl("/api/sessions"), { headers });
        if (sessionsRes.ok) {
          sessions = await sessionsRes.json();
          let totalMsgs = 0;
          for (const session of sessions) {
            const msgsRes = await fetch(buildApiUrl(`/api/sessions/${session.id}/messages`), { headers });
            if (msgsRes.ok) {
              const msgs = await msgsRes.json();
              totalMsgs += msgs.length;
            }
          }
          setMsgCount(totalMsgs);
          if (sessions.length > 0) {
            const sorted = [...sessions].sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
            setLastSessionId(sorted[0]?.id ?? null);
          }
        }

        // Fetch Today's Daily Data
        const today = new Date().toISOString().split('T')[0];
        const dailyRes = await fetch(buildApiUrl(`/api/daily-data/${today}`), { headers });
        let today_: any = null;
        if (dailyRes.ok) {
          today_ = await dailyRes.json();
          setTodayData(today_);
        }

        // Fetch Memory Data for Nudges
        const memoryRes = await fetch(buildApiUrl(`/api/memory/${user.id}`), { headers });
        let memory: any = null;
        if (memoryRes.ok) {
          memory = await memoryRes.json();
          setMemoryData(memory);

          // Calculate Streak
          let currentStreak = 0;
          if (memory.dailyLogs && memory.dailyLogs.length > 0) {
            const sortedLogs = [...memory.dailyLogs].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const today2 = new Date();
            today2.setHours(0, 0, 0, 0);

            let lastDate = new Date(sortedLogs[0].date);
            lastDate.setHours(0, 0, 0, 0);

            const diffDays = Math.floor((today2.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays <= 1) {
              currentStreak = 1;
              for (let i = 1; i < sortedLogs.length; i++) {
                const prevDate = new Date(sortedLogs[i - 1].date);
                prevDate.setHours(0, 0, 0, 0);
                const currDate = new Date(sortedLogs[i].date);
                currDate.setHours(0, 0, 0, 0);

                const diff = Math.floor((prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24));
                if (diff === 1) {
                  currentStreak++;
                } else {
                  break;
                }
              }
            }
            setStreak(currentStreak);
          }
        }

        // --- Today's Summary + Prediction: try backend, fall back to local computation ---
        try {
          const summaryRes = await fetch(buildApiUrl("/api/dashboard/summary"), { headers });
          if (summaryRes.ok) {
            setTodaySummary(await summaryRes.json());
          } else {
            throw new Error("no summary endpoint");
          }
        } catch {
          const knowledgeCount = twin?.knowledge?.length || 0;
          const memoryCount = twin?.memory?.length || 0;
          setTodaySummary({
            newMemories: Math.max(0, memoryCount - Math.max(0, memoryCount - 3)),
            conversationsRemembered: msgCount || sessions.length || 0,
            personalityImprovement: Math.min(15, Math.round((knowledgeCount + memoryCount) * 0.8)),
            productivityScore: today_
              ? Math.min(100, Math.round(((today_.workHours || 0) + (today_.studyHours || 0)) * 10))
              : null,
          });
        }

        try {
          const predictionRes = await fetch(buildApiUrl("/api/dashboard/predictions"), { headers });
          if (predictionRes.ok) {
            setPrediction(await predictionRes.json());
          } else {
            throw new Error("no prediction endpoint");
          }
        } catch {
          const peak = memory?.computedInsights?.peakProductivityTime;
          const day = memory?.computedInsights?.mostProductiveDay;
          const preds: string[] = [];
          if (peak && peak !== "Unknown") preds.push(`Likely to be most focused around ${peak} today.`);
          if (day && day !== "Unknown") preds.push(`Based on history, ${day}s tend to be your most productive day.`);
          preds.push(msgCount > 10
            ? "You're likely to start a new conversation before the day is out."
            : "A short check-in today would meaningfully improve twin accuracy.");
          setPrediction({ items: preds.slice(0, 3) });
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
        setInsightsLoading(false);
      }
    };

    fetchData();
  }, [user, navigate]);

  const handleQuickAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAsk.trim()) return;
    navigate(`/chat?q=${encodeURIComponent(quickAsk)}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#050505]">
        <LoadingAnimation label="Loading dashboard..." />
      </div>
    );
  }

  const knowledgeCount = twinData?.knowledge?.length || 0;
  const memoryCount = twinData?.memory?.length || 0;
  const learnedTraits = twinData?.learnedTraits || {};
  const learnedTraitCount = Object.values(learnedTraits).reduce((count: number, value: any) => {
    if (Array.isArray(value)) return count + value.length;
    return count + (value ? 1 : 0);
  }, 0);
  const dailyLogCount = memoryData?.dailyLogs?.length || 0;
  const hasLearningBase = knowledgeCount > 0 || memoryCount > 0 || learnedTraitCount > 0 || msgCount > 0 || dailyLogCount > 0;
  const isNewUser = !hasLearningBase;
  // Realistic sync score: each factor contributes a capped slice, max ~85%
  const syncPercentage = twinData ? Math.min(
    Math.round(
      Math.min(knowledgeCount * 3, 20) +       // knowledge: up to 20pts (caps at ~7 items)
      Math.min(memoryCount * 2, 15) +           // memory: up to 15pts
      Math.min(learnedTraitCount * 1.5, 15) +   // learned traits: up to 15pts
      Math.min(msgCount * 0.5, 15) +            // conversations: up to 15pts
      Math.min(dailyLogCount * 2, 10) +         // daily logs: up to 10pts
      (streak > 2 ? 5 : streak > 0 ? 2 : 0)    // streak bonus: up to 5pts
    ), 85
  ) : 0;
  const behaviorCards = learnedTraits.behaviorTraits?.length
    ? learnedTraits.behaviorTraits
    : [
        memoryData?.computedInsights?.personalityInsights && `Communication style: ${memoryData.computedInsights.personalityInsights}`,
        memoryData?.computedInsights?.peakProductivityTime && memoryData.computedInsights.peakProductivityTime !== 'Unknown' && `Most active around ${memoryData.computedInsights.peakProductivityTime}`,
        memoryData?.computedInsights?.mostProductiveDay && memoryData.computedInsights.mostProductiveDay !== 'Unknown' && `Most productive on ${memoryData.computedInsights.mostProductiveDay}`,
        streak > 0 && `${streak}-day activity streak`
      ].filter(Boolean) as string[];

  const documentsLearned = twinData?.knowledge?.length || 0;
  const memoriesStored = (twinData?.memory?.length || 0) + dailyLogCount;
  const insightIndex = (streak + knowledgeCount + (user?.displayName?.length || 0)) % INSIGHT_TEMPLATES.length;
  const motivationalInsight = INSIGHT_TEMPLATES[insightIndex](streak, knowledgeCount);
  const greeting = getGreeting();
  const firstName = user?.displayName?.split(' ')[0] || "there";

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-8">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/5 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Top Header */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12"
        >
          <div className="flex items-center gap-4">
            <div className="relative" ref={profileRef}>
              {/* Glowing AI orb halo behind avatar */}
              <div className="absolute -inset-2 rounded-3xl bg-gradient-to-br from-primary/40 to-secondary/30 blur-xl opacity-60 animate-pulse pointer-events-none" />
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary p-[2px] transition-transform hover:scale-105"
              >
                <div className="w-full h-full rounded-2xl bg-[#050505] flex items-center justify-center overflow-hidden relative">
                  {isAvatarLoading && (twinData?.avatarUrl || user?.photoURL) && (
                    <div className="absolute inset-0 bg-white/5 animate-pulse flex items-center justify-center">
                      <Loader2 size={24} className="text-primary animate-spin" />
                    </div>
                  )}
                  {twinData?.avatarUrl ? (
                    <img
                      key={twinData.avatarUrl}
                      src={twinData.avatarUrl}
                      alt=""
                      className={`w-full h-full object-cover ${isAvatarLoading ? 'opacity-0' : 'opacity-100'}`}
                      referrerPolicy="no-referrer"
                      onLoad={(e) => {
                        setIsAvatarLoading(false);
                        e.currentTarget.style.display = 'block';
                        e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.add('hidden');
                      }}
                      onError={(e) => {
                        setIsAvatarLoading(false);
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  {(user?.photoURL && !twinData?.avatarUrl) ? (
                    <img
                      key={user.photoURL}
                      src={user.photoURL}
                      alt=""
                      className={`w-full h-full object-cover ${isAvatarLoading ? 'opacity-0' : 'opacity-100'}`}
                      referrerPolicy="no-referrer"
                      onLoad={(e) => {
                        setIsAvatarLoading(false);
                        e.currentTarget.style.display = 'block';
                        e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.add('hidden');
                      }}
                      onError={(e) => {
                        setIsAvatarLoading(false);
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  {!twinData?.avatarUrl && !user?.photoURL && (
                    <User size={32} className="text-white/40 fallback-icon" />
                  )}
                  <User size={32} className="text-white/40 fallback-icon hidden" />
                </div>
              </button>

              <AnimatePresence>
                {showProfileMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full left-0 mt-4 w-64 bg-card border border-white/10 rounded-3xl shadow-2xl p-4 z-50 backdrop-blur-xl"
                  >
                    <div className="flex items-center gap-3 p-2 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-white/5 overflow-hidden flex items-center justify-center">
                        {twinData?.avatarUrl ? (
                          <img
                            key={twinData.avatarUrl}
                            src={twinData.avatarUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onLoad={(e) => {
                              e.currentTarget.style.display = 'block';
                              e.currentTarget.parentElement?.querySelector('.fallback-icon-small')?.classList.add('hidden');
                            }}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.parentElement?.querySelector('.fallback-icon-small')?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        {(user?.photoURL && !twinData?.avatarUrl) ? (
                          <img
                            key={user.photoURL}
                            src={user.photoURL}
                            alt=""
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onLoad={(e) => {
                              e.currentTarget.style.display = 'block';
                              e.currentTarget.parentElement?.querySelector('.fallback-icon-small')?.classList.add('hidden');
                            }}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.parentElement?.querySelector('.fallback-icon-small')?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <User size={20} className={`text-white/20 fallback-icon-small ${(twinData?.avatarUrl || user?.photoURL) ? 'hidden' : ''}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{user?.displayName}</p>
                        <p className="text-[10px] text-white/40 truncate">{user?.email}</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Link to="/setup" className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-all text-sm">
                        <Settings size={16} className="text-white/40" />
                        Twin Settings
                      </Link>
                      <button
                        onClick={logout}
                        className="w-full flex items-center gap-3 p-3 hover:bg-red-500/10 text-red-500 rounded-xl transition-all text-sm"
                      >
                        <LogOut size={16} />
                        Sign Out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-secondary rounded-full border-4 border-[#050505] flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              </div>
            </div>
            <div id="dashboard-welcome">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">{firstName}</span>
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-secondary bg-secondary/10 px-2 py-0.5 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                  Twin Active
                </span>
                <span className="flex items-center gap-1.5 text-xs text-white/40">
                  <Clock size={12} /> Last synced {lastSynced}
                </span>
                <span className="flex items-center gap-2 text-xs text-white/40">
                  <CircularProgress percentage={syncPercentage} size={26} stroke={3} />
                  Learning Confidence
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={startTutorial}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white px-4 py-2 rounded-2xl border border-white/10 transition-all text-xs font-bold"
            >
              <Sparkles size={14} className="text-primary" />
              Tutorial
            </button>
            <div className="flex-1 md:flex-none flex items-center gap-4 bg-white/5 border border-white/10 px-4 py-2 rounded-2xl">
              <div className="flex-1 md:w-32">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-white/40 uppercase tracking-wider font-bold">Sync Progress</span>
                  <span className="text-secondary font-bold">{syncPercentage}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${syncPercentage}%` }}
                    className="h-full bg-gradient-to-r from-primary to-secondary"
                  />
                </div>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-3 hover:bg-white/5 rounded-2xl text-white/40 hover:text-white transition-all border border-white/5"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </motion.header>

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-8 space-y-8">
            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <button id="nav-chat" onClick={() => setShowLauncher(true)} className="p-6 rounded-3xl bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all group text-left">
                <MessageSquare className="text-primary mb-3 group-hover:scale-110 transition-transform" size={24} />
                <p className="font-bold text-sm">New Chat</p>
                <p className="text-[10px] text-white/40 mt-1">Talk to your twin</p>
              </button>
              <Link id="nav-tracker" to="/tracker" className="p-6 rounded-3xl bg-secondary/10 border border-secondary/20 hover:bg-secondary/20 transition-all group">
                <Calendar className="text-secondary mb-3 group-hover:scale-110 transition-transform" size={24} />
                <p className="font-bold text-sm">Daily Tracker</p>
                <p className="text-[10px] text-white/40 mt-1">Log your day</p>
              </Link>
              <Link id="nav-goals" to="/goals" className="p-6 rounded-3xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-all group">
                <Target className="text-blue-400 mb-3 group-hover:scale-110 transition-transform" size={24} />
                <p className="font-bold text-sm">Goals</p>
                <p className="text-[10px] text-white/40 mt-1">Plan milestones</p>
              </Link>
              <Link id="nav-documents" to="/documents" className="p-6 rounded-3xl bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20 transition-all group">
                <BookOpen className="text-violet-400 mb-3 group-hover:scale-110 transition-transform" size={24} />
                <p className="font-bold text-sm">Documents</p>
                <p className="text-[10px] text-white/40 mt-1">Upload knowledge</p>
              </Link>
              <Link id="nav-timeline" to="/timeline" className="p-6 rounded-3xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all group">
                <BarChart3 className="text-amber-400 mb-3 group-hover:scale-110 transition-transform" size={24} />
                <p className="font-bold text-sm">Timeline</p>
                <p className="text-[10px] text-white/40 mt-1">View twin history</p>
              </Link>
              <Link id="nav-insights" to="/insights" className="p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all group">
                <BarChart3 className="text-emerald-400 mb-3 group-hover:scale-110 transition-transform" size={24} />
                <p className="font-bold text-sm">Insights</p>
                <p className="text-[10px] text-white/40 mt-1">AI Analysis</p>
              </Link>
              <Link id="nav-setup" to="/setup" className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group">
                <Settings className="text-white/40 mb-3 group-hover:scale-110 transition-transform" size={24} />
                <p className="font-bold text-sm">Settings</p>
                <p className="text-[10px] text-white/40 mt-1">Configure twin</p>
              </Link>
            </div>

            {/* Proactive Nudges Section */}
            {memoryData?.computedInsights?.nudges?.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <Bell size={20} className="text-primary" />
                  <h3 className="text-xl font-bold tracking-tight">Proactive Nudges</h3>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {memoryData.computedInsights.nudges.map((nudge: any) => (
                    <motion.div
                      key={nudge.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-6 rounded-[32px] bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 relative overflow-hidden group"
                    >
                      <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                            <Sparkles size={16} className="text-primary" />
                          </div>
                          <span className="text-xs font-bold uppercase tracking-wider text-primary">{nudge.title}</span>
                        </div>
                        <p className="text-sm text-white/70 mb-4 leading-relaxed">
                          {nudge.message}
                        </p>
                        <button
                          onClick={() => {
                            if (nudge.action === 'Chat Now') navigate('/chat');
                            else if (nudge.action === 'Schedule Sleep' || nudge.action === 'Take a Break') navigate('/tracker');
                          }}
                          className="flex items-center gap-2 text-xs font-bold text-white bg-primary/20 hover:bg-primary/40 px-4 py-2 rounded-xl transition-all"
                        >
                          {nudge.action}
                          <ArrowRight size={14} />
                        </button>
                      </div>
                      <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Brain size={80} />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Hero AI Card */}
            {isNewUser ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="group relative p-8 md:p-10 rounded-[40px] bg-gradient-to-br from-white/[0.08] to-transparent border border-white/10 overflow-hidden text-center"
              >
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/30 to-secondary/20 flex items-center justify-center mb-6 relative">
                    <div className="absolute inset-0 rounded-3xl bg-primary/30 blur-2xl animate-pulse" />
                    <Brain size={36} className="text-primary relative z-10" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3">Your Twin Is Waiting</span>
                  <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight max-w-xl">
                    {firstName}, your digital twin hasn't learned anything about you yet
                  </h2>
                  <p className="text-white/50 text-base mb-8 max-w-md leading-relaxed">
                    Add a few pieces of knowledge, log a day, or send your first message — every bit of input starts training your twin's model of you.
                  </p>
                  <div className="flex flex-wrap justify-center gap-4">
                    <Link to="/setup" className="bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3 transition-all shadow-xl shadow-primary/20">
                      <Rocket size={20} />
                      Start Learning
                    </Link>
                    <Link to="/chat" className="bg-white/5 hover:bg-white/10 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3 border border-white/10 transition-all">
                      <MessageSquare size={20} />
                      Chat Now
                    </Link>
                  </div>
                </div>
                <Brain className="absolute -right-16 -bottom-16 w-80 h-80 text-primary/5 group-hover:text-primary/10 transition-all duration-700 rotate-12" />
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="group relative p-8 md:p-10 rounded-[40px] bg-gradient-to-br from-white/[0.08] to-transparent border border-white/10 overflow-hidden"
              >
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-6">
                    <Sparkles size={18} className="text-primary" />
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Intelligence Report</span>
                  </div>
                  <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
                    Your Twin is <span className="text-primary">{syncPercentage}%</span> Synced
                  </h2>
                  <p className="text-white/50 text-lg mb-6 max-w-xl leading-relaxed">
                    {motivationalInsight}
                  </p>

                  {/* Animated stat counters */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                      <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Conversations</p>
                      <p className="text-2xl font-bold text-white">
                        <AnimatedCounter value={msgCount} />
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                      <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Docs Learned</p>
                      <p className="text-2xl font-bold text-white">
                        <AnimatedCounter value={documentsLearned} />
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                      <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Memories Stored</p>
                      <p className="text-2xl font-bold text-white">
                        <AnimatedCounter value={memoriesStored} />
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                      <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Twin Accuracy</p>
                      <p className="text-2xl font-bold text-white">
                        <AnimatedCounter value={syncPercentage} />%
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <button onClick={() => setShowLauncher(true)} className="bg-primary hover:bg-primary/90 text-white px-6 py-4 rounded-2xl font-bold flex items-center gap-3 transition-all shadow-xl shadow-primary/20">
                      <MessageSquare size={20} />
                      Chat Now
                    </button>
                    <button
                      onClick={() => setShowLauncher(true)}
                      className="bg-white/5 hover:bg-white/10 text-white px-6 py-4 rounded-2xl font-bold flex items-center gap-3 border border-white/10 transition-all"
                    >
                      <Play size={20} />
                      Continue Yesterday
                    </button>
                    <Link to="/timeline" className="bg-white/5 hover:bg-white/10 text-white px-6 py-4 rounded-2xl font-bold flex items-center gap-3 border border-white/10 transition-all">
                      <Database size={20} />
                      Memory Vault
                    </Link>
                    <button
                      onClick={() => {
                        setShowToast(true);
                        setTimeout(() => setShowToast(false), 3000);
                      }}
                      className="bg-white/5 hover:bg-white/10 text-white px-6 py-4 rounded-2xl font-bold flex items-center gap-3 border border-white/10 transition-all"
                    >
                      <Mic size={20} />
                      Voice Chat
                    </button>
                  </div>
                </div>

                <Brain className="absolute -right-16 -bottom-16 w-80 h-80 text-primary/5 group-hover:text-primary/10 transition-all duration-700 rotate-12" />
              </motion.div>
            )}

            {/* Toast */}
            <AnimatePresence>
              {showToast && (
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 50 }}
                  className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-card border border-primary/30 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3"
                >
                  <Sparkles className="text-primary" size={18} />
                  <span className="text-sm font-bold">Voice Chat is coming soon!</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Today's Summary + Prediction */}
            <div className="grid md:grid-cols-2 gap-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="p-8 rounded-[40px] bg-white/[0.03] border border-white/5 backdrop-blur-xl"
              >
                <div className="flex items-center gap-3 mb-6">
                  <CheckCircle size={20} className="text-emerald-400" />
                  <h3 className="text-xl font-bold">Today's Summary</h3>
                </div>
                {insightsLoading ? (
                  <div className="space-y-3">
                    <SkeletonBlock className="h-10" />
                    <SkeletonBlock className="h-10" />
                    <SkeletonBlock className="h-10" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl">
                      <span className="text-sm text-white/60">New memories learned</span>
                      <span className="text-sm font-bold text-emerald-400">+{todaySummary?.newMemories ?? 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl">
                      <span className="text-sm text-white/60">Conversations remembered</span>
                      <span className="text-sm font-bold">{todaySummary?.conversationsRemembered ?? 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl">
                      <span className="text-sm text-white/60">Personality improvement</span>
                      <span className="text-sm font-bold text-primary">+{todaySummary?.personalityImprovement ?? 0}%</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl">
                      <span className="text-sm text-white/60">Productivity today</span>
                      <span className="text-sm font-bold">
                        {todaySummary?.productivityScore != null ? `${todaySummary.productivityScore}%` : "Not logged"}
                      </span>
                    </div>
                  </div>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="p-8 rounded-[40px] bg-gradient-to-br from-secondary/10 to-transparent border border-secondary/20 backdrop-blur-xl"
              >
                <div className="flex items-center gap-3 mb-6">
                  <Lightbulb size={20} className="text-amber-300" />
                  <h3 className="text-xl font-bold">Predictions</h3>
                </div>
                {insightsLoading ? (
                  <div className="space-y-3">
                    <SkeletonBlock className="h-10" />
                    <SkeletonBlock className="h-10" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(prediction?.items?.length ? prediction.items : ["Keep interacting with your twin to unlock predictions."]).map((item: string, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-4 bg-white/5 rounded-2xl">
                        <Sparkles size={14} className="text-secondary mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-white/70 leading-relaxed">{item}</p>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </div>

            {/* Quick Ask Input */}
            <div className="relative">
              <form onSubmit={handleQuickAsk} className="relative group">
                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity" />
                <div className="relative flex items-center bg-white/5 border border-white/10 rounded-[32px] p-2 focus-within:border-primary/50 transition-all">
                  <div className="pl-6 pr-4 text-white/40">
                    <Search size={24} />
                  </div>
                  <input
                    type="text"
                    value={quickAsk}
                    onChange={(e) => setQuickAsk(e.target.value)}
                    placeholder="Ask your twin anything..."
                    className="flex-1 bg-transparent outline-none py-4 text-lg font-light"
                  />
                  <button
                    type="submit"
                    className="p-4 bg-white/10 hover:bg-primary text-white rounded-[24px] transition-all"
                  >
                    <ArrowRight size={24} />
                  </button>
                </div>
              </form>
            </div>

            {/* Intelligence & Memory Grid */}
            <div className="grid md:grid-cols-2 gap-8">
              {/* Twin Intelligence Panel */}
              <div className="p-8 rounded-[40px] bg-white/[0.03] border border-white/5 relative overflow-hidden">
                {!hasLearningBase && (
                  <LockedSection
                    title="Twin Intelligence Locked"
                    message="Add knowledge to your twin to unlock intelligence insights."
                  />
                )}
                <div className={`flex items-center gap-3 mb-8 ${!hasLearningBase ? 'blur-sm opacity-20' : ''}`}>
                  <Target size={20} className="text-secondary" />
                  <h3 className="text-xl font-bold">Twin Intelligence</h3>
                </div>
                <div className={`space-y-6 ${!hasLearningBase ? 'blur-sm opacity-20' : ''}`}>
                  <IntelligenceItem
                    label="Core Knowledge"
                    values={
                      twinData?.learnedTraits?.coreKnowledge?.length
                        ? twinData.learnedTraits.coreKnowledge
                        : (twinData?.knowledge?.length ? twinData.knowledge.slice(0, 6) : [])
                    }
                    color="text-primary"
                  />
                  <IntelligenceItem
                    label="Strengths"
                    values={twinData?.learnedTraits?.strengths?.length ? twinData.learnedTraits.strengths : []}
                    color="text-emerald-400"
                  />
                  <IntelligenceItem
                    label="Weaknesses"
                    values={twinData?.learnedTraits?.weaknesses?.length ? twinData.learnedTraits.weaknesses : []}
                    color="text-red-400"
                  />
                  <IntelligenceItem
                    label="Primary Goal"
                    values={
                      twinData?.learnedTraits?.primaryGoal
                        ? [twinData.learnedTraits.primaryGoal]
                        : (twinData?.goals?.length ? [twinData.goals[0]] : [])
                    }
                    color="text-secondary"
                  />
                </div>
              </div>

              {/* Memory / Knowledge Section */}
              <div className="p-8 rounded-[40px] bg-white/[0.03] border border-white/5 relative overflow-hidden">
                {!hasLearningBase && (
                  <LockedSection
                    title="Behaviors Locked"
                    message="Your twin needs knowledge to learn your behavioral patterns."
                  />
                )}
                <div className={`flex items-center gap-3 mb-8 ${!hasLearningBase ? 'blur-sm opacity-20' : ''}`}>
                  <BookOpen size={20} className="text-primary" />
                  <h3 className="text-xl font-bold">Learned Behaviors</h3>
                </div>
                <div className={`grid grid-cols-1 gap-4 ${!hasLearningBase ? 'blur-sm opacity-20' : ''}`}>
                  {behaviorCards.length ? (
                    behaviorCards.slice(0, 4).map((trait: string, i: number) => (
                      <MemoryCard key={i} icon={<Sparkles size={16} />} text={trait} />
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-white/20 border border-dashed border-white/10 rounded-2xl">
                      <Brain size={24} className="mb-2 opacity-20" />
                      <p className="text-xs italic">Learning your behaviors...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Sidebar Content */}
          <div className="lg:col-span-4 space-y-8">
            {/* Spotify Player */}
            <SpotifyPlayer />

            {/* Calendar Widget */}
            <CalendarWidget />

            {/* Suggested Actions */}
            <div className="p-8 rounded-[40px] bg-white/[0.03] border border-white/5 relative overflow-hidden">
              {!hasLearningBase && (
                <LockedSection
                  title="Suggestions Locked"
                  message="Add knowledge to receive personalized AI suggestions."
                />
              )}
              <div className={`flex items-center justify-between mb-8 ${!hasLearningBase ? 'blur-sm opacity-20' : ''}`}>
                <div className="flex items-center gap-3">
                  <Zap size={20} className="text-yellow-400" />
                  <h3 className="text-xl font-bold">AI Suggestions</h3>
                </div>
                <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Daily</span>
              </div>
              <div className={`space-y-4 ${!hasLearningBase ? 'blur-sm opacity-20' : ''}`}>
                {memoryData?.computedInsights?.nudges?.length > 0 ? (
                  memoryData.computedInsights.nudges.slice(0, 3).map((nudge: any) => (
                    <ActionCard
                      key={nudge.id}
                      title={nudge.title}
                      desc={nudge.message}
                      tag={nudge.type || "AI"}
                      icon={nudge.type === 'health' ? <Clock size={18} className="text-primary" /> : <Zap size={18} className="text-yellow-400" />}
                    />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-white/20 border border-dashed border-white/10 rounded-2xl">
                    <Sparkles size={24} className="mb-2 opacity-20" />
                    <p className="text-xs italic">Analyzing your patterns...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Stats Section */}
            <div id="dashboard-stats" className="grid grid-cols-1 gap-4">
              <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 flex items-center justify-between group hover:bg-white/[0.05] transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <MessageSquare size={20} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40 uppercase font-bold">Conversations</p>
                    <p className="text-2xl font-bold"><AnimatedCounter value={msgCount} /></p>
                  </div>
                </div>
                <ChevronRight size={20} className="text-white/10 group-hover:text-white/40 transition-all" />
              </div>

              <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 flex items-center justify-between group hover:bg-white/[0.05] transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center">
                    <Brain size={20} className="text-secondary" />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40 uppercase font-bold">Knowledge Points</p>
                    <p className="text-2xl font-bold"><AnimatedCounter value={twinData?.knowledge?.length || 0} /></p>
                  </div>
                </div>
                <ChevronRight size={20} className="text-white/10 group-hover:text-white/40 transition-all" />
              </div>

              <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 flex items-center justify-between group hover:bg-white/[0.05] transition-all cursor-pointer relative overflow-hidden" onClick={() => navigate('/insights')}>
                {!hasLearningBase && (
                  <div className="absolute inset-0 bg-[#050505]/60 backdrop-blur-[2px] flex items-center justify-center z-10">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Locked</span>
                  </div>
                )}
                <div className={`flex items-center gap-4 ${!hasLearningBase ? 'blur-[1px] opacity-20' : ''}`}>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                    <TrendingUp size={20} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40 uppercase font-bold">Activity Streak</p>
                    <p className="text-2xl font-bold">{streak} Days</p>
                  </div>
                </div>
                <ChevronRight size={20} className="text-white/10 group-hover:text-white/40 transition-all" />
              </div>
            </div>

            {/* Daily Summary Preview */}
            <div className="p-8 rounded-[40px] bg-gradient-to-br from-secondary/10 to-transparent border border-secondary/20">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <PieChart size={20} className="text-secondary" />
                  <h3 className="text-xl font-bold">Daily Progress</h3>
                </div>
                <Link to="/tracker" className="text-xs text-secondary hover:underline flex items-center gap-1">
                  {todayData ? "Update" : "Log Today"} <PlusCircle size={12} />
                </Link>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl">
                  <span className="text-sm text-white/60">Mood Status</span>
                  <span className="text-sm font-bold">
                    {todayData ? (
                      <>
                        {todayData.mood}
                      </>
                    ) : "Not Logged"}
                  </span>
                </div>
                <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl">
                  <span className="text-sm text-white/60">Hours Logged</span>
                  <span className="text-sm font-bold">
                    {todayData ? (todayData.sleepHours + todayData.workHours + todayData.studyHours).toFixed(1) + "h" : "0h"}
                  </span>
                </div>
              </div>
            </div>

            {/* Setup Link */}
            <Link to="/setup" className="block p-8 rounded-[40px] bg-gradient-to-br from-primary/20 to-transparent border border-primary/20 hover:border-primary/40 transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-all">
                  <Settings className="text-primary" />
                </div>
                <ArrowRight size={20} className="text-primary opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all" />
              </div>
              <h3 className="text-xl font-bold mb-2">Configure Twin</h3>
              <p className="text-sm text-white/40 leading-relaxed">Update your digital twin's core personality, knowledge base, and interaction tone.</p>
            </Link>
          </div>
        </div>
      </div>

      {/* Conversation Launcher Modal */}
      {showLauncher && (
        <ConversationLauncher
          onClose={() => setShowLauncher(false)}
          onLaunch={(sessionId, initialMessage) => {
            setShowLauncher(false);
            if (initialMessage === "__voice__") {
              setShowToast(true);
              setTimeout(() => setShowToast(false), 3000);
              return;
            }
            const params = new URLSearchParams();
            if (sessionId) params.set("session", sessionId);
            if (initialMessage) params.set("q", initialMessage);
            navigate(`/chat${params.toString() ? `?${params}` : ""}`);
          }}
        />
      )}
    </div>
  );
}

function IntelligenceItem({ label, values, color }: { label: string, values: string[], color: string }) {
  return (
    <div>
      <p className="text-[10px] text-white/40 uppercase font-bold mb-2 tracking-widest">{label}</p>
      <div className="flex flex-wrap gap-2">
        {values.length > 0 ? (
          values.map((v, i) => (
            <span key={i} className={`text-xs font-medium px-3 py-1 rounded-lg bg-white/5 border border-white/5 ${color}`}>
              {v}
            </span>
          ))
        ) : (
          <span className="text-[10px] text-white/20 italic">Not yet identified</span>
        )}
      </div>
    </div>
  );
}

function MemoryCard({ icon, text }: { icon: React.ReactNode, text: string, key?: any }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all cursor-default">
      <div className="text-primary">{icon}</div>
      <p className="text-sm text-white/70">{text}</p>
    </div>
  );
}

function ActionCard({ title, desc, tag, icon }: { title: string, desc: string, tag: string, icon: React.ReactNode }) {
  return (
    <div className="p-5 rounded-3xl bg-white/5 border border-white/5 hover:border-primary/30 transition-all group cursor-pointer">
      <div className="flex justify-between items-start mb-3">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-primary/10 transition-all">
          {icon}
        </div>
        <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-white/5 text-white/40 uppercase tracking-wider">{tag}</span>
      </div>
      <h4 className="font-bold mb-1 group-hover:text-primary transition-all">{title}</h4>
      <p className="text-xs text-white/40 leading-relaxed">{desc}</p>
    </div>
  );
}

function LockedSection({ title, message }: { title: string, message: string }) {
  const navigate = useNavigate();
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-[#050505]/80 backdrop-blur-md text-center">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Brain size={24} className="text-primary animate-pulse" />
      </div>
      <h4 className="text-lg font-bold mb-2">{title}</h4>
      <p className="text-xs text-white/40 mb-6 max-w-[200px] mx-auto leading-relaxed">
        {message}
      </p>
      <button
        onClick={() => navigate('/setup')}
        className="flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-xl text-xs font-bold transition-all border border-primary/20"
      >
        Add Knowledge
        <PlusCircle size={14} />
      </button>
    </div>
  );
}