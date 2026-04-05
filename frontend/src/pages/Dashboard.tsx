import { motion } from "motion/react";
import { 
  MessageSquare, Mic, Settings, User, Brain, Activity, LogOut, Loader2, 
  Zap, TrendingUp, Target, CheckCircle, Clock, Search, Sparkles, 
  ChevronRight, ArrowRight, BookOpen, Lightbulb, Bell, MoreVertical,
  Calendar, BarChart3, PlusCircle, PieChart
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTutorial } from "../context/TutorialContext";
import React, { useEffect, useState, useRef } from "react";
import { AnimatePresence } from "motion/react";
import SpotifyPlayer from "../components/SpotifyPlayer";
import CalendarWidget from "../components/CalendarWidget";
import { buildApiUrl } from "../constants";

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
        if (twinRes.ok) {
          const data = await twinRes.json();
          setTwinData(data);
          if (!data?.avatarUrl && !user?.photoURL) {
            setIsAvatarLoading(false);
          } else {
            setIsAvatarLoading(true);
          }
        }
        
        // Fetch Sessions to count messages
        const sessionsRes = await fetch(buildApiUrl("/api/sessions"), { headers });
        if (sessionsRes.ok) {
          const sessions = await sessionsRes.json();
          let totalMsgs = 0;
          for (const session of sessions) {
            const msgsRes = await fetch(buildApiUrl(`/api/sessions/${session.id}/messages`), { headers });
            if (msgsRes.ok) {
              const msgs = await msgsRes.json();
              totalMsgs += msgs.length;
            }
          }
          setMsgCount(totalMsgs);
        }

        // Fetch Today's Daily Data
        const today = new Date().toISOString().split('T')[0];
        const dailyRes = await fetch(buildApiUrl(`/api/daily-data/${today}`), { headers });
        if (dailyRes.ok) {
          const data = await dailyRes.json();
          setTodayData(data);
        }

        // Fetch Memory Data for Nudges
        const memoryRes = await fetch(buildApiUrl(`/api/memory/${user.id}`), { headers });
        if (memoryRes.ok) {
          const data = await memoryRes.json();
          setMemoryData(data);
          
          // Calculate Streak
          if (data.dailyLogs && data.dailyLogs.length > 0) {
            const sortedLogs = [...data.dailyLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            let currentStreak = 0;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            let lastDate = new Date(sortedLogs[0].date);
            lastDate.setHours(0, 0, 0, 0);
            
            // Check if the most recent log is today or yesterday
            const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
            
            if (diffDays <= 1) {
              currentStreak = 1;
              for (let i = 1; i < sortedLogs.length; i++) {
                const prevDate = new Date(sortedLogs[i-1].date);
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
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
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
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const syncPercentage = twinData ? Math.min(40 + (twinData.knowledge?.length || 0) * 5 + (msgCount > 0 ? 10 : 0), 100) : 0;
  const hasKnowledge = twinData?.knowledge && twinData.knowledge.length > 0;

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-8">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/5 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Top Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div className="flex items-center gap-4">
            <div className="relative" ref={profileRef}>
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
                  {/* Extra fallback in case images are present but fail to load */}
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
                Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">{user?.displayName?.split(' ')[0]}</span>
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1.5 text-xs font-medium text-secondary bg-secondary/10 px-2 py-0.5 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                  Twin Active
                </span>
                <span className="text-xs text-white/40">Last synced 2m ago</span>
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
        </header>

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-8 space-y-8">
            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Link id="nav-chat" to="/chat" className="p-6 rounded-3xl bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all group">
                <MessageSquare className="text-primary mb-3 group-hover:scale-110 transition-transform" size={24} />
                <p className="font-bold text-sm">New Chat</p>
                <p className="text-[10px] text-white/40 mt-1">Talk to your twin</p>
              </Link>
              <Link id="nav-tracker" to="/tracker" className="p-6 rounded-3xl bg-secondary/10 border border-secondary/20 hover:bg-secondary/20 transition-all group">
                <Calendar className="text-secondary mb-3 group-hover:scale-110 transition-transform" size={24} />
                <p className="font-bold text-sm">Daily Tracker</p>
                <p className="text-[10px] text-white/40 mt-1">Log your day</p>
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
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
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
                <p className="text-white/50 text-lg mb-10 max-w-xl leading-relaxed">
                  The more you interact, the smarter VITRA becomes. Your twin is currently learning your decision-making patterns.
                </p>
                
                <div className="flex flex-wrap items-center gap-8 mb-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <TrendingUp size={20} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] text-white/40 uppercase font-bold">Recent Learning</p>
                      <p className="text-sm font-bold text-emerald-400">+5% from last chat</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                      <Clock size={20} className="text-white/40" />
                    </div>
                    <div>
                      <p className="text-[10px] text-white/40 uppercase font-bold">Last Updated</p>
                      <p className="text-sm font-bold">Today, 10:24 AM</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <Link to="/chat" className="bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3 transition-all shadow-xl shadow-primary/20">
                    <MessageSquare size={20} />
                    Chat Now
                  </Link>
                  <button 
                    onClick={() => {
                      setShowToast(true);
                      setTimeout(() => setShowToast(false), 3000);
                    }}
                    className="bg-white/5 hover:bg-white/10 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3 border border-white/10 transition-all"
                  >
                    <Mic size={20} />
                    Voice Talk
                  </button>
                </div>
              </div>
              
              <Brain className="absolute -right-16 -bottom-16 w-80 h-80 text-primary/5 group-hover:text-primary/10 transition-all duration-700 rotate-12" />
            </motion.div>

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
                  <span className="text-sm font-bold">Voice Talk is coming soon!</span>
                </motion.div>
              )}
            </AnimatePresence>

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
                {!hasKnowledge && (
                  <LockedSection 
                    title="Twin Intelligence Locked" 
                    message="Add knowledge to your twin to unlock intelligence insights." 
                  />
                )}
                <div className={`flex items-center gap-3 mb-8 ${!hasKnowledge ? 'blur-sm opacity-20' : ''}`}>
                  <Target size={20} className="text-secondary" />
                  <h3 className="text-xl font-bold">Twin Intelligence</h3>
                </div>
                <div className={`space-y-6 ${!hasKnowledge ? 'blur-sm opacity-20' : ''}`}>
                  <IntelligenceItem 
                    label="Core Knowledge" 
                    values={twinData?.learnedTraits?.coreKnowledge?.length ? twinData.learnedTraits.coreKnowledge : []} 
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
                    values={twinData?.learnedTraits?.primaryGoal ? [twinData.learnedTraits.primaryGoal] : (twinData?.goal ? [twinData.goal] : (twinData?.goals?.length ? [twinData.goals[0]] : []))} 
                    color="text-secondary" 
                  />
                </div>
              </div>

              {/* Memory / Knowledge Section */}
              <div className="p-8 rounded-[40px] bg-white/[0.03] border border-white/5 relative overflow-hidden">
                {!hasKnowledge && (
                  <LockedSection 
                    title="Behaviors Locked" 
                    message="Your twin needs knowledge to learn your behavioral patterns." 
                  />
                )}
                <div className={`flex items-center gap-3 mb-8 ${!hasKnowledge ? 'blur-sm opacity-20' : ''}`}>
                  <BookOpen size={20} className="text-primary" />
                  <h3 className="text-xl font-bold">Learned Behaviors</h3>
                </div>
                <div className={`grid grid-cols-1 gap-4 ${!hasKnowledge ? 'blur-sm opacity-20' : ''}`}>
                  {twinData?.learnedTraits?.behaviorTraits?.length ? (
                    twinData.learnedTraits.behaviorTraits.slice(0, 4).map((trait: string, i: number) => (
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
              {!hasKnowledge && (
                <LockedSection 
                  title="Suggestions Locked" 
                  message="Add knowledge to receive personalized AI suggestions." 
                />
              )}
              <div className={`flex items-center justify-between mb-8 ${!hasKnowledge ? 'blur-sm opacity-20' : ''}`}>
                <div className="flex items-center gap-3">
                  <Zap size={20} className="text-yellow-400" />
                  <h3 className="text-xl font-bold">AI Suggestions</h3>
                </div>
                <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Daily</span>
              </div>
              <div className={`space-y-4 ${!hasKnowledge ? 'blur-sm opacity-20' : ''}`}>
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
                    <p className="text-2xl font-bold">{msgCount}</p>
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
                    <p className="text-2xl font-bold">{twinData?.knowledge?.length || 0}</p>
                  </div>
                </div>
                <ChevronRight size={20} className="text-white/10 group-hover:text-white/40 transition-all" />
              </div>

              <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 flex items-center justify-between group hover:bg-white/[0.05] transition-all cursor-pointer relative overflow-hidden" onClick={() => navigate('/insights')}>
                {!hasKnowledge && (
                  <div className="absolute inset-0 bg-[#050505]/60 backdrop-blur-[2px] flex items-center justify-center z-10">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Locked</span>
                  </div>
                )}
                <div className={`flex items-center gap-4 ${!hasKnowledge ? 'blur-[1px] opacity-20' : ''}`}>
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
                        {todayData.mood} {todayData.mood === "Happy" ? "😊" : todayData.mood === "Focused" ? "🧠" : todayData.mood === "Neutral" ? "😐" : todayData.mood === "Stressed" ? "😫" : "😢"}
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
