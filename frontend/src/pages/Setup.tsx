import { motion } from "motion/react";
import { Save, User, MessageSquare, Brain, Plus, Trash2, Loader2, ArrowLeft, Camera, CameraOff, RefreshCw, Wand2, Sparkles, X, Target, Calendar as CalendarIcon, Music } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { analyzeUserPhoto, generateDigitalAvatar, extractStructuredTraits } from "../services/geminiService";
import { useToast } from "../context/ToastContext";
import { buildApiUrl } from "../constants";

export default function Setup() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [personality, setPersonality] = useState("Professional");
  const [tone, setTone] = useState("Friendly");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [activeHours, setActiveHours] = useState("Standard (9-5)");
  const [problemSolvingStyle, setProblemSolvingStyle] = useState("Analytical");
  const [knowledge, setKnowledge] = useState<string[]>([]);
  const [newKnowledge, setNewKnowledge] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [newGoal, setNewGoal] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectors, setConnectors] = useState({ google: false, spotify: false });

  // Camera & Photo State
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);

  useEffect(() => {
    if (isCapturing && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [isCapturing, stream]);

  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const provider = event.data.provider;
        setConnectors(prev => ({ ...prev, [provider]: true }));
        showToast(`${provider.charAt(0).toUpperCase() + provider.slice(1)} connected successfully!`, "success");
      }
    };
    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, []);

  useEffect(() => {
    const fetchTwin = async () => {
      try {
        const token = localStorage.getItem('vitra_token');
        const response = await fetch(buildApiUrl('/api/twins'), {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setName(data.name || "");
          setPersonality(data.personality || "Professional");
          setTone(data.tone || "Friendly");
          setAvatarUrl(data.avatarUrl || "");
          setActiveHours(data.activeHours || "Standard (9-5)");
          setProblemSolvingStyle(data.problemSolvingStyle || "Analytical");
          setKnowledge(data.knowledge || []);
          setGoals(data.goals || []);
          
          // Check connectors status
          const userRes = await fetch(buildApiUrl('/api/auth/me'), {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            setConnectors({
              google: !!userData.googleTokens?.accessToken,
              spotify: !!userData.spotifyTokens?.accessToken
            });
          }
        }
      } catch (error) {
        console.error('Fetch twin error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTwin();
  }, [user, navigate]);

  const addKnowledge = () => {
    if (newKnowledge.trim()) {
      setKnowledge([...knowledge, newKnowledge.trim()]);
      setNewKnowledge("");
    }
  };

  const removeKnowledge = (index: number) => {
    setKnowledge(knowledge.filter((_, i) => i !== index));
  };

  const addGoal = () => {
    if (newGoal.trim()) {
      setGoals([...goals, newGoal.trim()]);
      setNewGoal("");
    }
  };

  const removeGoal = (index: number) => {
    setGoals(goals.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!user || !name.trim()) return;
    
    setSaving(true);
    setError(null);
    try {
      // Extract structured traits from knowledge if knowledge exists
      let extractedTraits = { coreKnowledge: [], strengths: [], weaknesses: [], primaryGoal: "" };
      if (knowledge.length > 0) {
        extractedTraits = await extractStructuredTraits(knowledge);
      }

      const token = localStorage.getItem('vitra_token');
      const response = await fetch(buildApiUrl('/api/twins'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          personality,
          tone,
          avatarUrl,
          activeHours,
          problemSolvingStyle,
          knowledge,
          goals,
          learnedTraits: {
            strengths: extractedTraits.strengths,
            weaknesses: extractedTraits.weaknesses,
            coreKnowledge: extractedTraits.coreKnowledge,
            primaryGoal: extractedTraits.primaryGoal
          }
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to save twin configuration');
      }

      showToast("Digital twin profile saved successfully!", "success");
      navigate("/dashboard");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save twin configuration. Please try again.";
      setError(errorMessage);
      showToast("Failed to save profile. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  const startCamera = async () => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(newStream);
      setIsCapturing(true);
      setError(null);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Could not access camera. Please ensure permissions are granted.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCapturing(false);
    setIsVideoReady(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current && isVideoReady) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        const width = videoRef.current.videoWidth;
        const height = videoRef.current.videoHeight;
        if (width === 0 || height === 0) {
          setError("Video dimensions not ready. Please try again in a second.");
          return;
        }
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        context.drawImage(videoRef.current, 0, 0, width, height);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.9);
        setCapturedPhoto(dataUrl);
        stopCamera();
      }
    } else {
      setError("Camera not ready. Please wait for the video to start.");
    }
  };

  const [quizStep, setQuizStep] = useState(0);
  const quizQuestions = [
    {
      question: "How should your twin react if you're feeling overwhelmed?",
      options: [
        { label: "Offer a structured plan to tackle the tasks.", personality: "Analytical", tone: "Professional" },
        { label: "Provide emotional support and encouragement.", personality: "Empathetic", tone: "Warm" },
        { label: "Suggest a creative break or a new perspective.", personality: "Creative", tone: "Friendly" }
      ]
    },
    {
      question: "What's the ideal tone for your twin's communication?",
      options: [
        { label: "Direct, concise, and professional.", personality: "Professional", tone: "Direct" },
        { label: "Warm, friendly, and conversational.", personality: "Friendly", tone: "Warm" },
        { label: "Witty, humorous, and engaging.", personality: "Witty", tone: "Humorous" }
      ]
    },
    {
      question: "How should your twin approach a complex problem?",
      options: [
        { label: "Break it down into logical steps.", personality: "Analytical", tone: "Logical" },
        { label: "Look for the most practical and immediate solution.", personality: "Practical", tone: "Efficient" },
        { label: "Trust intuition and look at the big picture.", personality: "Intuitive", tone: "Holistic" }
      ]
    }
  ];

  const handleQuizAnswer = (personalityVal: string, toneVal: string) => {
    setPersonality(personalityVal);
    setTone(toneVal);
    if (quizStep < quizQuestions.length - 1) {
      setQuizStep(quizStep + 1);
    } else {
      setQuizStep(-1); // Quiz complete
      showToast("Personality traits updated based on your quiz!", "success");
    }
  };

  const createFromPhoto = async () => {
    if (!capturedPhoto) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      // 1. Analyze photo for traits
      const analysis = await analyzeUserPhoto(capturedPhoto);
      setPersonality(analysis.personality);
      setTone(analysis.tone);
      // Filter out duplicate traits and add to knowledge
      const newTraits = analysis.traits.filter(t => !knowledge.includes(t));
      setKnowledge(prev => [...prev, ...newTraits]);
      
      // 2. Generate digital avatar based on analysis
      const avatarDescription = `
        A digital twin avatar that visually represents a ${analysis.personality} personality with a ${analysis.tone} tone. 
        The character should have features that suggest these traits: ${analysis.traits.join(', ')}.
        The attire, facial expression, and lighting should be carefully chosen to match this vibe.
      `.trim();
      
      const generatedAvatar = await generateDigitalAvatar(avatarDescription, analysis.personality, analysis.tone, analysis.traits);
      if (generatedAvatar) {
        setAvatarUrl(generatedAvatar);
      }
      showToast("Twin profile and avatar generated from your photo!", "success");
    } catch (err) {
      console.error("Error creating twin from photo:", err);
      setError("Failed to analyze photo. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConnect = async (provider: 'google' | 'spotify') => {
    try {
      const token = localStorage.getItem('vitra_token');
      const response = await fetch(buildApiUrl(`/api/connect/${provider}/url`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to get auth URL');
      const { url } = await response.json();
      
      window.open(url, 'oauth_popup', 'width=600,height=700');
    } catch (err) {
      console.error(`Error connecting to ${provider}:`, err);
      showToast(`Failed to connect to ${provider}.`, "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto min-h-screen">
      <header className="mb-12 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/5 rounded-full transition-all"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold mb-2">Configure Your Twin</h1>
            <p className="text-text/60">Define how VITRA should represent you.</p>
          </div>
        </div>
      </header>

      <div className="space-y-8">
        {/* Personality Quiz Section */}
        {quizStep !== -1 && (
          <section className="p-8 rounded-3xl bg-card border border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Brain size={120} />
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Sparkles className="text-secondary" />
                  <h2 className="text-xl font-bold">Personality Quiz</h2>
                </div>
                <span className="text-xs font-bold text-secondary uppercase tracking-widest">
                  Step {quizStep + 1} of {quizQuestions.length}
                </span>
              </div>
              
              <div className="mb-8">
                <h3 className="text-lg font-medium mb-6">{quizQuestions[quizStep].question}</h3>
                <div className="grid gap-3">
                  {quizQuestions[quizStep].options.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuizAnswer(option.personality, option.tone)}
                      className="w-full p-4 text-left bg-white/5 hover:bg-secondary/20 border border-white/10 hover:border-secondary/30 rounded-2xl transition-all group"
                    >
                      <span className="text-sm group-hover:text-white transition-colors">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <p className="text-xs text-text/40 italic">This helps VITRA match your thinking patterns.</p>
                <button 
                  onClick={() => setQuizStep(-1)}
                  className="text-xs font-bold text-text/40 hover:text-text transition-colors"
                >
                  Skip Quiz
                </button>
              </div>
            </div>
          </section>
        )}

        {/* AI Twin Creation from Photo */}
        <section className="p-8 rounded-3xl bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Sparkles size={120} />
          </div>
          
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <Camera className="text-primary" />
            <h2 className="text-xl font-bold">Create Twin from Photo</h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 relative z-10">
            <div className="space-y-4">
              <p className="text-sm text-text/70">
                Take a photo of yourself. VITRA will analyze your appearance and suggested traits to create a unique digital avatar and personality profile.
              </p>
              
              {!isCapturing && !capturedPhoto && (
                <button 
                  onClick={startCamera}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all"
                >
                  <Camera size={20} />
                  Start Camera
                </button>
              )}

              {isCapturing && (
                <div className="space-y-4">
                  <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border-2 border-primary">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted
                      onLoadedMetadata={() => {
                        setError(null);
                        setIsVideoReady(true);
                      }}
                      onCanPlay={() => setIsVideoReady(true)}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={capturePhoto}
                      disabled={!isVideoReady}
                      className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50"
                    >
                      <RefreshCw size={20} className={!isVideoReady ? "animate-spin" : ""} />
                      {isVideoReady ? "Capture Photo" : "Initializing..."}
                    </button>
                    <button 
                      onClick={stopCamera}
                      className="px-6 py-4 bg-white/5 text-text/60 rounded-2xl font-bold hover:bg-white/10 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {capturedPhoto && (
                <div className="space-y-4">
                  <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border-2 border-primary">
                    <img 
                      src={capturedPhoto} 
                      alt="Captured" 
                      className="w-full h-full object-cover"
                    />
                    <button 
                      onClick={() => setCapturedPhoto(null)}
                      className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-all"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <button 
                    onClick={createFromPhoto}
                    disabled={isAnalyzing}
                    className="w-full py-4 bg-gradient-to-r from-primary to-secondary text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
                  >
                    {isAnalyzing ? <Loader2 className="animate-spin" /> : <Wand2 size={20} />}
                    {isAnalyzing ? "Analyzing & Generating..." : "Generate Digital Twin"}
                  </button>
                </div>
              )}
              
              <canvas ref={canvasRef} className="hidden" />
            </div>
            
            <div className="flex items-center justify-center">
              <div className="relative">
                <div className="w-48 h-48 rounded-[40px] bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden relative z-10">
                  {avatarUrl ? (
                    <img 
                      key={avatarUrl}
                      src={avatarUrl} 
                      alt="Digital Twin" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="text-center p-4">
                      <User size={48} className="text-white/10 mx-auto mb-2" />
                      <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Awaiting Sync</p>
                    </div>
                  )}
                </div>
                {avatarUrl && (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -bottom-2 -right-2 bg-primary p-3 rounded-2xl shadow-xl z-20"
                  >
                    <Sparkles size={20} className="text-white" />
                  </motion.div>
                )}
                {/* Decorative rings */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-primary/10 rounded-full animate-[spin_10s_linear_infinite]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 border border-secondary/10 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
              </div>
            </div>
          </div>
        </section>

        {/* Basic Info */}
        <section className="p-8 rounded-3xl bg-card border border-white/5">
          <div className="flex items-center gap-3 mb-6">
            <User className="text-primary" />
            <h2 className="text-xl font-bold">Identity</h2>
          </div>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text/60 mb-2">Twin Name</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Digital Alex"
                    className="w-full p-4 rounded-xl bg-background border border-white/10 focus:border-primary outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text/60 mb-2">Avatar URL (Optional)</label>
                  <input 
                    type="text" 
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.png"
                    className="w-full p-4 rounded-xl bg-background border border-white/10 focus:border-primary outline-none transition-all"
                  />
                </div>
              </div>
              <div className="w-full md:w-32 flex flex-col items-center justify-center gap-2">
                <label className="block text-sm font-medium text-text/60">Preview</label>
                <div className="w-24 h-24 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                  {avatarUrl ? (
                    <img 
                      key={avatarUrl}
                      src={avatarUrl} 
                      alt="" 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer" 
                      onLoad={(e) => {
                        e.currentTarget.style.display = 'block';
                        e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.add('hidden');
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <User size={32} className={`text-white/20 fallback-icon ${avatarUrl ? 'hidden' : ''}`} />
                </div>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-text/60 mb-2">Active Hours</label>
                <input 
                  type="text" 
                  value={activeHours}
                  onChange={(e) => setActiveHours(e.target.value)}
                  placeholder="e.g. 9 AM - 6 PM"
                  className="w-full p-4 rounded-xl bg-background border border-white/10 focus:border-primary outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text/60 mb-2">Problem Solving Style</label>
                <select 
                  value={problemSolvingStyle}
                  onChange={(e) => setProblemSolvingStyle(e.target.value)}
                  className="w-full p-4 rounded-xl bg-background border border-white/10 focus:border-primary outline-none transition-all"
                >
                  <option>Analytical</option>
                  <option>Creative</option>
                  <option>Intuitive</option>
                  <option>Practical</option>
                </select>
              </div>
            </div>
        </section>

        {/* Personality & Tone */}
        <section className="p-8 rounded-3xl bg-card border border-white/5">
          <div className="flex items-center gap-3 mb-6">
            <MessageSquare className="text-secondary" />
            <h2 className="text-xl font-bold">Personality & Tone</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-text/60 mb-2">Personality Type</label>
              <select 
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                className="w-full p-4 rounded-xl bg-background border border-white/10 focus:border-primary outline-none transition-all"
              >
                <option>Professional</option>
                <option>Witty</option>
                <option>Empathetic</option>
                <option>Analytical</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text/60 mb-2">Tone of Voice</label>
              <select 
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full p-4 rounded-xl bg-background border border-white/10 focus:border-primary outline-none transition-all"
              >
                <option>Friendly</option>
                <option>Formal</option>
                <option>Casual</option>
                <option>Direct</option>
              </select>
            </div>
          </div>
        </section>

         {/* Knowledge Base */}
        <section className="p-8 rounded-3xl bg-card border border-white/5">
          <div className="flex items-center gap-3 mb-6">
            <Brain className="text-accent" />
            <h2 className="text-xl font-bold">Knowledge Base</h2>
          </div>
          <div className="space-y-4">
            <div className="flex gap-2">
              <input 
                type="text" 
                value={newKnowledge}
                onChange={(e) => setNewKnowledge(e.target.value)}
                placeholder="Add a fact about yourself..."
                className="flex-1 p-4 rounded-xl bg-background border border-white/10 focus:border-primary outline-none transition-all"
                onKeyPress={(e) => e.key === 'Enter' && addKnowledge()}
              />
              <button 
                onClick={addKnowledge}
                className="bg-primary p-4 rounded-xl hover:bg-primary/90 transition-all"
              >
                <Plus />
              </button>
            </div>
            <div className="space-y-2">
              {knowledge.map((item, index) => (
                <div key={index} className="flex justify-between items-center p-4 rounded-xl bg-background border border-white/5">
                  <span className="text-sm">{item}</span>
                  <button onClick={() => removeKnowledge(index)} className="text-red-400 hover:text-red-500">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* AI Twin Goals */}
        <section className="p-8 rounded-3xl bg-card border border-white/5">
          <div className="flex items-center gap-3 mb-6">
            <Target className="text-primary" />
            <h2 className="text-xl font-bold">AI Twin Goals</h2>
          </div>
          <p className="text-sm text-text/60 mb-6">
            Define what you want your AI twin to focus on. This helps VITRA prioritize its learning and responses.
          </p>
          <div className="space-y-4">
            <div className="flex gap-2">
              <input 
                type="text" 
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                placeholder="e.g. Help me learn Python..."
                className="flex-1 p-4 rounded-xl bg-background border border-white/10 focus:border-primary outline-none transition-all"
                onKeyPress={(e) => e.key === 'Enter' && addGoal()}
              />
              <button 
                onClick={addGoal}
                className="bg-primary p-4 rounded-xl hover:bg-primary/90 transition-all"
              >
                <Plus />
              </button>
            </div>
            <div className="space-y-2">
              {goals.map((goal, index) => (
                <div key={index} className="flex justify-between items-center p-4 rounded-xl bg-background border border-white/5">
                  <span className="text-sm">{goal}</span>
                  <button onClick={() => removeGoal(index)} className="text-red-400 hover:text-red-500">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Real-World Data Connectors */}
        <section className="p-8 rounded-3xl bg-card border border-white/5">
          <div className="flex items-center gap-3 mb-6">
            <RefreshCw className="text-secondary" />
            <h2 className="text-xl font-bold">Real-World Data Connectors</h2>
          </div>
          <p className="text-sm text-text/60 mb-8">
            Connect your real-world accounts to give your digital twin real-time context about your life and mood.
          </p>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className={`p-6 rounded-2xl border transition-all ${connectors.google ? 'bg-primary/5 border-primary/20' : 'bg-white/5 border-white/10'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${connectors.google ? 'bg-primary/20 text-primary' : 'bg-white/10 text-text/40'}`}>
                    <CalendarIcon size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold">Google Calendar</h3>
                    <p className="text-[10px] text-text/40 uppercase tracking-widest">Schedule Sync</p>
                  </div>
                </div>
                {connectors.google && (
                  <span className="text-[10px] bg-primary/20 text-primary px-2 py-1 rounded-full font-bold">CONNECTED</span>
                )}
              </div>
              <p className="text-xs text-text/60 mb-6 leading-relaxed">
                Allows your twin to know your upcoming meetings and events to provide better productivity nudges.
              </p>
              <button 
                onClick={() => handleConnect('google')}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${connectors.google ? 'bg-white/5 text-text/40 hover:bg-white/10' : 'bg-primary text-white hover:bg-primary/90'}`}
              >
                {connectors.google ? 'Reconnect' : 'Connect Google'}
              </button>
            </div>

            <div className={`p-6 rounded-2xl border transition-all ${connectors.spotify ? 'bg-secondary/5 border-secondary/20' : 'bg-white/5 border-white/10'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${connectors.spotify ? 'bg-secondary/20 text-secondary' : 'bg-white/10 text-text/40'}`}>
                    <Music size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold">Spotify</h3>
                    <p className="text-[10px] text-text/40 uppercase tracking-widest">Vibe Sync</p>
                  </div>
                </div>
                {connectors.spotify && (
                  <span className="text-[10px] bg-secondary/20 text-secondary px-2 py-1 rounded-full font-bold">CONNECTED</span>
                )}
              </div>
              <p className="text-xs text-text/60 mb-6 leading-relaxed">
                Syncs your current music to help your twin understand your mood and energy levels. Reconnect to enable playback controls.
              </p>
              <button 
                onClick={() => handleConnect('spotify')}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${connectors.spotify ? 'bg-white/5 text-text/40 hover:bg-white/10' : 'bg-secondary text-white hover:bg-secondary/90'}`}
              >
                {connectors.spotify ? 'Reconnect' : 'Connect Spotify'}
              </button>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-4 pt-8">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm"
            >
              {error}
            </motion.div>
          )}
          <div className="flex justify-end">
            <button 
              onClick={handleSave}
              disabled={saving}
              className="bg-primary px-8 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
              {saving ? "Saving..." : "Save Configuration"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
