import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTutorial } from '../context/TutorialContext';
import { ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';

export const TutorialOverlay: React.FC = () => {
  const { isTutorialActive, currentStepIndex, steps, nextStep, prevStep, stopTutorial } = useTutorial();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const step = steps[currentStepIndex];

  useEffect(() => {
    if (isTutorialActive && step.targetId) {
      const updateRect = () => {
        const element = document.getElementById(step.targetId);
        if (element) {
          setTargetRect(element.getBoundingClientRect());
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      };

      updateRect();
      window.addEventListener('resize', updateRect);
      window.addEventListener('scroll', updateRect);
      
      // Also check periodically in case of layout shifts
      const interval = setInterval(updateRect, 500);

      return () => {
        window.removeEventListener('resize', updateRect);
        window.removeEventListener('scroll', updateRect);
        clearInterval(interval);
      };
    }
  }, [isTutorialActive, step]);

  if (!isTutorialActive || !targetRect) return null;

  const tooltipWidth = 320;
  const tooltipHeight = 200;
  
  let top = targetRect.bottom + 20;
  let left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);

  // Keep tooltip within viewport
  if (left < 20) left = 20;
  if (left + tooltipWidth > window.innerWidth - 20) left = window.innerWidth - tooltipWidth - 20;
  if (top + tooltipHeight > window.innerHeight - 20) {
    top = targetRect.top - tooltipHeight - 20;
  }

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Backdrop with hole */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto">
        <defs>
          <mask id="tutorial-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={targetRect.left - 8}
              y={targetRect.top - 8}
              width={targetRect.width + 16}
              height={targetRect.height + 16}
              rx="12"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.7)"
          mask="url(#tutorial-mask)"
          onClick={stopTutorial}
        />
      </svg>

      {/* Tooltip */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{
          position: 'absolute',
          top,
          left,
          width: tooltipWidth,
        }}
        className="bg-card border border-primary/30 rounded-3xl p-6 shadow-2xl pointer-events-auto backdrop-blur-xl"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles size={16} className="text-primary" />
            </div>
            <h4 className="font-bold text-sm">{step.title}</h4>
          </div>
          <button onClick={stopTutorial} className="p-1 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-all">
            <X size={16} />
          </button>
        </div>

        <p className="text-sm text-white/60 leading-relaxed mb-6">
          {step.content}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all ${
                  i === currentStepIndex ? 'w-4 bg-primary' : 'w-1 bg-white/10'
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {currentStepIndex > 0 && (
              <button
                onClick={prevStep}
                className="p-2 hover:bg-white/5 rounded-xl text-white/60 transition-all"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <button
              onClick={nextStep}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all"
            >
              {currentStepIndex === steps.length - 1 ? 'Finish' : 'Next'}
              {currentStepIndex < steps.length - 1 && <ChevronRight size={18} />}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
