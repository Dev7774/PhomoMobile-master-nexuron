import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WalkthroughStep {
  id: string;
  flowId: string;
  order: number;
  title: string;
  content: string;
  targetScreen: string; // Tab name or screen route
  targetElement?: string; // Ref key or selector
  highlightConfig?: {
    type: 'circle' | 'rectangle' | 'rounded';
    padding?: number;
    animated?: boolean;
  };
  tooltipConfig: {
    position: 'top' | 'bottom' | 'left' | 'right' | 'center';
    showSkip?: boolean;
    showPrevious?: boolean;
    showNext?: boolean;
  };
  navigationAction?: {
    type: 'navigate' | 'press' | 'wait';
    target?: string;
    params?: Record<string, any>;
    waitForLoad?: boolean;
  };
  waitForElement?: boolean;
  customAction?: () => Promise<void>;
}

export interface WalkthroughFlow {
  id: string;
  name: string;
  description: string;
  steps: WalkthroughStep[];
  triggerConditions?: {
    onFirstLaunch?: boolean;
    onScreenVisit?: string;
    afterOnboarding?: boolean;
    userAction?: string;
  }[];
  completionTracking: boolean;
}

export interface WalkthroughPreferences {
  enableAutoTrigger: boolean;
  showHelpBadges: boolean;
  enableHaptics: boolean;
  animationSpeed: 'slow' | 'normal' | 'fast';
}

interface WalkthroughState {
  // Current walkthrough state
  isActive: boolean;
  currentFlow: WalkthroughFlow | null;
  currentStepIndex: number;
  isLoading: boolean;

  // User progress tracking
  completedFlows: Set<string>;
  skippedFlows: Set<string>;
  userPreferences: WalkthroughPreferences;
  availableFlows: WalkthroughFlow[];

  // Element refs for targeting
  elementRefs: Map<string, React.RefObject<any>>;

  // Actions
  startFlow: (flowId: string) => Promise<boolean>;
  forceStartFlow: (flowId: string) => Promise<boolean>;
  nextStep: () => Promise<boolean>;
  previousStep: () => boolean;
  skipFlow: () => void;
  completeFlow: () => void;
  markFlowCompleted: (flowId: string) => void;
  
  // Element ref management
  registerElement: (key: string, ref: React.RefObject<any>) => void;
  unregisterElement: (key: string) => void;
  getElementRef: (key: string) => React.RefObject<any> | null;

  // Flow management
  registerFlow: (flow: WalkthroughFlow) => void;
  getFlow: (flowId: string) => WalkthroughFlow | null;
  
  // Preferences
  updatePreferences: (preferences: Partial<WalkthroughPreferences>) => void;

  // Persistence
  loadProgress: () => Promise<void>;
  saveProgress: () => Promise<void>;
  
  // Reset/cleanup
  reset: () => void;
}

const STORAGE_KEYS = {
  COMPLETED_FLOWS: 'walkthrough_completed',
  SKIPPED_FLOWS: 'walkthrough_skipped',
  PREFERENCES: 'walkthrough_preferences',
};

const DEFAULT_PREFERENCES: WalkthroughPreferences = {
  enableAutoTrigger: true,
  showHelpBadges: true,
  enableHaptics: true,
  animationSpeed: 'normal',
};

export const useWalkthroughStore = create<WalkthroughState>((set, get) => ({
  // Initial state
  isActive: false,
  currentFlow: null,
  currentStepIndex: 0,
  isLoading: false,
  completedFlows: new Set(),
  skippedFlows: new Set(),
  userPreferences: DEFAULT_PREFERENCES,
  availableFlows: [],
  elementRefs: new Map(),

  // Flow management
  registerFlow: (flow) => {
    set((state) => ({
      availableFlows: [...state.availableFlows.filter(f => f.id !== flow.id), flow],
    }));
  },

  getFlow: (flowId) => {
    return get().availableFlows.find(flow => flow.id === flowId) || null;
  },

  // Element ref management
  registerElement: (key, ref) => {
    const { elementRefs } = get();
    elementRefs.set(key, ref);
    set({ elementRefs: new Map(elementRefs) });
  },

  unregisterElement: (key) => {
    const { elementRefs } = get();
    elementRefs.delete(key);
    set({ elementRefs: new Map(elementRefs) });
  },

  getElementRef: (key) => {
    return get().elementRefs.get(key) || null;
  },

  // Walkthrough actions
  forceStartFlow: async (flowId: string) => {
    const { getFlow } = get();
    
    // Check if flow exists
    const flow = getFlow(flowId);
    if (!flow) {
      return false;
    }

    // Start the flow (ignore completion status)
    set({
      isActive: true,
      currentFlow: flow,
      currentStepIndex: 0,
      isLoading: false,
    });

    return true;
  },

  startFlow: async (flowId) => {
    const { getFlow, completedFlows } = get();
    
    // Check if flow exists
    const flow = getFlow(flowId);
    if (!flow) {
      return false;
    }

    // Check if already completed (unless forcing restart)
    if (completedFlows.has(flowId)) {
      return false;
    }

    // Start the flow
    set({
      isActive: true,
      currentFlow: flow,
      currentStepIndex: 0,
      isLoading: false,
    });

    return true;
  },

  nextStep: async () => {
    const { currentFlow, currentStepIndex } = get();
    
    if (!currentFlow) return false;

    const nextIndex = currentStepIndex + 1;
    
    if (nextIndex >= currentFlow.steps.length) {
      // Flow completed
      get().completeFlow();
      return false;
    }

    // Move to next step
    set({ currentStepIndex: nextIndex });
    return true;
  },

  previousStep: () => {
    const { currentStepIndex } = get();
    
    if (currentStepIndex <= 0) return false;

    set({ currentStepIndex: currentStepIndex - 1 });
    return true;
  },

  skipFlow: () => {
    const { currentFlow, skippedFlows } = get();
    
    if (!currentFlow) return;

    // Add to skipped flows
    skippedFlows.add(currentFlow.id);
    
    set({
      isActive: false,
      currentFlow: null,
      currentStepIndex: 0,
      skippedFlows: new Set(skippedFlows),
      isLoading: false, // Ensure loading state is cleared
    });
  },

  completeFlow: () => {
    const { currentFlow, completedFlows } = get();
    
    if (!currentFlow) return;

    // Add to completed flows
    completedFlows.add(currentFlow.id);
    
    set({
      isActive: false,
      currentFlow: null,
      currentStepIndex: 0,
      completedFlows: new Set(completedFlows),
    });
  },

  markFlowCompleted: (flowId) => {
    const { completedFlows } = get();
    completedFlows.add(flowId);
    set({ completedFlows: new Set(completedFlows) });
  },

  // Preferences
  updatePreferences: (newPreferences) => {
    set((state) => ({
      userPreferences: { ...state.userPreferences, ...newPreferences },
    }));
  },

  // Persistence
  loadProgress: async () => {
    try {
      const [completedFlowsData, skippedFlowsData, preferencesData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.COMPLETED_FLOWS),
        AsyncStorage.getItem(STORAGE_KEYS.SKIPPED_FLOWS),
        AsyncStorage.getItem(STORAGE_KEYS.PREFERENCES),
      ]);

      const completedFlows = completedFlowsData
        ? new Set<string>(JSON.parse(completedFlowsData))
        : new Set<string>();

      const skippedFlows = skippedFlowsData
        ? new Set<string>(JSON.parse(skippedFlowsData))
        : new Set<string>();

      const preferences = preferencesData
        ? { ...DEFAULT_PREFERENCES, ...JSON.parse(preferencesData) }
        : DEFAULT_PREFERENCES;

      set({
        completedFlows,
        skippedFlows,
        userPreferences: preferences,
      });
    } catch (error) {
      console.error('[WALKTHROUGH] Failed to load progress:', error);
    }
  },

  saveProgress: async () => {
    try {
      const { completedFlows, skippedFlows, userPreferences } = get();

      await Promise.all([
        AsyncStorage.setItem(
          STORAGE_KEYS.COMPLETED_FLOWS,
          JSON.stringify(Array.from(completedFlows))
        ),
        AsyncStorage.setItem(
          STORAGE_KEYS.SKIPPED_FLOWS,
          JSON.stringify(Array.from(skippedFlows))
        ),
        AsyncStorage.setItem(
          STORAGE_KEYS.PREFERENCES,
          JSON.stringify(userPreferences)
        ),
      ]);
    } catch (error) {
      console.error('[WALKTHROUGH] Failed to save progress:', error);
    }
  },

  // Reset
  reset: () => {
    set({
      isActive: false,
      currentFlow: null,
      currentStepIndex: 0,
      isLoading: false,
      completedFlows: new Set(),
      skippedFlows: new Set(),
      userPreferences: DEFAULT_PREFERENCES,
      elementRefs: new Map(),
    });
  },
}));