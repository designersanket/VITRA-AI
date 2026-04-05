import { motion, AnimatePresence } from "motion/react";
import { Send, Mic, Brain, ArrowLeft, Loader2, Plus, MessageSquare, Menu, X, User, Trash2, Sparkles, ThumbsUp, ThumbsDown, Edit2, Check, MicOff, Pin, PinOff, Smile, Frown, Zap, AlertCircle, HelpCircle, Settings, ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { io, Socket } from "socket.io-client";
import { generateTwinResponseStream, TwinProfile, generateChatTitle, generateSpeech, generateChatSuggestions, pruneTwinMemory, extractImportantFacts } from "../services/geminiService";
import { streamLocalChat, LocalChatMessage, verifyOllama, getLocalModels } from "../services/localAiService";

interface Message {
  id: string;
  text: string;
  sender: "user" | "twin";
  timestamp: Date;
  feedback?: "positive" | "negative";
  feedbackCategory?: string;
  feedbackReason?: string;
  isPinned?: boolean;
  moodAtTime?: string;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: Date;
  lastMessage?: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

import { useToast } from "../context/ToastContext";
import { API_BASE_URL, buildApiUrl } from "../constants";
import { Volume2, VolumeX } from "lucide-react";

export default function Chat() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [twinProfile, setTwinProfile] = useState<TwinProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem("vitra_sidebar_collapsed") === "true";
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const isAtBottomRef = useRef(true);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [showPinned, setShowPinned] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const [showMicPrompt, setShowMicPrompt] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState<{ messageId: string, type: "positive" | "negative" } | null>(null);
  const [feedbackData, setFeedbackData] = useState({ category: "", reason: "" });
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(() => {
    return localStorage.getItem("vitra_speech_enabled") === "true";
  });

  const toggleSpeech = () => {
    const newValue = !isSpeechEnabled;
    setIsSpeechEnabled(newValue);
    localStorage.setItem("vitra_speech_enabled", newValue.toString());
    showToast(newValue ? "Speech Enabled" : "Speech Disabled", newValue ? "success" : "info");
  };
  const [wasLastInputVoice, setWasLastInputVoice] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLocalAiMode, setIsLocalAiMode] = useState(() => {
    return localStorage.getItem("vitra_local_ai_mode") === "true";
  });
  const [localAiModel, setLocalAiModel] = useState(() => {
    return localStorage.getItem("vitra_local_ai_model") || "mistral";
  });
  const [ollamaStatus, setOllamaStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredMessages = searchTerm ? messages.filter(m => 
    m.text.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  useEffect(() => {
    localStorage.setItem("vitra_speech_enabled", String(isSpeechEnabled));
  }, [isSpeechEnabled]);

  useEffect(() => {
    localStorage.setItem("vitra_sidebar_collapsed", String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem("vitra_local_ai_mode", String(isLocalAiMode));
  }, [isLocalAiMode]);

  useEffect(() => {
    localStorage.setItem("vitra_local_ai_model", localAiModel);
  }, [localAiModel]);

  useEffect(() => {
    const checkStatus = async () => {
      if (isLocalAiMode) {
        const status = await verifyOllama();
        setOllamaStatus(status === 'online' ? 'online' : 'offline');
        
        if (status === 'online') {
          const models = await getLocalModels();
          setAvailableModels(models);
        }
      }
    };
    
    checkStatus();
    const interval = setInterval(checkStatus, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, [isLocalAiMode]);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      // Detect if user is near bottom (within 100px)
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      isAtBottomRef.current = isAtBottom;
      setShowScrollButton(!isAtBottom);
      
      if (isAtBottom) {
        setHasNewMessages(false);
      }
    }
  }, []);

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (scrollContainer) {
      // Throttle scroll event for performance
      let throttleTimeout: NodeJS.Timeout | null = null;
      const throttledScroll = () => {
        if (!throttleTimeout) {
          throttleTimeout = setTimeout(() => {
            handleScroll();
            throttleTimeout = null;
          }, 100);
        }
      };

      scrollContainer.addEventListener("scroll", throttledScroll);
      handleScroll(); // Initial check
      return () => {
        scrollContainer.removeEventListener("scroll", throttledScroll);
        if (throttleTimeout) clearTimeout(throttleTimeout);
      };
    }
  }, [handleScroll]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth"
      });
      setHasNewMessages(false);
    }
  };

  const getVoiceForTone = (tone?: string) => {
    if (!tone) return "Kore";
    const t = tone.toLowerCase();
    if (t.includes("warm") || t.includes("friendly") || t.includes("empathetic")) return "Kore";
    if (t.includes("professional") || t.includes("serious") || t.includes("formal")) return "Zephyr";
    if (t.includes("playful") || t.includes("energetic") || t.includes("fun")) return "Puck";
    if (t.includes("deep") || t.includes("mysterious") || t.includes("calm")) return "Charon";
    if (t.includes("bold") || t.includes("strong") || t.includes("assertive")) return "Fenrir";
    return "Kore";
  };

  const playSpeech = async (text: string, force: boolean = false) => {
    if (!isSpeechEnabled && !force) return;
    try {
      const voice = getVoiceForTone(twinProfile?.tone);
      const audioData = await generateSpeech(text, voice);
      if (audioData) {
        // Stop previous audio
        if (audioContextRef.current) {
          try {
            audioContextRef.current.close();
          } catch (e) {
            console.error("Error closing audio context:", e);
          }
        }
        
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContextClass({ sampleRate: 24000 });
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        audioContextRef.current = audioContext;
        
        const binaryString = atob(audioData);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Convert Uint8Array (raw PCM) to Float32Array for AudioBuffer
        // Gemini TTS returns 16-bit PCM mono at 24kHz
        const int16Data = new Int16Array(bytes.buffer);
        const float32Data = new Float32Array(int16Data.length);
        for (let i = 0; i < int16Data.length; i++) {
          float32Data[i] = int16Data[i] / 32768.0;
        }
        
        const buffer = audioContext.createBuffer(1, float32Data.length, 24000);
        buffer.getChannelData(0).set(float32Data);
        
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start();
      }
    } catch (error) {
      console.error("Failed to play speech:", error);
    }
  };

  const handleApiError = (error: unknown, operation: string) => {
    console.error(`API Error (${operation}):`, error);
    showToast(`Error: ${operation} failed.`, "error");
  };

  // Socket.io Setup
  useEffect(() => {
    if (!user) return;

    const socket = io(API_BASE_URL);
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Connected to Socket.io");
      socket.emit("join", user.id);
    });

    socket.on("new_message", (data: { sessionId: string; message: Message }) => {
      if (data.sessionId === currentSessionId) {
        setMessages(prev => {
          // Check if message already exists (idempotency)
          if (prev.some(m => m.id === data.message.id)) return prev;
          return [...prev, { ...data.message, timestamp: new Date(data.message.timestamp) }];
        });
      }
      
      // Update session last message in sidebar
      setSessions(prev => prev.map(s => 
        s.id === data.sessionId ? { ...s, lastMessage: data.message.text } : s
      ));
    });

    socket.on("session_updated", (updatedSession: ChatSession) => {
      setSessions(prev => prev.map(s => 
        s.id === updatedSession.id ? { ...s, ...updatedSession, createdAt: new Date(updatedSession.createdAt) } : s
      ));
    });

    return () => {
      socket.disconnect();
    };
  }, [user, currentSessionId]);

  // Fetch Twin Profile
  useEffect(() => {
    const fetchTwin = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/twins"), {
          headers: { "Authorization": `Bearer ${localStorage.getItem("vitra_token")}` }
        });
        if (response.ok) {
          const data = await response.json();
          if (data) {
            setTwinProfile(data);
          } else {
            navigate("/setup");
          }
        } else {
          navigate("/setup");
        }
      } catch (error) {
        handleApiError(error, "Fetching twin profile");
      } finally {
        setLoading(false);
      }
    };

    fetchTwin();
  }, [user, navigate]);

  // Handle Quick Ask from Dashboard
  useEffect(() => {
    const query = searchParams.get("q");
    if (query && !input && !messages.length && currentSessionId) {
      setInput(query);
    }
  }, [searchParams, currentSessionId]);

  // Fetch Sessions
  useEffect(() => {
    if (!user) return;

    const fetchSessions = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/sessions"), {
          headers: { "Authorization": `Bearer ${localStorage.getItem("vitra_token")}` }
        });
        if (response.ok) {
          const data = await response.json();
          const sess = data.map((s: any) => ({
            ...s,
            createdAt: new Date(s.createdAt)
          }));
          setSessions(sess);

          if (sess.length > 0 && !currentSessionId) {
            setCurrentSessionId(sess[0].id);
          } else if (sess.length === 0 && !loading) {
            createNewSession();
          }
        }
      } catch (error) {
        handleApiError(error, "Fetching sessions");
      }
    };

    fetchSessions();
  }, [user, loading]);

  // Fetch Messages for current session
  useEffect(() => {
    if (!user || !currentSessionId) return;

    const fetchMessages = async () => {
      try {
        const response = await fetch(buildApiUrl(`/api/sessions/${currentSessionId}/messages`), {
          headers: { "Authorization": `Bearer ${localStorage.getItem("vitra_token")}` }
        });
        if (response.ok) {
          const data = await response.json();
          const msgs = data.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }));
          setMessages(msgs);
        }
      } catch (error) {
        handleApiError(error, "Fetching messages");
      }
    };

    fetchMessages();
  }, [user, currentSessionId]);

  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      // Auto-scroll if user is already at bottom or if it's a user message
      if (isAtBottomRef.current || lastMessage.sender === 'user') {
        scrollToBottom();
      } else {
        // If user is scrolled up and a new twin message arrives, show indicator
        setHasNewMessages(true);
      }
    }
  }, [messages]);

  useEffect(() => {
    if (isTyping && isAtBottomRef.current) {
      scrollToBottom();
    }
  }, [isTyping]);

  // Speech Recognition Setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            const transcript = event.results[i][0].transcript;
            setWasLastInputVoice(true);
            setInput(prev => {
              const newText = prev + (prev ? " " : "") + transcript;
              return newText;
            });
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        setInterimTranscript(interim);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        let message = "Speech recognition failed.";
        if (event.error === 'not-allowed') {
          message = "Microphone access denied. Please check your browser settings and ensure you've granted permission.";
        } else if (event.error === 'no-speech') {
          message = "No speech detected. Please try again.";
        }
        setMicError(message);
        setIsListening(false);
        setInterimTranscript("");
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        setInterimTranscript("");
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      // Check if we've prompted for mic before
      const hasPrompted = localStorage.getItem("vitra_mic_prompted");
      if (!hasPrompted) {
        setShowMicPrompt(true);
        return;
      }
      startListening();
    }
  };

  const startListening = () => {
    setMicError(null);
    try {
      recognitionRef.current?.start();
      setIsListening(true);
      setShowMicPrompt(false);
      localStorage.setItem("vitra_mic_prompted", "true");
      // Focus the input when listening starts
      inputRef.current?.focus();
    } catch (error) {
      console.error("Failed to start speech recognition:", error);
      setMicError("Failed to start microphone.");
    }
  };

  const createNewSession = async () => {
    if (!user) return;
    try {
      const response = await fetch(buildApiUrl("/api/sessions"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("vitra_token")}`
        },
        body: JSON.stringify({ title: "New Conversation" })
      });
      if (response.ok) {
        const newSession = await response.json();
        setSessions(prev => [{ ...newSession, createdAt: new Date(newSession.createdAt) }, ...prev]);
        setCurrentSessionId(newSession.id);
        setSidebarOpen(false);
      }
    } catch (error) {
      handleApiError(error, "Creating new session");
    }
  };

  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  const handleUpdateSessionTitle = async (sessionId: string) => {
    if (!user || !editingTitle.trim()) {
      setEditingSessionId(null);
      return;
    }

    try {
      const response = await fetch(buildApiUrl(`/api/sessions/${sessionId}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("vitra_token")}`
        },
        body: JSON.stringify({ title: editingTitle.trim() })
      });
      if (response.ok) {
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: editingTitle.trim() } : s));
        setEditingSessionId(null);
      }
    } catch (error) {
      handleApiError(error, "Updating session title");
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!user) return;

    try {
      const response = await fetch(buildApiUrl(`/api/sessions/${sessionId}`), {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${localStorage.getItem("vitra_token")}` }
      });
      if (response.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
        }
        setSessionToDelete(null);
      }
    } catch (error) {
      handleApiError(error, "Deleting session");
    }
  };

  const handleTogglePin = async (messageId: string, currentPinned: boolean) => {
    if (!user || !currentSessionId) return;
    try {
      const response = await fetch(buildApiUrl(`/api/sessions/${currentSessionId}/messages/${messageId}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("vitra_token")}`
        },
        body: JSON.stringify({ isPinned: !currentPinned })
      });
      if (response.ok) {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPinned: !currentPinned } : m));
      }
    } catch (error) {
      handleApiError(error, "Toggling pin");
    }
  };

  const handleFeedback = async (messageId: string, type: "positive" | "negative") => {
    if (type === "positive") {
      try {
        const response = await fetch(buildApiUrl(`/api/twins/feedback/${messageId}`), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("vitra_token")}`
          },
          body: JSON.stringify({ feedback: "positive" })
        });

        if (response.ok) {
          const data = await response.json();
          setMessages(prev => prev.map(m => m.id === messageId ? { ...m, feedback: "positive" } : m));
          if (data.twin) {
            setTwinProfile(data.twin);
            checkAndPruneMemory(data.twin);
          }
          showToast("Feedback recorded! Thanks.", "success");
        }
      } catch (error) {
        handleApiError(error, "Submitting feedback");
      }
    } else {
      setFeedbackModal({ messageId, type });
      setFeedbackData({ category: "", reason: "" });
    }
  };

  const checkAndPruneMemory = async (profile: TwinProfile) => {
    const strengths = profile.learnedTraits?.strengths || [];
    const weaknesses = profile.learnedTraits?.weaknesses || [];
    
    if (strengths.length + weaknesses.length > 15) {
      console.log("Memory threshold reached. Pruning...");
      const { corePersonality } = await pruneTwinMemory(profile);
      
      if (corePersonality) {
        try {
          const response = await fetch(buildApiUrl(`/api/twins`), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${localStorage.getItem("vitra_token")}`
            },
            body: JSON.stringify({ 
              corePersonality,
              learnedTraits: {
                ...profile.learnedTraits,
                strengths: [], // Clear after pruning
                weaknesses: [] // Clear after pruning
              }
            })
          });
          
          if (response.ok) {
            const updatedTwin = await response.json();
            setTwinProfile(updatedTwin);
            showToast("Memory pruned and core personality updated!", "info");
          }
        } catch (error) {
          console.error("Failed to update pruned memory:", error);
        }
      }
    }
  };

  const submitFeedback = async () => {
    if (!user || !currentSessionId || !feedbackModal) return;

    const { messageId, type } = feedbackModal;
    try {
      const response = await fetch(buildApiUrl(`/api/twins/feedback/${messageId}`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("vitra_token")}`
        },
        body: JSON.stringify({
          feedback: type,
          category: feedbackData.category,
          reason: feedbackData.reason
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => prev.map(m => m.id === messageId ? {
          ...m,
          feedback: type,
          feedbackCategory: feedbackData.category,
          feedbackReason: feedbackData.reason
        } : m));

        if (data.twin) {
          setTwinProfile(data.twin);
          checkAndPruneMemory(data.twin);
        }
        
        showToast("Feedback submitted. I'll learn from this!", "success");
        setFeedbackModal(null);
      }
    } catch (error) {
      handleApiError(error, "Submitting feedback");
    }
  };

  const handleSend = async (overrideText?: string) => {
    const textToSend = overrideText || input;
    if (!textToSend.trim() || !user || !twinProfile || !currentSessionId || isTyping) return;

    const text = textToSend.trim();
    setInput("");
    setSuggestions([]);
    setIsTyping(true);

    try {
      // 1. Save user message
      const userMsgResponse = await fetch(buildApiUrl(`/api/sessions/${currentSessionId}/messages`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("vitra_token")}`
        },
        body: JSON.stringify({ text, sender: "user" })
      });

      if (!userMsgResponse.ok) throw new Error("Failed to save user message");
      const userMsg = await userMsgResponse.json();
      setMessages(prev => [...prev, { ...userMsg, timestamp: new Date(userMsg.timestamp) }]);

      let aiText = "";
      let aiMood = "Neutral";

      if (isLocalAiMode) {
        // Check if Ollama is online
        if (ollamaStatus !== 'online') {
          const status = await verifyOllama();
          if (status !== 'online') {
            setOllamaStatus('offline');
            setShowSetupGuide(true);
            setIsTyping(false);
            return;
          }
          setOllamaStatus('online');
        }

        // Local AI Mode (Ollama)
        const localHistory: LocalChatMessage[] = messages.slice(-10).map(m => ({
          role: m.sender === "user" ? "user" : "assistant",
          content: m.text
        }));
        localHistory.push({ role: "user", content: text });

        try {
          const feedbackContext = messages
            .filter(m => m.sender === "twin" && m.feedback)
            .map(m => `- Response: "${m.text.slice(0, 50)}..." was rated ${m.feedback}${m.feedbackCategory ? ` (${m.feedbackCategory})` : ""}`)
            .join("\n");

          aiText = await streamLocalChat(localHistory, {
            model: localAiModel,
            twinProfile,
            feedbackContext,
            onChunk: (chunk) => {
              // We don't update messages during streaming to follow the "append after response" requirement
            }
          });

          // After streaming, save to DB
          const aiMsgResponse = await fetch(buildApiUrl(`/api/sessions/${currentSessionId}/messages`), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${localStorage.getItem("vitra_token")}`
            },
            body: JSON.stringify({ 
              text: aiText, 
              sender: "twin",
              moodAtTime: "Neutral"
            })
          });

          if (!aiMsgResponse.ok) throw new Error("Failed to save AI response");
          const aiMsg = await aiMsgResponse.json();
          
          // Append the final message
          setMessages(prev => [...prev, { ...aiMsg, timestamp: new Date(aiMsg.timestamp) }]);
        } catch (e: any) {
          throw e;
        }
      } else {
        // Gemini API Mode
        const history: { role: "user" | "model", text: string, feedback?: "positive" | "negative", feedbackCategory?: string, feedbackReason?: string }[] = messages.slice(-10).map(m => ({
          role: (m.sender === "user" ? "user" : "model") as "user" | "model",
          text: m.text,
          feedback: m.feedback as "positive" | "negative" | undefined,
          feedbackCategory: m.feedbackCategory,
          feedbackReason: m.feedbackReason
        }));

        try {
          const aiResponse = await generateTwinResponseStream(
            text, 
            twinProfile, 
            history, 
            (chunk) => {
              // We don't update messages during streaming to follow the "append after response" requirement
            },
            currentSessionId
          );

          aiText = aiResponse.text;
          aiMood = aiResponse.metadata.mood;

          // 3. Save AI response
          const aiMsgResponse = await fetch(buildApiUrl(`/api/sessions/${currentSessionId}/messages`), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${localStorage.getItem("vitra_token")}`
            },
            body: JSON.stringify({ 
              text: aiText, 
              sender: "twin",
              moodAtTime: aiMood
            })
          });

          if (!aiMsgResponse.ok) throw new Error("Failed to save AI response");
          const aiMsg = await aiMsgResponse.json();
          
          // Append the final message
          setMessages(prev => [...prev, { ...aiMsg, timestamp: new Date(aiMsg.timestamp) }]);

          // Update Twin Profile with learned traits if available
          if (aiResponse.metadata.updates) {
            const updatedTraits = {
              ...twinProfile.learnedTraits,
              ...aiResponse.metadata.updates,
              // Merge arrays if they exist
              topicInterests: Array.from(new Set([...(twinProfile.learnedTraits?.topicInterests || []), ...(aiResponse.metadata.updates.topicInterests || [])])),
              strengths: Array.from(new Set([...(twinProfile.learnedTraits?.strengths || []), ...(aiResponse.metadata.updates.strengths || [])])),
              weaknesses: Array.from(new Set([...(twinProfile.learnedTraits?.weaknesses || []), ...(aiResponse.metadata.updates.weaknesses || [])])),
              behaviorTraits: Array.from(new Set([...(twinProfile.learnedTraits?.behaviorTraits || []), ...(aiResponse.metadata.updates.behaviorTraits || [])])),
            };

            const updatePayload: any = { learnedTraits: updatedTraits };
            
            // Handle new knowledge/memory
            if (aiResponse.metadata.updates.newKnowledge && Array.isArray(aiResponse.metadata.updates.newKnowledge)) {
              const newMemories = aiResponse.metadata.updates.newKnowledge.map((text: string) => ({
                text,
                weight: 1.0,
                lastRecalled: new Date(),
                createdAt: new Date()
              }));
              updatePayload.memory = [...(twinProfile.memory || []), ...newMemories];
            }

            await fetch(buildApiUrl("/api/twins"), {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("vitra_token")}`
              },
              body: JSON.stringify(updatePayload)
            });
            
            setTwinProfile(prev => prev ? { ...prev, ...updatePayload } : null);
          }
        } catch (e: any) {
          throw e;
        }
      }

      // Common logic after AI response
      let newTitle = sessions.find(s => s.id === currentSessionId)?.title;
      
      if (messages.length === 0) {
        try {
          newTitle = await generateChatTitle([
            { role: "user", text },
            { role: "twin", text: aiText }
          ]);
          setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, title: newTitle } : s));
        } catch (e) {
          console.error("Failed to generate title:", e);
          newTitle = text.slice(0, 30) + (text.length > 30 ? "..." : "");
        }
      }

      await fetch(buildApiUrl(`/api/sessions/${currentSessionId}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("vitra_token")}`
        },
        body: JSON.stringify({ 
          lastMessage: text,
          title: newTitle
        })
      });

      playSpeech(aiText, wasLastInputVoice);
      setWasLastInputVoice(false);

      // 5. Generate suggestions for the next turn
      const updatedHistory = messages.slice(-10).map(m => ({ role: (m.sender === "user" ? "user" : "model") as "user" | "model", text: m.text }));
      updatedHistory.push({ role: "user", text });
      updatedHistory.push({ role: "model", text: aiText });
      
      const newSuggestions = await generateChatSuggestions(updatedHistory, twinProfile);
      setSuggestions(newSuggestions);

      // 6. Fact Extraction (Memory Management)
      // If we have 10 or more messages, extract facts from the oldest ones before they are "forgotten"
      if (messages.length >= 10) {
        const oldestMessages = messages.slice(0, 2); // Take the oldest pair (user + twin)
        const facts = await extractImportantFacts(oldestMessages.map(m => ({ role: m.sender === 'user' ? 'user' : 'twin', text: m.text })));
        if (facts.length > 0) {
          try {
            const response = await fetch(buildApiUrl(`/api/twins`), {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("vitra_token")}`
              },
              body: JSON.stringify({ 
                knowledge: Array.from(new Set([...(twinProfile?.knowledge || []), ...facts])) 
              })
            });
            
            if (response.ok) {
              const updatedTwin = await response.json();
              setTwinProfile(updatedTwin);
              console.log("Extracted facts saved to knowledge base:", facts);
            }
          } catch (e) {
            console.error("Failed to save extracted facts:", e);
          }
        }
      }

    } catch (error) {
      handleApiError(error, "Sending message");
    } finally {
      setIsTyping(false);
    }
  };

  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return text;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className="bg-primary/40 text-white rounded px-0.5">{part}</mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  const getMoodIcon = (mood: string) => {
    switch (mood?.toLowerCase()) {
      case 'motivated': return <Zap size={12} className="text-emerald-400" />;
      case 'frustrated': return <Frown size={12} className="text-red-400" />;
      case 'confused': return <HelpCircle size={12} className="text-amber-400" />;
      case 'focused': return <Brain size={12} className="text-blue-400" />;
      default: return <Smile size={12} className="text-primary" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-text">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-text overflow-hidden">
      {/* Sidebar */}
      <AnimatePresence>
        {(sidebarOpen || window.innerWidth > 768) && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className={`fixed md:relative z-50 ${isSidebarCollapsed ? "w-20" : "w-72"} h-full bg-card border-r border-white/5 flex flex-col transition-all duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
          >
            <div className={`p-4 border-b border-white/5 flex items-center ${isSidebarCollapsed ? "justify-center" : "justify-between"}`}>
              <div className="flex items-center gap-2">
                <Brain size={20} className="text-primary" />
                {!isSidebarCollapsed && <span className="font-bold tracking-tight">VITRA</span>}
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
                  className="hidden md:flex p-2 hover:bg-white/5 rounded-lg text-text/40 hover:text-text transition-all"
                  title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                  {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
                <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2 hover:bg-white/5 rounded-lg">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-4">
              <button 
                onClick={createNewSession}
                className={`w-full flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary p-3 rounded-xl border border-primary/20 transition-all font-medium ${isSidebarCollapsed ? "aspect-square p-0" : ""}`}
                title="New Chat"
              >
                <Plus size={18} />
                {!isSidebarCollapsed && <span>New Chat</span>}
              </button>
            </div>

            {!isSidebarCollapsed && (
              <div className="px-4 mb-4">
                <div className="relative group">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text/30 group-focus-within:text-primary transition-colors" />
                  <input
                    type="text"
                    placeholder="Search chats..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-xl py-2 pl-9 pr-4 text-xs outline-none focus:border-primary/50 focus:bg-white/10 transition-all"
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full text-text/30 hover:text-text"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
              {searchTerm && (filteredSessions.length > 0 || filteredMessages.length > 0) && (
                <div className="px-2 mb-2">
                  <p className="text-[10px] font-bold text-text/40 uppercase tracking-wider mb-2">
                    {filteredSessions.length > 0 ? "Matching Sessions" : "No Matching Sessions"}
                  </p>
                </div>
              )}

              {filteredSessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => {
                    setCurrentSessionId(session.id);
                    setSidebarOpen(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setCurrentSessionId(session.id);
                      setSidebarOpen(false);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left group cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                    currentSessionId === session.id ? "bg-primary/20 text-primary border border-primary/20" : "hover:bg-white/5 text-text/60"
                  } ${isSidebarCollapsed ? "justify-center" : ""}`}
                  title={isSidebarCollapsed ? session.title : ""}
                >
                  <MessageSquare size={18} className={currentSessionId === session.id ? "text-primary" : "text-text/40"} />
                  {!isSidebarCollapsed && (
                    <>
                      <div className="flex-1 truncate">
                        {editingSessionId === session.id ? (
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <input
                              autoFocus
                              type="text"
                              value={editingTitle}
                              onChange={e => setEditingTitle(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleUpdateSessionTitle(session.id);
                                if (e.key === 'Escape') setEditingSessionId(null);
                              }}
                              className="w-full bg-background border border-primary/30 rounded px-2 py-1 text-xs outline-none focus:border-primary"
                            />
                            <button onClick={() => handleUpdateSessionTitle(session.id)} className="p-1 hover:text-primary">
                              <Check size={14} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm font-medium truncate">
                              {searchTerm ? highlightText(session.title, searchTerm) : session.title}
                            </p>
                            <p className="text-[10px] opacity-50">{session.createdAt.toLocaleDateString()}</p>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setEditingSessionId(session.id); 
                              setEditingTitle(session.title);
                            }}
                            className="p-2 hover:bg-primary/20 hover:text-primary rounded-lg transition-all"
                            title="Edit Title"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSessionToDelete(session.id); }}
                            className="p-2 hover:bg-red-500/20 hover:text-red-500 rounded-lg transition-all"
                            title="Delete Chat"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {searchTerm && filteredMessages.length > 0 && (
                <div className="mt-6 px-2">
                  <p className="text-[10px] font-bold text-text/40 uppercase tracking-wider mb-2">Matching Messages</p>
                  <div className="space-y-2">
                    {filteredMessages.map(m => (
                        <button
                          key={m.id}
                          onClick={() => {
                            const el = document.getElementById(`msg-${m.id}`);
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }}
                          className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all border border-white/5"
                        >
                          <p className="text-[10px] font-bold text-primary mb-1">{m.sender === 'user' ? 'You' : twinProfile?.name}</p>
                          <p className="text-[11px] text-text/60 line-clamp-2 italic">
                            "{highlightText(m.text, searchTerm)}"
                          </p>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {searchTerm && filteredSessions.length === 0 && filteredMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                    <Search size={20} className="text-text/20" />
                  </div>
                  <p className="text-sm font-medium text-text/40">No results found</p>
                  <p className="text-xs text-text/20 mt-1 italic">"{searchTerm}"</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-white/5 space-y-2">
              {!isSidebarCollapsed && (
                <div className="mb-4 p-3 bg-white/5 rounded-2xl border border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Zap size={14} className={isLocalAiMode ? "text-primary" : "text-text/40"} />
                      <span className="text-xs font-bold">Local AI Mode</span>
                    </div>
                    <button 
                      onClick={() => setIsLocalAiMode(!isLocalAiMode)}
                      className={`w-10 h-5 rounded-full relative transition-all ${isLocalAiMode ? "bg-primary" : "bg-white/10"}`}
                    >
                      <motion.div 
                        animate={{ x: isLocalAiMode ? 20 : 2 }}
                        className="absolute top-1 w-3 h-3 bg-white rounded-full shadow-sm"
                      />
                    </button>
                  </div>
                  {isLocalAiMode && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-text/40 uppercase tracking-wider font-bold">Model (Ollama)</p>
                        <div className="flex items-center gap-1.5">
                          <div 
                            className={`w-1.5 h-1.5 rounded-full ${
                              ollamaStatus === 'online' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 
                              ollamaStatus === 'offline' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 
                              'bg-yellow-500 animate-pulse'
                            }`} 
                          />
                          <span className={`text-[9px] font-medium ${
                            ollamaStatus === 'online' ? 'text-green-500/80' : 
                            ollamaStatus === 'offline' ? 'text-red-500/80' : 
                            'text-yellow-500/80'
                          }`}>
                            {ollamaStatus === 'online' ? 'Online' : ollamaStatus === 'offline' ? 'Offline' : 'Checking...'}
                          </span>
                          {ollamaStatus === 'offline' && (
                            <button 
                              onClick={() => setShowSetupGuide(true)}
                              className="p-0.5 hover:bg-white/10 rounded transition-colors text-text/40 hover:text-primary"
                              title="Setup Guide"
                            >
                              <HelpCircle size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                      <select 
                        value={localAiModel}
                        onChange={(e) => setLocalAiModel(e.target.value)}
                        className="w-full bg-background border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-primary/50 transition-all"
                      >
                        {availableModels.length > 0 ? (
                          availableModels.map((m: any) => (
                            <option key={m.name} value={m.name}>
                              {m.name} ({Math.round(m.size / 1024 / 1024 / 1024 * 10) / 10}GB)
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="mistral">Mistral (7B)</option>
                            <option value="llama3">Llama 3 (8B)</option>
                            <option value="phi3">Phi-3 (Mini)</option>
                            <option value="gemma">Gemma (2B)</option>
                          </>
                        )}
                      </select>
                      <p className="text-[9px] text-text/30 leading-tight">
                        Requires Ollama running locally on port 11434.
                      </p>
                    </div>
                  )}
                </div>
              )}
              <Link to="/dashboard" className={`flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-all text-text/60 ${isSidebarCollapsed ? "justify-center" : ""}`} title="Back to Dashboard">
                <ArrowLeft size={18} />
                {!isSidebarCollapsed && <span>Back to Dashboard</span>}
              </Link>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col min-w-0 relative transition-all duration-500 ${isListening ? "bg-primary/5" : ""}`}>
        {/* Header */}
        <header className="p-4 border-b border-white/10 flex items-center justify-between bg-card/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 hover:bg-white/5 rounded-lg">
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-3">
              <div className="relative">
                <motion.div 
                  animate={isTyping ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 overflow-hidden"
                >
                  {twinProfile?.avatarUrl ? (
                    <img 
                      key={twinProfile.avatarUrl}
                      src={twinProfile.avatarUrl} 
                      alt={twinProfile.name} 
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
                  <Brain size={20} className={`text-primary fallback-icon ${twinProfile?.avatarUrl ? 'hidden' : ''}`} />
                </motion.div>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-secondary border-2 border-background rounded-full shadow-sm" />
              </div>
              <div>
                <h1 className="font-bold text-sm md:text-base">{twinProfile?.name || "VITRA Twin"}</h1>
                <p className="text-[10px] text-secondary font-medium uppercase tracking-wider">Online & Synced</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleSpeech}
              className={`p-2.5 rounded-xl transition-all flex items-center gap-2 ${isSpeechEnabled ? "bg-primary text-white shadow-lg shadow-primary/20" : "hover:bg-white/5 text-white/40"}`}
              title={isSpeechEnabled ? "Disable Speech" : "Enable Speech"}
            >
              {isSpeechEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              <span className="text-xs font-bold hidden sm:block">{isSpeechEnabled ? "Voice On" : "Voice Off"}</span>
            </button>
            <button 
              onClick={() => setShowPinned(!showPinned)}
              className={`p-2.5 rounded-xl transition-all flex items-center gap-2 ${showPinned ? "bg-secondary text-white shadow-lg shadow-secondary/20" : "hover:bg-white/5 text-white/40"}`}
              title="Pinned Messages"
            >
              <Pin size={18} fill={showPinned ? "currentColor" : "none"} />
              <span className="text-xs font-bold hidden sm:block">Pinned</span>
              {messages.filter(m => m.isPinned).length > 0 && (
                <span className="w-4 h-4 rounded-full bg-secondary text-white text-[10px] flex items-center justify-center">
                  {messages.filter(m => m.isPinned).length}
                </span>
              )}
            </button>
            <Link to="/setup" className="p-2.5 hover:bg-white/5 rounded-xl transition-all text-white/40">
              <Settings size={20} />
            </Link>
          </div>
        </header>

        {/* Pinned Messages Overlay */}
        <AnimatePresence>
          {showPinned && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-20 right-4 w-80 max-h-[60vh] bg-card border border-white/10 rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col backdrop-blur-xl"
            >
              <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Pin size={14} />
                  Pinned Messages
                </h3>
                <button onClick={() => setShowPinned(false)} className="p-1 hover:bg-white/10 rounded-lg">
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.filter(m => m.isPinned).length === 0 ? (
                  <div className="text-center py-8 text-white/20">
                    <Pin size={32} className="mx-auto mb-2 opacity-10" />
                    <p className="text-xs">No pinned messages</p>
                  </div>
                ) : (
                  messages.filter(m => m.isPinned).map(msg => (
                    <div key={msg.id} className="p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all group">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-bold ${msg.sender === "twin" ? "text-primary" : "text-secondary"}`}>
                          {msg.sender === "twin" ? twinProfile?.name : "You"}
                        </span>
                        <button 
                          onClick={() => handleTogglePin(msg.id, true)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-white/40 hover:text-red-400"
                        >
                          <X size={10} />
                        </button>
                      </div>
                      <p className="text-xs text-white/70 line-clamp-3">{msg.text}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Microphone Permission Prompt */}
        <AnimatePresence>
          {showMicPrompt && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-card border border-white/10 p-8 rounded-[32px] max-w-md w-full shadow-2xl text-center"
              >
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Mic size={32} className="text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Enable Voice Input</h3>
                <div className="space-y-4 mb-8 text-left">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-1">Why is this needed?</h4>
                    <p className="text-text/60 text-sm leading-relaxed">
                      To enable voice-to-text conversation with your digital twin. This allows you to speak naturally instead of typing.
                    </p>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-1">How is your data used?</h4>
                    <p className="text-text/60 text-sm leading-relaxed">
                      Your audio is processed in real-time within your browser to generate text. It is never recorded, stored, or sent to our servers, ensuring your privacy remains 100% protected.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={startListening}
                    className="w-full py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                  >
                    Allow Microphone Access
                  </button>
                  <button
                    onClick={() => setShowMicPrompt(false)}
                    className="w-full py-4 bg-white/5 text-text/60 rounded-2xl font-bold hover:bg-white/10 transition-all"
                  >
                    Maybe Later
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Listening Indicator Overlay */}
        <AnimatePresence>
          {isListening && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-32 left-1/2 -translate-x-1/2 z-40 bg-primary/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl flex flex-col items-center gap-2 border border-white/20 min-w-[200px]"
            >
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ height: [8, 16, 8] }}
                      transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                      className="w-1 bg-white rounded-full"
                    />
                  ))}
                </div>
                <span className="text-sm font-bold tracking-wide uppercase">Listening...</span>
                <button 
                  onClick={() => recognitionRef.current?.stop()}
                  className="ml-2 p-1 hover:bg-white/20 rounded-full transition-all"
                >
                  <X size={16} />
                </button>
              </div>
              {interimTranscript && (
                <p className="text-xs text-white/70 italic max-w-xs truncate">{interimTranscript}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feedback Modal */}
        <AnimatePresence>
          {feedbackModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-card border border-white/10 p-6 rounded-[32px] max-w-md w-full shadow-2xl"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    {feedbackModal.type === "positive" ? <ThumbsUp className="text-emerald-400" /> : <ThumbsDown className="text-red-400" />}
                    Improve Response
                  </h3>
                  <button onClick={() => setFeedbackModal(null)} className="p-2 hover:bg-white/5 rounded-full">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  {feedbackModal.type === "positive" ? (
                    <div>
                      <label className="block text-sm font-medium text-text/60 mb-2">What did you like?</label>
                      <div className="grid grid-cols-2 gap-2">
                        {['Helpful', 'Accurate', 'Engaging', 'Creative', 'Insightful', 'Personalized'].map(cat => (
                          <button
                            key={cat}
                            onClick={() => setFeedbackData({ ...feedbackData, category: cat })}
                            className={`p-3 rounded-xl border text-sm transition-all ${
                              feedbackData.category === cat ? "bg-primary/20 border-primary text-primary" : "bg-white/5 border-white/5 hover:border-white/10"
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-text/60 mb-2">What was wrong?</label>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                          {['Inaccurate', 'Too Long', 'Off-topic', 'Not like me', 'Tone Mismatch', 'Repetitive'].map(cat => (
                            <button
                              key={cat}
                              onClick={() => setFeedbackData({ ...feedbackData, category: cat })}
                              className={`p-3 rounded-xl border text-sm transition-all ${
                                feedbackData.category === cat ? "bg-red-500/20 border-red-500/50 text-red-400" : "bg-white/5 border-white/5 hover:border-white/10"
                              }`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text/60 mb-2">Additional details (optional)</label>
                        <textarea
                          value={feedbackData.reason}
                          onChange={(e) => setFeedbackData({ ...feedbackData, reason: e.target.value })}
                          placeholder="Tell us why this response wasn't good..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl p-4 outline-none focus:border-primary transition-all resize-none text-sm"
                          rows={3}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={submitFeedback}
                    className="w-full py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 mt-4"
                  >
                    Submit Feedback
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth scrollbar-hide"
        >
          <AnimatePresence initial={false}>
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-20 h-20 rounded-[30px] bg-primary/10 flex items-center justify-center mb-6 border border-primary/20">
                  <Brain size={40} className="text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Initialize Conversation</h2>
                <p className="text-text/40 max-w-sm">Start talking to your digital twin. It will learn from your thoughts and respond in your unique voice.</p>
              </div>
            )}
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                id={`msg-${msg.id}`}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex gap-4 ${msg.sender === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center border ${
                  msg.sender === "user" ? "bg-white/10 border-white/10" : "bg-primary/20 border-primary/30"
                }`}>
                  {msg.sender === "user" ? (
                    <User size={14} className="text-white/60" />
                  ) : (
                    <div className="relative w-full h-full flex items-center justify-center">
                      {twinProfile?.avatarUrl ? (
                        <img 
                          key={twinProfile.avatarUrl}
                          src={twinProfile.avatarUrl} 
                          alt="Twin" 
                          className="w-full h-full rounded-full object-cover" 
                          referrerPolicy="no-referrer"
                          onLoad={(e) => {
                            e.currentTarget.style.display = 'block';
                            e.currentTarget.parentElement?.querySelector('.fallback-icon-msg')?.classList.add('hidden');
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement?.querySelector('.fallback-icon-msg')?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <Brain 
                        size={14} 
                        className={`text-primary fallback-icon-msg ${twinProfile?.avatarUrl ? 'hidden' : ''}`} 
                      />
                    </div>
                  )}
                </div>
                <div className={`max-w-[80%] p-4 rounded-2xl relative group/msg transition-all duration-500 ${
                  msg.sender === "user" 
                    ? "bg-primary text-white rounded-tr-none shadow-lg shadow-primary/20" 
                    : `bg-card border rounded-tl-none ${
                        msg.moodAtTime === "motivated" ? "border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.1)]" :
                        msg.moodAtTime === "frustrated" ? "border-red-500/30 bg-red-500/5 shadow-[0_0_20px_rgba(239,68,68,0.1)]" :
                        msg.moodAtTime === "confused" ? "border-amber-500/30 bg-amber-500/5 shadow-[0_0_20px_rgba(245,158,11,0.1)]" :
                        "border-white/5"
                      }`
                }`}>
                  {msg.isPinned && (
                    <div className="absolute -top-2 -right-2 bg-secondary text-white p-1 rounded-full shadow-lg">
                      <Pin size={10} fill="currentColor" />
                    </div>
                  )}
                  <p className="leading-relaxed text-sm md:text-base">
                    {highlightText(msg.text, searchTerm)}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      {msg.sender === "twin" && (
                        <>
                          <div className="flex items-center gap-1 opacity-40 group-hover/msg:opacity-100 transition-opacity">
                            <span className="text-[10px] text-text/40 mr-1 hidden md:block">Helpful?</span>
                            <button 
                              onClick={() => handleFeedback(msg.id, "positive")}
                              className={`p-1 rounded-md hover:bg-white/10 transition-all ${msg.feedback === "positive" ? "text-emerald-400 opacity-100" : "text-white/40"}`}
                              title="Helpful"
                            >
                              <ThumbsUp size={12} fill={msg.feedback === "positive" ? "currentColor" : "none"} />
                            </button>
                            <button 
                              onClick={() => handleFeedback(msg.id, "negative")}
                              className={`p-1 rounded-md hover:bg-white/10 transition-all ${msg.feedback === "negative" ? "text-red-400 opacity-100" : "text-white/40"}`}
                              title="Not helpful"
                            >
                              <ThumbsDown size={12} fill={msg.feedback === "negative" ? "currentColor" : "none"} />
                            </button>
                            <button 
                              onClick={() => handleTogglePin(msg.id, !!msg.isPinned)}
                              className={`p-1 rounded-md hover:bg-white/10 transition-all ${msg.isPinned ? "text-secondary opacity-100" : "text-white/40"}`}
                              title={msg.isPinned ? "Unpin" : "Pin"}
                            >
                              <Pin size={12} fill={msg.isPinned ? "currentColor" : "none"} />
                            </button>
                            <button 
                              onClick={() => playSpeech(msg.text, true)}
                              className="p-1 rounded-md hover:bg-white/10 transition-all text-white/40 hover:text-primary"
                              title="Play Speech"
                            >
                              <Volume2 size={12} />
                            </button>
                          </div>
                          {msg.moodAtTime && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10">
                              {getMoodIcon(msg.moodAtTime)}
                              <span className="text-[10px] opacity-70 capitalize">{msg.moodAtTime}</span>
                            </div>
                          )}
                        </>
                      )}
                      {msg.sender === "user" && (
                        <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleTogglePin(msg.id, !!msg.isPinned)}
                            className={`p-1 rounded-md hover:bg-white/10 transition-all ${msg.isPinned ? "text-secondary opacity-100" : "text-white/40"}`}
                            title={msg.isPinned ? "Unpin" : "Pin"}
                          >
                            <Pin size={12} fill={msg.isPinned ? "currentColor" : "none"} />
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] opacity-50">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {isTyping && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-4"
            >
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Brain size={14} className="text-primary" />
              </div>
              <div className="flex gap-2 p-4 bg-card w-fit rounded-2xl rounded-tl-none border border-white/5 items-center">
                <motion.div 
                  animate={{ scale: [1, 1.8, 1], opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                  className="w-2 h-2 bg-primary rounded-full" 
                />
                <motion.div 
                  animate={{ scale: [1, 2.2, 1], opacity: [0.3, 1, 0.3], y: [0, -6, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: 0.2, ease: "easeInOut" }}
                  className="w-2.5 h-2.5 bg-primary rounded-full" 
                />
                <motion.div 
                  animate={{ scale: [1, 1.8, 1], opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: 0.4, ease: "easeInOut" }}
                  className="w-2 h-2 bg-primary rounded-full" 
                />
              </div>
            </motion.div>
          )}
        </div>

        {/* Scroll to Bottom Button */}
        <AnimatePresence>
          {showScrollButton && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={scrollToBottom}
              className="absolute bottom-32 right-8 z-40 p-2.5 bg-card/80 backdrop-blur-md text-white/70 hover:text-white rounded-full shadow-xl border border-white/10 transition-colors group"
              title="Scroll to bottom"
            >
              <div className="relative">
                <ChevronDown size={20} strokeWidth={2.5} />
                {hasNewMessages && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full border-2 border-card animate-pulse" />
                )}
              </div>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Suggestions */}
        <AnimatePresence>
          {suggestions.length > 0 && !isTyping && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="px-4 md:px-8 pb-4 flex flex-wrap gap-2 justify-center max-w-4xl mx-auto"
            >
              {suggestions.map((suggestion, i) => (
                <button
                  key={`suggestion-${i}-${suggestion}`}
                  onClick={() => handleSend(suggestion)}
                  className="px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-primary/10 hover:border-primary/30 text-xs text-text/60 hover:text-primary transition-all shadow-sm"
                >
                  {suggestion}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Area */}
        <div className="p-4 md:p-8 bg-background/80 backdrop-blur-xl border-t border-white/5">
          <div className="max-w-4xl mx-auto flex gap-3 items-center bg-card p-2 rounded-2xl border border-white/10 focus-within:border-primary/50 transition-all shadow-xl">
            <div className="flex items-center gap-1">
              <button 
                onClick={toggleListening}
                className={`p-3 rounded-xl transition-all ${isListening ? "bg-red-500 text-white animate-pulse" : "hover:bg-white/5 text-text/60"}`}
                title={isListening ? "Stop Listening" : "Voice Input"}
              >
                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              {!isListening && (
                <button 
                  onClick={() => setMicError("To use voice input, ensure your browser has microphone permissions enabled for this site. Check your browser's address bar for a lock or camera/mic icon.")}
                  className="p-2 hover:bg-white/5 text-text/30 rounded-full transition-all hidden sm:block"
                  title="Microphone Help"
                >
                  <HelpCircle size={14} />
                </button>
              )}
            </div>
            <input 
              ref={inputRef}
              type="text" 
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setWasLastInputVoice(false);
              }}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isListening ? "Listening..." : "Talk to your twin..."}
              className="flex-1 bg-transparent outline-none p-2 text-sm md:text-base"
            />
            {micError && (
              <div className="absolute -top-16 left-0 right-0 flex justify-center px-4">
                <div className="bg-red-500 text-white text-[10px] md:text-xs px-4 py-2 rounded-xl flex items-center gap-2 animate-bounce shadow-lg max-w-md">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{micError}</span>
                  <button onClick={() => setMicError(null)} className="ml-2 hover:bg-white/20 rounded-full p-1">
                    <X size={12} />
                  </button>
                </div>
              </div>
            )}
            <button 
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              className="p-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={20} />
            </button>
          </div>
          <p className="text-center text-[10px] text-text/30 mt-4">VITRA can make mistakes. Verify important information.</p>
        </div>
      </div>
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {sessionToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card border border-white/10 p-8 rounded-[32px] max-w-sm w-full shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} className="text-red-500" />
              </div>
              <h3 className="text-xl font-bold mb-3">Delete Conversation?</h3>
              <p className="text-text/60 mb-8 text-sm leading-relaxed">
                This action cannot be undone. All messages in this session will be permanently removed.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setSessionToDelete(null)}
                  className="flex-1 px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all border border-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteSession(sessionToDelete)}
                  className="flex-1 px-6 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold transition-all shadow-lg shadow-red-500/20"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Setup Guide Overlay */}
      <AnimatePresence>
        {showSetupGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
            onClick={() => setShowSetupGuide(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-card border border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3 text-primary">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Zap size={20} />
                  </div>
                  <h3 className="text-xl font-bold">Ollama Setup Guide</h3>
                </div>
                <button 
                  onClick={() => setShowSetupGuide(false)}
                  className="p-2 hover:bg-white/5 rounded-xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <p className="text-sm text-text/60 leading-relaxed">
                    Local AI mode requires <span className="text-primary font-bold">Ollama</span> to be running on your machine.
                  </p>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-text/40">Step 1: Install Ollama</p>
                    <a 
                      href="https://ollama.com/download" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2.5 bg-white text-black rounded-xl font-bold text-sm hover:bg-white/90 transition-all"
                    >
                      Download Ollama
                    </a>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-text/40">Step 2: Pull the Model</p>
                  <p className="text-xs text-text/60">Run this command in your terminal to download the selected model:</p>
                  <div className="relative group">
                    <code className="block p-4 bg-black/40 rounded-2xl border border-white/10 text-xs font-mono text-primary break-all">
                      ollama pull {localAiModel}
                    </code>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(`ollama pull ${localAiModel}`);
                      }}
                      className="absolute right-3 top-3 p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="Copy command"
                    >
                      <Check size={14} />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-text/40">Step 3: Start Ollama</p>
                  <p className="text-xs text-text/60">Ensure the Ollama application is running. It should be listening on <span className="text-primary">localhost:11434</span>.</p>
                </div>
              </div>

              <button 
                onClick={() => setShowSetupGuide(false)}
                className="w-full mt-8 py-3 bg-white/5 hover:bg-white/10 rounded-2xl font-bold text-sm transition-all border border-white/5"
              >
                Got it, thanks!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
