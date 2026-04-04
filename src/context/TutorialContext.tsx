import React, { createContext, useContext, useState, useEffect } from 'react';

export type TutorialStep = {
  id: string;
  title: string;
  content: string;
  targetId: string;
  route: string;
};

interface TutorialContextType {
  isTutorialActive: boolean;
  currentStepIndex: number;
  steps: TutorialStep[];
  startTutorial: () => void;
  stopTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
}

const steps: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to VITRA!',
    content: 'Your digital twin journey starts here. Let\'s take a quick tour of the key features.',
    targetId: 'dashboard-welcome',
    route: '/dashboard',
  },
  {
    id: 'setup-twin',
    title: 'Set Up Your Twin',
    content: 'First, personalize your digital twin. Upload a photo and define its personality to match yours.',
    targetId: 'nav-setup',
    route: '/dashboard',
  },
  {
    id: 'chat-twin',
    title: 'Chat with Your Twin',
    content: 'Engage in deep conversations. Your twin learns from every interaction to better reflect your thoughts.',
    targetId: 'nav-chat',
    route: '/dashboard',
  },
  {
    id: 'log-data',
    title: 'Log Daily Data',
    content: 'Keep track of your mood, energy, and activities. This data helps your twin understand your daily life.',
    targetId: 'nav-tracker',
    route: '/dashboard',
  },
  {
    id: 'insights',
    title: 'Gain Insights',
    content: 'See patterns and predictions based on your data and conversations. Discover more about yourself.',
    targetId: 'nav-insights',
    route: '/dashboard',
  },
  {
    id: 'finish',
    title: 'You\'re All Set!',
    content: 'Explore VITRA and start building your digital legacy. Have fun!',
    targetId: 'dashboard-stats',
    route: '/dashboard',
  },
];

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isTutorialActive, setIsTutorialActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('vitra_tutorial_completed');
    if (!hasSeenTutorial) {
      // We don't auto-start here to avoid interrupting the initial load
      // but we could if we wanted to.
    }
  }, []);

  const startTutorial = () => {
    setCurrentStepIndex(0);
    setIsTutorialActive(true);
  };

  const stopTutorial = () => {
    setIsTutorialActive(false);
    localStorage.setItem('vitra_tutorial_completed', 'true');
  };

  const nextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      stopTutorial();
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const goToStep = (index: number) => {
    if (index >= 0 && index < steps.length) {
      setCurrentStepIndex(index);
    }
  };

  return (
    <TutorialContext.Provider value={{
      isTutorialActive,
      currentStepIndex,
      steps,
      startTutorial,
      stopTutorial,
      nextStep,
      prevStep,
      goToStep,
    }}>
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
};
