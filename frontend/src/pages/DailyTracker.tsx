import { motion } from "motion/react";
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { ArrowLeft, Save, Moon, Book, Briefcase, Smile, Loader2, CheckCircle2, TrendingUp } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "../context/ToastContext";

export default function DailyTracker() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    mood: "Neutral",
    sleepHours: 7,
    workHours: 8,
    studyHours: 2,
    notes: ""
  });

  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("vitra_token");
        const headers = { "Authorization": `Bearer ${token}` };
        const res = await fetch(`/api/daily-data/${today}`, { headers });
        if (res.ok) {
          const data = await res.json();
          setFormData({
            mood: data.mood,
            sleepHours: data.sleepHours,
            workHours: data.workHours,
            studyHours: data.studyHours,
            notes: data.notes || ""
          });
        }
      } catch (err) {
        console.error("Error fetching daily data:", err);
      }
    };
    fetchData();
  }, [user, today]);

  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(false);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("vitra_token");
      const headers = { 
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      };

      const dataToSave = {
        ...formData,
        sleepHours: Number(formData.sleepHours) || 0,
        workHours: Number(formData.workHours) || 0,
        studyHours: Number(formData.studyHours) || 0,
        date: today
      };

      const res = await fetch("/api/daily-data", {
        method: "POST",
        headers,
        body: JSON.stringify(dataToSave)
      });

      if (!res.ok) throw new Error("Failed to save daily data");
      
      setSuccess(true);
      showToast("Daily data saved successfully!", "success");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save daily data. Please try again.";
      setError(errorMessage);
      showToast("Failed to save daily data.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-text p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <Link to="/dashboard" className="p-2 hover:bg-white/5 rounded-full transition-all">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-2xl font-bold">Daily Behavior Tracker</h1>
          <div className="w-10" />
        </header>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-white/5 rounded-3xl p-6 md:p-8 shadow-xl"
        >
          {success ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-12 space-y-6"
            >
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle2 size={48} />
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-bold mb-2">Data Saved Successfully!</h3>
                <p className="text-text/60">Your daily behavior has been recorded and analyzed.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
                <Link 
                  to="/insights" 
                  className="flex-1 bg-primary text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                  <TrendingUp size={20} /> View Insights
                </Link>
                <button 
                  onClick={() => setSuccess(false)}
                  className="flex-1 bg-white/5 text-text p-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
                >
                  Edit Entry
                </button>
              </div>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Mood Selection */}
              <div>
                <label className="block text-sm font-medium text-text/60 mb-4">How are you feeling today?</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                  {["Happy", "Focused", "Neutral", "Stressed", "Sad"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setFormData({ ...formData, mood: m })}
                      className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-2 ${
                        formData.mood === m 
                          ? "bg-primary/20 border-primary text-primary" 
                          : "bg-white/5 border-white/5 hover:border-white/20"
                      }`}
                    >
                      <span className="text-xl">{m === "Happy" ? "😊" : m === "Focused" ? "🧠" : m === "Neutral" ? "😐" : m === "Stressed" ? "😫" : "😢"}</span>
                      <span className="text-xs font-medium">{m}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Hours Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-text/60">
                    <Moon size={16} className="text-blue-400" /> Sleep Hours
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    value={formData.sleepHours}
                    onChange={(e) => setFormData({ ...formData, sleepHours: Number(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-primary transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-text/60">
                    <Briefcase size={16} className="text-amber-400" /> Work Hours
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    value={formData.workHours}
                    onChange={(e) => setFormData({ ...formData, workHours: Number(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-primary transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-text/60">
                    <Book size={16} className="text-emerald-400" /> Study Hours
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    value={formData.studyHours}
                    onChange={(e) => setFormData({ ...formData, studyHours: Number(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-primary transition-all"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-text/60">Daily Notes</label>
                <textarea
                  rows={4}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="What happened today? Any specific thoughts or events?"
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 outline-none focus:border-primary transition-all resize-none"
                />
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl text-sm"
                >
                  {error}
                </motion.div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full p-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50 ${
                  error 
                    ? "bg-red-500 text-white shadow-red-500/20"
                    : "bg-primary text-white shadow-primary/20 hover:bg-primary/90"
                }`}
              >
                {loading ? <Loader2 className="animate-spin" /> : <Save />}
                {loading ? "Saving..." : error ? "Try Again" : "Save Daily Log"}
              </button>
            </form>
          )}
        </motion.div>

        <div className="mt-8 text-center">
          <p className="text-sm text-text/40 italic">"Tracking your behavior is the first step to perfecting your digital twin."</p>
        </div>
      </div>
    </div>
  );
}
