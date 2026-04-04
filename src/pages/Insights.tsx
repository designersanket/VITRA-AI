import { motion } from "motion/react";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { ArrowLeft, Brain, TrendingUp, Moon, Briefcase, Book, Sparkles, AlertCircle, Loader2, Clock, Calendar, MessageSquare, Network } from "lucide-react";
import { Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell } from 'recharts';
import { predictMood, generateRecommendations, TwinProfile } from "../services/geminiService";
import { useToast } from "../context/ToastContext";
import { KnowledgeGraph } from "../components/KnowledgeGraph";

export default function Insights() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [prediction, setPrediction] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [averages, setAverages] = useState<any>(null);
  const [twinProfile, setTwinProfile] = useState<TwinProfile | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const token = localStorage.getItem("vitra_token");
        const headers = { "Authorization": `Bearer ${token}` };

        // Fetch full memory which includes computed insights from backend
        const memoryRes = await fetch(`/api/memory/${user.id}`, { headers });
        if (!memoryRes.ok) throw new Error("Failed to fetch memory data");
        
        const memory = await memoryRes.json();
        
        // Fetch twin profile for the knowledge graph
        const twinRes = await fetch("/api/twins", { headers });
        if (twinRes.ok) {
          const profile = await twinRes.json();
          setTwinProfile(profile);
        }
        
        // Update state with memory data
        setData(memory.dailyLogs.reverse()); // Reverse to show chronological for charts
        setAverages({
          sleep: memory.computedInsights.averageSleep,
          workload: memory.computedInsights.workload,
          stress: memory.computedInsights.stressLevel,
          personality: memory.computedInsights.personalityInsights,
          peakTime: memory.computedInsights.peakProductivityTime,
          frequentPhrases: memory.computedInsights.frequentPhrases,
          mostProductiveDay: memory.computedInsights.mostProductiveDay
        });

        if (memory.dailyLogs.length > 0) {
          // AI Analysis (keeping Gemini for deeper predictions)
          const [pred, recs] = await Promise.all([
            predictMood(memory.dailyLogs),
            generateRecommendations(memory.dailyLogs)
          ]);
          setPrediction(pred);
          setRecommendations(recs);
        }
      } catch (error) {
        console.error("Error fetching insights:", error);
        showToast("Failed to load insights.", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-text">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-text/60 animate-pulse">Analyzing behavioral patterns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-text p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-12">
          <Link to="/dashboard" className="p-2 hover:bg-white/5 rounded-full transition-all">
            <ArrowLeft size={24} />
          </Link>
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">Behavioral Insights</h1>
            <p className="text-text/40 text-sm">AI-driven analysis of your digital twin's behavior.</p>
          </div>
          <div className="w-10" />
        </header>

        {data.length === 0 ? (
          <div className="text-center py-20 bg-card border border-white/5 rounded-3xl">
            <AlertCircle size={48} className="text-text/20 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Insufficient Data</h2>
            <p className="text-text/40 max-w-sm mx-auto mb-6">Start tracking your daily behavior to unlock deep AI insights and predictions.</p>
            <Link to="/tracker" className="bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-primary/90 transition-all">
              Start Tracking
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-card border border-white/5 p-6 rounded-3xl flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <Moon size={24} />
                </div>
                <div>
                  <p className="text-text/40 text-xs font-medium uppercase tracking-wider">Avg. Sleep</p>
                  <p className="text-2xl font-bold">{averages?.sleep}h</p>
                </div>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="bg-card border border-white/5 p-6 rounded-3xl flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                  <Briefcase size={24} />
                </div>
                <div>
                  <p className="text-text/40 text-xs font-medium uppercase tracking-wider">Workload</p>
                  <p className="text-2xl font-bold">{averages?.workload}h</p>
                </div>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="bg-card border border-white/5 p-6 rounded-3xl flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <Book size={24} />
                </div>
                <div>
                  <p className="text-text/40 text-xs font-medium uppercase tracking-wider">Stress Level</p>
                  <p className="text-2xl font-bold">{averages?.stress}</p>
                </div>
              </motion.div>
            </div>

            {/* Knowledge Graph Visualization */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Network className="text-primary" />
                  Knowledge Graph
                </h2>
                <span className="text-xs text-text/40 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                  Interactive Brain Map
                </span>
              </div>
              {twinProfile ? (
                <KnowledgeGraph profile={twinProfile} />
              ) : (
                <div className="h-[500px] bg-card border border-white/5 rounded-[32px] flex items-center justify-center italic text-text/20">
                  Loading neural map...
                </div>
              )}
            </motion.div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-white/5 p-6 rounded-3xl shadow-xl"
              >
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <TrendingUp size={20} className="text-primary" /> Behavioral Trends
                </h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                      <defs>
                        <linearGradient id="colorSleep" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                      <XAxis dataKey="date" stroke="#ffffff40" fontSize={10} tickFormatter={(val) => val.split('-').slice(1).join('/')} />
                      <YAxis stroke="#ffffff40" fontSize={10} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #ffffff10', borderRadius: '12px' }}
                        itemStyle={{ fontSize: '12px' }}
                      />
                      <Area type="monotone" dataKey="sleepHours" stroke="#60a5fa" fillOpacity={1} fill="url(#colorSleep)" strokeWidth={2} name="Sleep" />
                      <Area type="monotone" dataKey="workHours" stroke="#fbbf24" fillOpacity={0} strokeWidth={2} name="Work" />
                      <Area type="monotone" dataKey="studyHours" stroke="#10b981" fillOpacity={0} strokeWidth={2} name="Study" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-card border border-white/5 p-6 rounded-3xl shadow-xl"
              >
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Sparkles size={20} className="text-primary" /> Mood Distribution
                </h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={Object.entries(data.reduce((acc: any, log: any) => {
                      const mood = log.mood || "Neutral";
                      acc[mood] = (acc[mood] || 0) + 1;
                      return acc;
                    }, {})).map(([name, count]) => ({ name, count }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                      <XAxis dataKey="name" stroke="#ffffff40" fontSize={10} />
                      <YAxis stroke="#ffffff40" fontSize={10} allowDecimals={false} />
                      <Tooltip 
                        cursor={{ fill: '#ffffff05' }}
                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #ffffff10', borderRadius: '12px' }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {Object.entries(data.reduce((acc: any, log: any) => {
                          const mood = log.mood || "Neutral";
                          acc[mood] = (acc[mood] || 0) + 1;
                          return acc;
                        }, {})).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={
                            entry[0] === "Happy" ? "#10b981" : 
                            entry[0] === "Stressed" ? "#ef4444" : 
                            entry[0] === "Focused" ? "#6366f1" : 
                            entry[0] === "Anxious" ? "#f59e0b" : "#94a3b8"
                          } />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-card border border-white/5 p-6 rounded-3xl shadow-xl flex flex-col"
              >
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Brain size={20} className="text-secondary" /> AI Mood Prediction
                </h3>
                {prediction ? (
                  <div className="flex-1 flex flex-col justify-center text-center space-y-4">
                    <div className="w-24 h-24 rounded-[40px] bg-secondary/10 flex items-center justify-center mx-auto border border-secondary/20 shadow-lg shadow-secondary/5">
                      <span className="text-5xl">{prediction.mood === "Happy" ? "😊" : prediction.mood === "Focused" ? "🧠" : prediction.mood === "Stressed" ? "😫" : "😐"}</span>
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold text-secondary">{prediction.mood}</h4>
                      <p className="text-text/60 text-sm mt-2 leading-relaxed">{prediction.explanation}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-text/40 italic">Calculating prediction...</div>
                )}
              </motion.div>
            </div>

            {/* Advanced Insights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-card border border-white/5 p-8 rounded-3xl shadow-xl"
              >
                <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                  <Clock size={24} className="text-primary" /> Productivity Patterns
                </h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <Clock size={20} />
                      </div>
                      <span className="text-sm font-medium">Peak Productivity Time</span>
                    </div>
                    <span className="text-lg font-bold text-primary">{averages?.peakTime}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                        <Calendar size={20} />
                      </div>
                      <span className="text-sm font-medium">Most Productive Day</span>
                    </div>
                    <span className="text-lg font-bold text-secondary">{averages?.mostProductiveDay}</span>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-card border border-white/5 p-8 rounded-3xl shadow-xl"
              >
                <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                  <MessageSquare size={24} className="text-secondary" /> Communication Patterns
                </h3>
                <div className="space-y-4">
                  <p className="text-sm text-text/40 mb-4">Frequently used words and themes in your digital twin's vocabulary:</p>
                  <div className="flex flex-wrap gap-2">
                    {averages?.frequentPhrases?.map((phrase: string, i: number) => (
                      <span 
                        key={i} 
                        className="px-4 py-2 bg-secondary/10 text-secondary rounded-full text-sm font-medium border border-secondary/20"
                      >
                        #{phrase}
                      </span>
                    )) || <span className="text-text/20 italic">No patterns detected yet</span>}
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Recommendations */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-card border border-white/5 p-8 rounded-3xl shadow-xl space-y-8"
              >
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-8 flex items-center gap-3">
                      <Sparkles size={24} className="text-primary" /> Personalized Recommendations
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      {recommendations.map((rec, i) => (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + (i * 0.1) }}
                          className="flex items-start gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-primary/30 transition-all group"
                        >
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0 group-hover:scale-110 transition-transform">
                            {i + 1}
                          </div>
                          <p className="text-sm leading-relaxed">{rec}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-8 flex items-center gap-3">
                      <Brain size={24} className="text-secondary" /> Personality Insights
                    </h3>
                    <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-lg font-medium text-secondary mb-2">{averages?.personality}</p>
                      <p className="text-sm text-text/60 leading-relaxed">
                        Based on your communication style and behavioral patterns, VITRA has detected this personality trait in your digital twin.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
