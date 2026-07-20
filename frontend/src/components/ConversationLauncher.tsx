import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Brain, MessageSquare, Mic, BookOpen, ArrowRight, X,
  Clock, Target, Sparkles, ChevronRight, Zap, History
} from "lucide-react";
import { buildApiUrl } from "../constants";

interface LauncherContext {
  greeting: string;
  mood: string | null;
  moodEmoji: string;
  recentMemories: string[];
  activeGoal: string | null;
  lastSessionTitle: string | null;
  lastSessionId: string | null;
  lastSessionTime: string | null;
  suggestedTopics: string[];
  isNewUser: boolean;
  twinName: string;
}

interface Props {
  onClose: () => void;
  onLaunch: (sessionId?: string, initialMessage?: string) => void;
}

const MOOD_EMOJIS: Record<string, string> = {
  focused: "🎯", happy: "😊", motivated: "⚡", stressed: "😤",
  tired: "😴", calm: "😌", excited: "🚀", neutral: "😐"
};

function SkeletonLine({ w = "full" }: { w?: string }) {
  return <div className={`h-3 bg-white/10 rounded-full animate-pulse w-${w}`} />;
}

export default function ConversationLauncher({ onClose, onLaunch }: Props) {
  const navigate = useNavigate();
  const [ctx, setCtx] = useState<LauncherContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem("vitra_token");
        const h = { Authorization: `Bearer ${token}` };

        const [twinRes, sessionsRes, memoryRes] = await Promise.all([
          fetch(buildApiUrl("/api/twins"), { headers: h }),
          fetch(buildApiUrl("/api/sessions"), { headers: h }),
          fetch(buildApiUrl("/api/memory/me"), { headers: h }).catch(() => null),
        ]);

        const twin = twinRes.ok ? await twinRes.json() : null;
        const sessions = sessionsRes.ok ? await sessionsRes.json() : [];
        const memory = memoryRes?.ok ? await memoryRes.json() : null;

        const lastSession = sessions[0] ?? null;
        const isNewUser = !twin || (sessions.length === 0 && (!twin.memory || twin.memory.length === 0));

        // Greeting based on time
        const hour = new Date().getHours();
        const timeGreeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
        const name = twin?.name?.split(" ")[0] || "there";

        // Mood from daily data
        const today = new Date().toISOString().split("T")[0];
        const dailyRes = await fetch(buildApiUrl(`/api/daily-data/${today}`), { headers: h });
        const daily = dailyRes.ok ? await dailyRes.json() : null;
        const moodRaw = daily?.mood?.toLowerCase() ?? null;
        const moodEmoji = moodRaw ? (MOOD_EMOJIS[moodRaw] ?? "😊") : "😊";

        // Last session time
        let lastSessionTime: string | null = null;
        if (lastSession?.updatedAt || lastSession?.createdAt) {
          const diff = Date.now() - new Date(lastSession.updatedAt ?? lastSession.createdAt).getTime();
          const mins = Math.floor(diff / 60000);
          if (mins < 60) lastSessionTime = `${mins} min ago`;
          else if (mins < 1440) lastSessionTime = `${Math.floor(mins / 60)}h ago`;
          else lastSessionTime = `${Math.floor(mins / 1440)}d ago`;
        }

        // Memories
        const memories: string[] = (twin?.memory ?? [])
          .sort((a: any, b: any) => b.weight - a.weight)
          .slice(0, 3)
          .map((m: any) => m.text);

        // Active goal
        const activeGoal = twin?.goals?.[0] ?? twin?.learnedTraits?.primaryGoal ?? null;

        // Suggested topics
        const interests: string[] = twin?.learnedTraits?.topicInterests ?? [];
        const suggestedTopics = [
          lastSession ? "Continue yesterday's work" : null,
          interests[0] ? `Ask about ${interests[0]}` : null,
          activeGoal ? "Review today's goals" : null,
          "Brainstorm new ideas",
          interests[1] ? `Explore ${interests[1]}` : null,
        ].filter(Boolean).slice(0, 4) as string[];

        // Personalized greeting
        let greeting = `${timeGreeting}, ${name} 👋`;
        if (!isNewUser && lastSession) {
          if (twin?.learnedTraits?.topicInterests?.length) {
            greeting = `${timeGreeting}, ${name}. Ready to continue building on ${twin.learnedTraits.topicInterests[0]}?`;
          } else {
            greeting = `${timeGreeting}, ${name}. I've been thinking about our last conversation 👋`;
          }
        }

        setCtx({
          greeting,
          mood: moodRaw,
          moodEmoji,
          recentMemories: memories,
          activeGoal,
          lastSessionTitle: lastSession?.title ?? null,
          lastSessionId: lastSession?.id ?? null,
          lastSessionTime,
          suggestedTopics,
          isNewUser,
          twinName: twin?.name ?? "VITRA",
        });
      } catch (e) {
        console.error("Launcher context error:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleTopic = (topic: string) => onLaunch(undefined, topic);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 24 }}
          transition={{ type: "spring", damping: 22, stiffness: 280 }}
          className="relative w-full max-w-lg bg-[#0a0a0a]/90 border border-white/10 rounded-[32px] shadow-2xl overflow-hidden backdrop-blur-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Glow orb */}
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/20 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-secondary/10 rounded-full blur-[60px] pointer-events-none" />

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 hover:bg-white/10 rounded-xl transition-all text-white/40 hover:text-white"
          >
            <X size={18} />
          </button>

          <div className="relative z-10 p-6 space-y-5 max-h-[90vh] overflow-y-auto scrollbar-hide">

            {/* New User State */}
            {!loading && ctx?.isNewUser ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-4 space-y-4"
              >
                {/* Animated orb */}
                <div className="relative w-20 h-20 mx-auto">
                  <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                  <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-primary/40 to-secondary/20 border border-primary/30 flex items-center justify-center">
                    <Brain size={36} className="text-primary" />
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-2">Welcome to VITRA</h2>
                  <p className="text-white/50 text-sm leading-relaxed max-w-sm mx-auto">
                    Let's begin creating your digital twin. The more we interact, the better I understand your personality, knowledge, communication style, and decision-making.
                  </p>
                </div>
                <button
                  onClick={() => onLaunch()}
                  className="w-full py-4 bg-primary hover:bg-primary/90 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl shadow-primary/20"
                >
                  <Sparkles size={18} />
                  Start First Conversation
                </button>
              </motion.div>
            ) : (
              <>
                {/* Greeting */}
                <div className="flex items-start gap-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/30 to-secondary/20 border border-primary/20 flex items-center justify-center">
                      <Brain size={22} className="text-primary" />
                    </div>
                    <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#0a0a0a] animate-pulse" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {loading ? (
                      <div className="space-y-2 pt-1">
                        <SkeletonLine w="3/4" />
                        <SkeletonLine w="1/2" />
                      </div>
                    ) : (
                      <>
                        <p className="font-bold text-base leading-snug">{ctx?.greeting}</p>
                        <p className="text-xs text-white/40 mt-0.5">
                          {ctx?.twinName} is ready · Twin Active
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Mood + Goal row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                    <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider mb-1">Current Mood</p>
                    {loading ? <SkeletonLine w="2/3" /> : (
                      <p className="text-sm font-semibold">
                        {ctx?.mood ? `${ctx.moodEmoji} ${ctx.mood.charAt(0).toUpperCase() + ctx.mood.slice(1)}` : "😊 Not logged"}
                      </p>
                    )}
                  </div>
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                    <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider mb-1">Active Goal</p>
                    {loading ? <SkeletonLine w="3/4" /> : (
                      <p className="text-sm font-semibold truncate">{ctx?.activeGoal ?? "No goal set"}</p>
                    )}
                  </div>
                </div>

                {/* Recent Memories */}
                {(loading || (ctx?.recentMemories?.length ?? 0) > 0) && (
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen size={14} className="text-primary" />
                      <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider">I remember you were working on</p>
                    </div>
                    {loading ? (
                      <div className="space-y-2">
                        <SkeletonLine w="full" />
                        <SkeletonLine w="4/5" />
                      </div>
                    ) : (
                      ctx?.recentMemories.map((m, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-white/70">
                          <span className="text-primary mt-0.5">•</span>
                          <span className="leading-snug">{m}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Last Session Resume */}
                {(loading || ctx?.lastSessionId) && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/10 to-transparent border border-primary/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <History size={14} className="text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Continue Previous Session</p>
                          {loading ? (
                            <SkeletonLine w="40" />
                          ) : (
                            <>
                              <p className="text-sm font-semibold truncate">{ctx?.lastSessionTitle}</p>
                              <p className="text-[10px] text-white/30 flex items-center gap-1 mt-0.5">
                                <Clock size={10} /> Last active: {ctx?.lastSessionTime}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                      {!loading && ctx?.lastSessionId && (
                        <button
                          onClick={() => onLaunch(ctx.lastSessionId!)}
                          className="flex items-center gap-1 text-xs font-bold text-primary hover:text-white bg-primary/10 hover:bg-primary/30 px-3 py-1.5 rounded-xl transition-all flex-shrink-0 ml-2"
                        >
                          Resume <ArrowRight size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Suggested Topics */}
                {(loading || (ctx?.suggestedTopics?.length ?? 0) > 0) && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Zap size={14} className="text-yellow-400" />
                      <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Suggested Topics</p>
                    </div>
                    {loading ? (
                      <div className="grid grid-cols-2 gap-2">
                        {[1, 2, 3, 4].map(i => <div key={i} className="h-9 bg-white/5 rounded-xl animate-pulse" />)}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {ctx?.suggestedTopics.map((topic, i) => (
                          <button
                            key={i}
                            onClick={() => handleTopic(topic)}
                            className="flex items-center justify-between gap-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-primary/10 hover:border-primary/30 text-xs text-white/60 hover:text-white transition-all text-left"
                          >
                            <span className="truncate">{topic}</span>
                            <ChevronRight size={12} className="flex-shrink-0 opacity-40" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Quick Start Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    onClick={() => onLaunch()}
                    className="flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary/90 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-primary/20"
                  >
                    <MessageSquare size={16} />
                    New Conversation
                  </button>
                  <button
                    onClick={() => ctx?.lastSessionId ? onLaunch(ctx.lastSessionId) : onLaunch()}
                    className="flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl font-bold text-sm transition-all"
                  >
                    <History size={16} />
                    Continue Yesterday
                  </button>
                  <button
                    onClick={() => { onClose(); navigate("/memory"); }}
                    className="flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white rounded-2xl font-bold text-sm transition-all"
                  >
                    <Brain size={16} />
                    Memory Vault
                  </button>
                  <button
                    onClick={() => onLaunch(undefined, "__voice__")}
                    className="flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white rounded-2xl font-bold text-sm transition-all"
                  >
                    <Mic size={16} />
                    Voice Chat
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
