import { WalkthroughFlow } from '@/src/stores/walkthroughStore';

// Comprehensive main flow - covers all essential features in logical order
export const mainOnboardingFlow: WalkthroughFlow = {
  id: 'main-onboarding',
  name: 'Complete PhomoCam Tour',
  description: 'Learn everything about capturing and sharing moments with automatic face recognition',
  steps: [
    // ========== INTRODUCTION ==========
    {
      id: 'welcome',
      flowId: 'main-onboarding',
      order: 0,
      title: 'Welcome to PhomoCam! 📸',
      content: 'PhomoCam uses face recognition to automatically share photos with the right people. Let me show you everything!',
      targetScreen: '(tabs)/camera',
      tooltipConfig: {
        position: 'center',
        showSkip: true,
        showNext: true,
        showPrevious: false,
      },
    },

    // ========== CAMERA BASICS ==========
    {
      id: 'camera-screen',
      flowId: 'main-onboarding',
      order: 1,
      title: 'This is Your Camera',
      content: 'You\'ll spend most of your time here. Let\'s explore all the features step by step.',
      targetScreen: '(tabs)/camera',
      tooltipConfig: {
        position: 'center',
        showSkip: true,
        showNext: true,
        showPrevious: true,
      },
    },
    {
      id: 'take-photo',
      flowId: 'main-onboarding',
      order: 2,
      title: 'Taking Photos',
      content: 'Tap this button to capture a photo. Photos are automatically uploaded and processed.',
      targetScreen: '(tabs)/camera',
      targetElement: 'camera-capture-button',
      highlightConfig: {
        type: 'circle',
        padding: 12,
        animated: true,
      },
      tooltipConfig: {
        position: 'top',
        showSkip: true,
        showNext: true,
        showPrevious: true,
      },
    },
    // ========== FACE RECOGNITION MAGIC ==========
    {
      id: 'face-recognition-intro',
      flowId: 'main-onboarding',
      order: 3,
      title: 'The Magic Happens Here ✨',
      content: 'When you take a photo, PhomoCam automatically detects faces and identifies who\'s in it using secure face recognition.',
      targetScreen: '(tabs)/camera',
      tooltipConfig: {
        position: 'center',
        showSkip: true,
        showNext: true,
        showPrevious: true,
      },
    },
    {
      id: 'auto-sharing',
      flowId: 'main-onboarding',
      order: 4,
      title: 'Automatic Sharing',
      content: 'Photos are automatically shared with friends who appear in them! This event selector shows which group you\'re sharing with.',
      targetScreen: '(tabs)/camera',
      targetElement: 'camera-selector',
      highlightConfig: {
        type: 'rounded',
        padding: 8,
        animated: true,
      },
      tooltipConfig: {
        position: 'bottom',
        showSkip: true,
        showNext: true,
        showPrevious: true,
      },
    },

    // ========== SHARED CAMERAS ==========
    {
      id: 'camera-list',
      flowId: 'main-onboarding',
      order: 5,
      title: 'Manage Your Events',
      content: 'Tap here to see all your events, create new ones, or join events your friends invite you to.',
      targetScreen: '(tabs)/camera',
      targetElement: 'camera-list-button',
      highlightConfig: {
        type: 'circle',
        padding: 8,
        animated: true,
      },
      tooltipConfig: {
        position: 'left',
        showSkip: true,
        showNext: true,
        showPrevious: true,
      },
      navigationAction: {
        type: 'navigate',
        target: '/cameraModal',
        waitForLoad: true,
      },
    },

    {
      id: 'create-events-invite',
      flowId: 'main-onboarding',
      order: 6,
      title: 'Create Events & Invite People',
      content: 'Here you can create shared events and invite people to join them.',
      targetScreen: '/cameraModal',
      tooltipConfig: {
        position: 'center',
        showSkip: true,
        showNext: true,
        showPrevious: true,
      },
    },

    // ========== ALBUM TAB ==========
    {
      id: 'navigate-to-album',
      flowId: 'main-onboarding',
      order: 7,
      title: 'Your Photo Album',
      content: 'Let\'s check out your Album. This is where all your photos live!',
      targetScreen: '/cameraModal',
      tooltipConfig: {
        position: 'center',
        showSkip: true,
        showNext: true,
        showPrevious: true,
      },
      navigationAction: {
        type: 'navigate',
        target: '(tabs)/album',
        waitForLoad: true,
      },
    },
    {
      id: 'album-explanation',
      flowId: 'main-onboarding',
      order: 8,
      title: 'All Your Photos in One Place',
      content: 'Every photo you\'re in appears here automatically - whether you took it or your friends did!',
      targetScreen: '(tabs)/album',
      tooltipConfig: {
        position: 'center',
        showSkip: true,
        showNext: true,
        showPrevious: true,
      },
    },

    // ========== FRIENDS ==========
    {
      id: 'adding-friends',
      flowId: 'main-onboarding',
      order: 9,
      title: 'Adding Friends',
      content: 'Tap here to add friends and manage friend requests. They\'ll only see photos they\'re in!',
      targetScreen: '(tabs)/album',
      targetElement: 'friends-button',
      highlightConfig: {
        type: 'circle',
        padding: 8,
        animated: true,
      },
      tooltipConfig: {
        position: 'left',
        showSkip: true,
        showNext: true,
        showPrevious: true,
      },
      navigationAction: {
        type: 'navigate',
        target: '/friendsModal',
        waitForLoad: true,
      },
    },
    {
      id: 'friends-button',
      flowId: 'main-onboarding',
      order: 10,
      title: 'Your Friends',
      content: 'This is where you can see all your friends and manage friend requests.',
      targetScreen: '/friendsModal',
      tooltipConfig: {
        position: 'center',
        showSkip: true,
        showNext: true,
        showPrevious: true,
      },
      navigationAction: {
        type: 'navigate',
        target: '(tabs)/album',
        waitForLoad: true,
      },
    },

    // ========== PROFILE TAB ==========
    {
      id: 'navigate-to-profile',
      flowId: 'main-onboarding',
      order: 11,
      title: 'Your Profile',
      content: 'Let\'s check out your profile and settings.',
      targetScreen: '/friendsModal',
      targetElement: 'tab-me',
      highlightConfig: {
        type: 'rounded',
        padding: 8,
        animated: true,
      },
      tooltipConfig: {
        position: 'top',
        showSkip: true,
        showNext: true,
        showPrevious: true,
      },
      navigationAction: {
        type: 'navigate',
        target: '(tabs)/me',
        waitForLoad: true,
      },
    },
    {
      id: 'profile-photo',
      flowId: 'main-onboarding',
      order: 12,
      title: 'Your Profile Photo',
      content: 'This is how friends will recognize you. Tap to change your profile picture anytime.',
      targetScreen: '(tabs)/me',
      targetElement: 'profile-photo',
      highlightConfig: {
        type: 'circle',
        padding: 8,
        animated: true,
      },
      tooltipConfig: {
        position: 'bottom',
        showSkip: true,
        showNext: true,
        showPrevious: true,
      },
    },
    {
      id: 'icloud-sync',
      flowId: 'main-onboarding',
      order: 13,
      title: 'Sync Your iCloud Photos',
      content: 'This button lets you sync photos from your iCloud Photos to share with friends. You\'re always in control - you choose exactly what to select and share with the app.',
      targetScreen: '(tabs)/me',
      targetElement: 'sync-button',
      highlightConfig: {
        type: 'rounded',
        padding: 8,
        animated: true,
      },
      tooltipConfig: {
        position: 'bottom',
        showSkip: true,
        showNext: true,
        showPrevious: true,
      },
    },
    {
      id: 'settings',
      flowId: 'main-onboarding',
      order: 14,
      title: 'Settings & Privacy',
      content: 'Access all settings here including notifications, privacy controls, and account management.',
      targetScreen: '(tabs)/me',
      targetElement: 'settings-button',
      highlightConfig: {
        type: 'circle',
        padding: 8,
        animated: true,
      },
      tooltipConfig: {
        position: 'left',
        showSkip: true,
        showNext: true,
        showPrevious: true,
      },
      navigationAction: {
        type: 'navigate',
        target: '/settingsModal',
        waitForLoad: true,
      },
    },
    {
      id: 'settings-modal-content',
      flowId: 'main-onboarding',
      order: 15,
      title: 'Settings & Privacy',
      content: 'Here you can manage notifications, privacy controls, and account settings.',
      targetScreen: '/settingsModal',
      tooltipConfig: {
        position: 'center',
        showSkip: true,
        showNext: true,
        showPrevious: true,
      },
    },

    // ========== KEY CONCEPTS SUMMARY ==========
    {
      id: 'privacy-reminder',
      flowId: 'main-onboarding',
      order: 16,
      title: 'Your Privacy is Protected 🔒',
      content: 'Remember: Your face data is encrypted and never shared. Photos are only visible to people who are in them.',
      targetScreen: '/settingsModal',
      tooltipConfig: {
        position: 'center',
        showSkip: true,
        showNext: true,
        showPrevious: true,
      },
    },
    {
      id: 'workflow-summary',
      flowId: 'main-onboarding',
      order: 17,
      title: 'How PhomoCam Works',
      content: '1. Take photos\n2. Faces are detected automatically\n3. Photos shared with people in them\n4. Everyone gets their memories!',
      targetScreen: '(tabs)/camera',
      tooltipConfig: {
        position: 'center',
        showSkip: true,
        showNext: true,
        showPrevious: true,
      },
      navigationAction: {
        type: 'navigate',
        target: '(tabs)/camera',
        waitForLoad: true,
      },
    },
    {
      id: 'complete',
      flowId: 'main-onboarding',
      order: 18,
      title: 'You\'re Ready! 🎉',
      content: 'Start capturing moments! Remember to invite friends to your events so they can share photos too.',
      targetScreen: '(tabs)/camera',
      tooltipConfig: {
        position: 'center',
        showSkip: false,
        showNext: true,
        showPrevious: true,
      },
    },
  ],
  triggerConditions: [
    {
      afterOnboarding: true,
      onFirstLaunch: true,
    },
  ],
  completionTracking: true,
};

// Quick help flows for specific features (optional, triggered on demand)
export const quickHelpFlows: Record<string, WalkthroughFlow> = {
  // How to create a camera
  createCamera: {
    id: 'quick-create-camera',
    name: 'Create a Event',
    description: 'Quick guide to creating a shared event',
    steps: [
      {
        id: 'open-camera-list',
        flowId: 'quick-create-camera',
        order: 0,
        title: 'Open Event List',
        content: 'Tap the event list button to see all your events.',
        targetScreen: '(tabs)/camera',
        targetElement: 'camera-list-button',
        highlightConfig: {
          type: 'circle',
          padding: 8,
          animated: true,
        },
        tooltipConfig: {
          position: 'left',
          showSkip: true,
          showNext: true,
          showPrevious: false,
        },
      },
      {
        id: 'tap-create',
        flowId: 'quick-create-camera',
        order: 1,
        title: 'Create New Event',
        content: 'Tap "Create Event" to start setting up a new shared space.',
        targetScreen: '/cameraModal',
        targetElement: 'create-camera-button',
        highlightConfig: {
          type: 'rounded',
          padding: 8,
          animated: true,
        },
        tooltipConfig: {
          position: 'bottom',
          showSkip: true,
          showNext: true,
          showPrevious: true,
        },
      },
      {
        id: 'name-and-invite',
        flowId: 'quick-create-camera',
        order: 2,
        title: 'Name and Invite',
        content: 'Give your event a name and invite friends. They\'ll get a notification!',
        targetScreen: '/camera/new',
        tooltipConfig: {
          position: 'center',
          showSkip: false,
          showNext: false,
          showPrevious: true,
        },
      },
    ],
    triggerConditions: [],
    completionTracking: true,
  },

  // How face matching works
  faceMatching: {
    id: 'quick-face-matching',
    name: 'How Face Matching Works',
    description: 'Understanding automatic photo sharing',
    steps: [
      {
        id: 'face-detection',
        flowId: 'quick-face-matching',
        order: 0,
        title: 'Face Detection',
        content: 'When you take a photo, PhomoCam detects all faces in it.',
        targetScreen: '(tabs)/camera',
        tooltipConfig: {
          position: 'center',
          showSkip: true,
          showNext: true,
          showPrevious: false,
        },
      },
      {
        id: 'face-matching',
        flowId: 'quick-face-matching',
        order: 1,
        title: 'Secure Matching',
        content: 'Faces are matched against registered friends using encrypted data.',
        targetScreen: '(tabs)/camera',
        tooltipConfig: {
          position: 'center',
          showSkip: true,
          showNext: true,
          showPrevious: true,
        },
      },
      {
        id: 'auto-share',
        flowId: 'quick-face-matching',
        order: 2,
        title: 'Automatic Sharing',
        content: 'Photos appear in the albums of everyone who\'s in them - automatically!',
        targetScreen: '(tabs)/camera',
        tooltipConfig: {
          position: 'center',
          showSkip: false,
          showNext: false,
          showPrevious: true,
        },
      },
    ],
    triggerConditions: [],
    completionTracking: true,
  },
};

// Export all flows
export const walkthroughFlows = {
  mainOnboarding: mainOnboardingFlow,
  ...quickHelpFlows,
};

// Helper functions
export const getFlowById = (flowId: string): WalkthroughFlow | null => {
  return Object.values(walkthroughFlows).find(flow => flow.id === flowId) || null;
};

export const shouldTriggerMainFlow = (
  context: {
    isFirstLaunch?: boolean;
    afterOnboarding?: boolean;
    completedFlows: Set<string>;
  }
): boolean => {
  // Don't show if already completed
  if (context.completedFlows.has('main-onboarding')) {
    return false;
  }

  // Show after initial onboarding or on first launch
  return !!(context.afterOnboarding || context.isFirstLaunch);
};