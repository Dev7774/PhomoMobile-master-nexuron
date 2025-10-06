import React, { createContext, useContext, useEffect, ReactNode, useRef, useCallback } from 'react';
import { useWalkthroughStore, WalkthroughFlow, WalkthroughStep } from '@/src/stores/walkthroughStore';
import { useAuth } from '@/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface WalkthroughContextType {
  // State
  isActive: boolean;
  currentStep: WalkthroughStep | null;
  currentFlow: WalkthroughFlow | null;
  currentStepIndex: number;
  totalSteps: number;
  isLoading: boolean;

  // Actions
  startWalkthrough: (flowId: string) => Promise<boolean>;
  forceStartWalkthrough: (flowId: string) => Promise<boolean>;
  nextStep: () => Promise<boolean>;
  previousStep: () => boolean;
  skipWalkthrough: () => void;
  completeWalkthrough: () => void;
  
  // Flow management
  registerFlow: (flow: WalkthroughFlow) => void;
  
  // Element management
  registerElement: (key: string, ref: React.RefObject<any>) => void;
  unregisterElement: (key: string) => void;
  getElementRef: (key: string) => React.RefObject<any> | null;

  // Utils
  isFlowCompleted: (flowId: string) => boolean;
  isFlowSkipped: (flowId: string) => boolean;
}

const WalkthroughContext = createContext<WalkthroughContextType | null>(null);

interface WalkthroughProviderProps {
  children: ReactNode;
}

export const WalkthroughProvider: React.FC<WalkthroughProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const {
    isActive,
    currentFlow,
    currentStepIndex,
    isLoading,
    completedFlows,
    skippedFlows,
    
    // Actions
    startFlow,
    forceStartFlow,
    nextStep,
    previousStep,
    skipFlow,
    completeFlow,
    
    // Management
    registerFlow,
    registerElement,
    unregisterElement,
    getElementRef,
    
    // Persistence
    loadProgress,
    saveProgress,
  } = useWalkthroughStore();

  // Load walkthrough progress on app start (device-wide, not user-specific)
  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  // Auto-save progress when flows are completed or skipped
  useEffect(() => {
    if (completedFlows.size > 0 || skippedFlows.size > 0) {
      const saveTimeout = setTimeout(() => {
        saveProgress();
      }, 100); // Debounce saves

      return () => clearTimeout(saveTimeout);
    }
  }, [completedFlows, skippedFlows, saveProgress]);

  // Derived state
  const currentStep = currentFlow?.steps[currentStepIndex] || null;
  const totalSteps = currentFlow?.steps.length || 0;
  
  // Wrap skipFlow to also mark the walkthrough as shown
  const enhancedSkipWalkthrough = useCallback(async () => {
    if (currentFlow && user?.username) {
      // Mark as shown in AsyncStorage to prevent re-triggering
      const walkthroughShownKey = `walkthrough_shown_${user.username}`;
      await AsyncStorage.setItem(walkthroughShownKey, 'true');
      console.log('[WALKTHROUGH] Marked as shown due to skip');
    }
    skipFlow();
  }, [currentFlow, user?.username, skipFlow]);
  
  // Wrap completeFlow to also mark the walkthrough as shown
  const enhancedCompleteWalkthrough = useCallback(async () => {
    if (currentFlow && user?.username) {
      // Mark as shown in AsyncStorage to prevent re-triggering
      const walkthroughShownKey = `walkthrough_shown_${user.username}`;
      await AsyncStorage.setItem(walkthroughShownKey, 'true');
      console.log('[WALKTHROUGH] Marked as shown due to completion');
    }
    completeFlow();
  }, [currentFlow, user?.username, completeFlow]);

  // Context value
  const contextValue: WalkthroughContextType = {
    // State
    isActive,
    currentStep,
    currentFlow,
    currentStepIndex,
    totalSteps,
    isLoading,

    // Actions
    startWalkthrough: startFlow,
    forceStartWalkthrough: forceStartFlow,
    nextStep,
    previousStep,
    skipWalkthrough: enhancedSkipWalkthrough,
    completeWalkthrough: enhancedCompleteWalkthrough,
    
    // Management
    registerFlow,
    registerElement,
    unregisterElement,
    getElementRef,

    // Utils
    isFlowCompleted: (flowId: string) => completedFlows.has(flowId),
    isFlowSkipped: (flowId: string) => skippedFlows.has(flowId),
  };

  return (
    <WalkthroughContext.Provider value={contextValue}>
      {children}
    </WalkthroughContext.Provider>
  );
};

export const useWalkthrough = (): WalkthroughContextType => {
  const context = useContext(WalkthroughContext);
  if (!context) {
    throw new Error('useWalkthrough must be used within a WalkthroughProvider');
  }
  return context;
};

// Hook for registering walkthrough flows
export const useWalkthroughFlow = (flow: WalkthroughFlow) => {
  const { registerFlow } = useWalkthrough();
  
  useEffect(() => {
    registerFlow(flow);
  }, [flow.id, registerFlow]);
};

// Hook for registering targetable elements
export const useWalkthroughElement = (key: string) => {
  const { registerElement, unregisterElement } = useWalkthrough();
  const ref = useRef<any>(null);
  
  useEffect(() => {
    registerElement(key, ref);
    return () => {
      unregisterElement(key);
    };
  }, [key, registerElement, unregisterElement]);
  
  return ref;
};