import { motion } from "motion/react";
import { ArrowRight, Brain, MessageSquare, Mic, Shield, LogIn, Sparkles, Zap, Globe, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import React from "react";

export default function Landing() {
  const { user, signInWithGoogle } = useAuth();

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-hidden">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/10 rounded-full blur-[120px] animate-pulse [animation-delay:2s]" />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Brain size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold tracking-tighter">VITRA</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#features" className="text-sm text-white/60 hover:text-white transition-colors hidden md:block">Features</a>
          {user ? (
            <Link to="/dashboard" className="text-sm font-medium bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full transition-all border border-white/10">
              Dashboard
            </Link>
          ) : (
            <div className="flex items-center gap-4">
              <Link to="/login" className="text-sm font-medium text-white/60 hover:text-white transition-colors">
                Sign In
              </Link>
              <Link to="/register" className="text-sm font-medium bg-primary hover:bg-primary/90 px-5 py-2 rounded-full transition-all shadow-lg shadow-primary/20">
                Get Started
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-20 pb-32 px-6 max-w-7xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-primary/10 border border-primary/20 text-primary animate-bounce-slow">
            <Sparkles size={16} />
            <span className="text-xs font-bold uppercase tracking-widest">The Future of Identity</span>
          </div>
          
          <h1 className="text-7xl md:text-9xl font-bold tracking-tighter mb-8 leading-[0.85]">
            YOUR <span className="text-primary">DIGITAL</span><br />
            <span className="text-white/40">TWIN</span> AWAITS
          </h1>
          
          <p className="text-xl md:text-2xl text-white/50 mb-12 max-w-2xl mx-auto leading-relaxed font-light">
            VITRA creates a high-fidelity AI persona that mirrors your thoughts, 
            personality, and knowledge. Your legacy, digitized.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-20">
            {user ? (
              <Link
                to="/dashboard"
                className="group relative inline-flex items-center gap-3 bg-white text-black px-10 py-5 rounded-full font-bold transition-all hover:scale-105 overflow-hidden"
              >
                <span className="relative z-10">Enter Dashboard</span>
                <ArrowRight size={20} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                <div className="absolute inset-0 bg-primary translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </Link>
            ) : (
              <Link
                to="/register"
                className="group inline-flex items-center gap-3 bg-primary text-white px-10 py-5 rounded-full font-bold transition-all hover:scale-105 shadow-2xl shadow-primary/40"
              >
                Get Started Now
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            )}
            <a href="#features" className="px-10 py-5 rounded-full font-bold border border-white/10 hover:bg-white/5 transition-all">
              Explore Features
            </a>
          </div>

          {/* Floating Brain Visual */}
          <div className="relative max-w-4xl mx-auto">
            <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full" />
            <motion.div
              animate={{ 
                y: [0, -20, 0],
                rotate: [0, 2, -2, 0]
              }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="relative z-10 p-1 rounded-[60px] bg-gradient-to-br from-white/10 to-transparent border border-white/10 backdrop-blur-sm"
            >
              <div className="aspect-[16/9] rounded-[56px] bg-[#0A0A0A] overflow-hidden flex items-center justify-center">
                <Brain size={120} className="text-primary opacity-20 absolute" />
                <div className="relative z-10 flex flex-col items-center">
                  <div className="flex gap-2 mb-4">
                    {[...Array(3)].map((_, i) => (
                      <motion.div 
                        key={i}
                        animate={{ height: [10, 30, 10] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                        className="w-1.5 bg-primary rounded-full"
                      />
                    ))}
                  </div>
                  <p className="text-primary font-mono text-sm tracking-widest uppercase">Neural Sync Active</p>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Social Proof / Trusted By */}
      <section className="relative z-10 py-12 border-y border-white/5 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-[10px] uppercase tracking-[0.3em] text-white/30 mb-8 font-bold">Trusted by forward thinkers at</p>
          <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-30 grayscale">
            <div className="text-2xl font-bold tracking-tighter">LINEAR</div>
            <div className="text-2xl font-bold tracking-tighter italic">NOTION</div>
            <div className="text-2xl font-bold tracking-tighter">OPENAI</div>
            <div className="text-2xl font-bold tracking-tighter">VERCEL</div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="relative z-10 py-32 px-6 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">Engineered for Precision</h2>
            <p className="text-white/40 max-w-xl mx-auto">Built on advanced neural architectures to ensure your digital twin is indistinguishable from the real you.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Zap className="text-yellow-400" />}
              title="Instant Learning"
              description="Upload your writings, thoughts, and facts. VITRA absorbs your knowledge base in seconds."
            />
            <FeatureCard 
              icon={<Globe className="text-blue-400" />}
              title="Global Presence"
              description="Your twin can interact, assist, and represent you 24/7 across any digital platform."
            />
            <FeatureCard 
              icon={<Lock className="text-emerald-400" />}
              title="Private & Secure"
              description="Your data is encrypted and owned by you. Your twin only knows what you choose to teach it."
            />
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="relative z-10 py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-20">
            <div className="flex-1">
              <h2 className="text-5xl font-bold mb-8 tracking-tight leading-tight">
                Three steps to <span className="text-primary">immortality</span>.
              </h2>
              <div className="space-y-12">
                <Step number="01" title="Initialize Identity" description="Connect your account and define your twin's core personality traits and tone of voice." />
                <Step number="02" title="Knowledge Transfer" description="Feed your twin with facts, memories, and expertise to build its unique knowledge base." />
                <Step number="03" title="Seamless Interaction" description="Engage in real-time conversations. Your twin learns and evolves with every interaction." />
              </div>
            </div>
            <div className="flex-1 relative">
              <div className="aspect-square rounded-[60px] bg-gradient-to-br from-primary/20 to-secondary/20 border border-white/10 flex items-center justify-center relative overflow-hidden">
                <motion.div 
                  animate={{ 
                    scale: [1, 1.1, 1],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{ duration: 10, repeat: Infinity }}
                  className="relative z-10"
                >
                  <Brain size={180} className="text-primary opacity-50 blur-sm absolute inset-0" />
                  <Brain size={180} className="text-primary relative z-10" />
                </motion.div>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.05),transparent)]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 py-32 px-6 text-center">
        <div className="max-w-3xl mx-auto p-16 rounded-[60px] bg-gradient-to-b from-white/[0.05] to-transparent border border-white/10">
          <h2 className="text-4xl md:text-6xl font-bold mb-8 tracking-tight">Ready to meet yourself?</h2>
          <p className="text-white/40 mb-12 text-lg">Join thousands of others who are building their digital legacy today.</p>
          {user ? (
            <Link 
              to="/dashboard"
              className="inline-block bg-primary text-white px-12 py-6 rounded-full font-bold text-xl hover:scale-105 transition-all shadow-2xl shadow-primary/40"
            >
              Go to Dashboard
            </Link>
          ) : (
            <Link 
              to="/register"
              className="inline-block bg-primary text-white px-12 py-6 rounded-full font-bold text-xl hover:scale-105 transition-all shadow-2xl shadow-primary/40"
            >
              Get Started Now
            </Link>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-20 px-8 border-t border-white/5 text-center">
        <div className="flex items-center justify-center gap-2 mb-8 opacity-50">
          <Brain size={24} />
          <span className="text-xl font-bold tracking-tighter">VITRA</span>
        </div>
        <p className="text-white/30 text-sm">© 2026 VITRA AI. All rights reserved.</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <motion.div 
      whileHover={{ y: -10 }}
      className="p-10 rounded-[40px] bg-white/[0.03] border border-white/10 hover:border-primary/50 transition-all group"
    >
      <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-2xl font-bold mb-4">{title}</h3>
      <p className="text-white/40 leading-relaxed">{description}</p>
    </motion.div>
  );
}

function Step({ number, title, description }: { number: string, title: string, description: string }) {
  return (
    <div className="flex gap-8 group">
      <span className="text-4xl font-bold text-white/10 group-hover:text-primary/40 transition-colors">{number}</span>
      <div>
        <h3 className="text-2xl font-bold mb-2">{title}</h3>
        <p className="text-white/40 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
