import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { usePreferencesStore } from './preferencesStore';

export interface FaceProcessingResult {
  photoId: string;
  s3Key: string;
  ownerIdentityId: string;
  facesDetected: number;
  friendsMatched: number;
  matches: Array<{ userId: string; confidence: number }>;
  processingFailed?: boolean;
}

export interface QueueItem {
  id: string;
  photoUri: string;
  selectedCam: string | null;
  timestamp: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
  retryCount: number;
  lastError?: string;
  shouldAutoShare: boolean;
  isModalUpload: boolean;
  faceProcessingResult?: FaceProcessingResult;
  metadata?: {
    facesDetected?: number;
    friendsMatched?: number;
    fileSize?: number;
  };
}

interface UploadQueueState {
  queue: QueueItem[];
  isProcessing: boolean;
  appState: AppStateStatus;
  
  // Callbacks
  onModalItemCompleted?: (item: QueueItem) => void;
  
  // Actions
  addToQueue: (photoUri: string, selectedCam: string | null, options?: { isModalUpload?: boolean }) => string | null;
  updateItemStatus: (id: string, status: QueueItem['status'], error?: string) => void;
  updateItemWithResults: (id: string, faceProcessingResult: FaceProcessingResult) => void;
  removeItem: (id: string) => void;
  clearCompleted: () => void;
  retryFailed: () => void;
  startProcessing: () => void;
  stopProcessing: () => void;
  handleAppStateChange: (nextAppState: AppStateStatus) => void;
  getModalItems: () => QueueItem[];
  getActiveModalItem: () => QueueItem | undefined;
  getCompletedModalItem: () => QueueItem | undefined;
  cleanupModalItem: (id: string) => void;
  setModalCompletedCallback: (callback: (item: QueueItem) => void) => void;
  
  // Getters
  getStats: () => {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
  };
  
  getActiveStats: () => {
    active: number;
    completed: number;
    failed: number;
    total: number;
    canAddMore: boolean;
  };
  
  // Internal
  _setProcessing: (processing: boolean) => void;
}

export const useUploadQueueStore = create<UploadQueueState>()(
  persist(
    (set, get) => ({
      queue: [],
      isProcessing: false,
      appState: AppState.currentState,

      addToQueue: (photoUri: string, selectedCam: string | null, options?: { isModalUpload?: boolean }) => {
        const state = get();
        
        const activeItems = state.queue.filter(item => 
          ['pending', 'processing', 'retrying'].includes(item.status)
        );
        
        if (activeItems.length >= 10) {
          console.warn('Queue is full (10 active uploads), skipping new upload');
          return null;
        }

        if (options?.isModalUpload) {
          const existingModalItems = state.queue.filter(item => 
            item.isModalUpload && 
            ['pending', 'processing', 'retrying'].includes(item.status)
          );
          
          if (existingModalItems.length > 0) {
            console.warn(`Modal upload blocked - ${existingModalItems.length} active modal uploads exist`);
            return null;
          }

          const recentModalItems = state.queue.filter(item => 
            item.isModalUpload && 
            Date.now() - item.timestamp < 5000
          );
          
          if (recentModalItems.length > 0) {
            console.warn('Modal upload blocked - recent modal upload within 5 seconds');
            return null;
          }
        }

        const recentDuplicate = state.queue.find(item => 
          item.photoUri === photoUri && 
          Date.now() - item.timestamp < 2000 && 
          ['pending', 'processing', 'retrying'].includes(item.status)
        );
        
        if (recentDuplicate) {
          console.warn('Ignoring duplicate upload');
          return recentDuplicate.id;
        }

        const { autoShareFaces } = usePreferencesStore.getState();

        const queueItem: QueueItem = {
          id: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          photoUri,
          selectedCam,
          timestamp: Date.now(),
          status: 'pending',
          retryCount: 0,
          shouldAutoShare: autoShareFaces,
          isModalUpload: options?.isModalUpload || false,
        };

        set(state => ({
          queue: [...state.queue, queueItem]
        }));

        return queueItem.id;
      },

      updateItemStatus: (id: string, status: QueueItem['status'], error?: string) => {
        set(state => ({
          queue: state.queue.map(item =>
            item.id === id
              ? { 
                  ...item, 
                  status, 
                  lastError: error,
                  retryCount: status === 'failed' ? item.retryCount + 1 : item.retryCount
                }
              : item
          )
        }));
        
        if (status === 'completed') {
          const item = get().queue.find(q => q.id === id);
          if (item && !item.isModalUpload) {
            setTimeout(() => {
              get().clearCompleted();
            }, 5000);
          } else if (item && item.isModalUpload && item.faceProcessingResult) {
            // For modal items that complete with existing results, trigger callback
            const state = get();
            if (state.onModalItemCompleted) {
              console.log('🎭 Triggering modal completion callback on status update:', item.id);
              state.onModalItemCompleted(item);
            }
          }
        }
      },

      updateItemWithResults: (id: string, faceProcessingResult: FaceProcessingResult) => {
        set(state => ({
          queue: state.queue.map(item =>
            item.id === id
              ? { ...item, faceProcessingResult }
              : item
          )
        }));
        
        // Trigger callback for modal items when they get results
        const state = get();
        const item = state.queue.find(q => q.id === id);
        if (item && item.isModalUpload && state.onModalItemCompleted) {
          console.log('🎭 Triggering modal completion callback for:', item.id);
          state.onModalItemCompleted(item);
        }
      },

      removeItem: (id: string) => {
        set(state => ({
          queue: state.queue.filter(item => item.id !== id)
        }));
      },

      clearCompleted: () => {
        const now = Date.now();
        const modalCutoff = now - 60000;
        const backgroundCutoff = now - 10000;
        
        set(state => {
          const newQueue = state.queue.filter(item => {
            if (item.isModalUpload && item.status === 'completed') {
              return item.timestamp > modalCutoff;
            }
            if (item.status !== 'completed') {
              return true;
            }
            return item.timestamp > backgroundCutoff;
          });
          
          return { queue: newQueue };
        });
      },

      retryFailed: () => {
        set(state => ({
          queue: state.queue.map(item =>
            item.status === 'failed' && item.retryCount < 3
              ? { ...item, status: 'pending', lastError: undefined }
              : item
          )
        }));
      },

      startProcessing: () => {
        set({ isProcessing: true });
      },

      stopProcessing: () => {
        set({ isProcessing: false });
      },

      handleAppStateChange: (nextAppState: AppStateStatus) => {
        const prevState = get().appState;
        set({ appState: nextAppState });

        if (nextAppState === 'active' && prevState !== 'active') {
          get().clearCompleted();
        }
      },

      getModalItems: () => {
        const queue = get().queue;
        return queue.filter(item => item.isModalUpload);
      },

      getActiveModalItem: () => {
        const queue = get().queue;
        const now = Date.now();
        
        const modalItems = queue.filter(item => item.isModalUpload);
        
        const activeModalItems = modalItems.filter(item => 
          ['pending', 'processing'].includes(item.status)
        );
        
        const stuckModalItems = activeModalItems.filter(item => 
          now - item.timestamp > 120000
        );
        
        if (stuckModalItems.length > 0) {
          console.warn('Cleaning up stuck modal items');
          stuckModalItems.forEach(item => {
            get().updateItemStatus(item.id, 'failed', 'Timeout - stuck in queue');
          });
          
          const refreshedQueue = get().queue;
          const refreshedActiveItems = refreshedQueue.filter(item => 
            item.isModalUpload && ['pending', 'processing'].includes(item.status)
          );
          
          if (refreshedActiveItems.length > 1) {
            const sortedItems = refreshedActiveItems.sort((a, b) => b.timestamp - a.timestamp);
            sortedItems.slice(1).forEach(item => {
              get().updateItemStatus(item.id, 'failed', 'Duplicate modal upload');
            });
            return sortedItems[0];
          }
          
          return refreshedActiveItems[0];
        }
        
        if (activeModalItems.length > 1) {
          console.warn('Multiple active modal items found');
          const sortedItems = activeModalItems.sort((a, b) => b.timestamp - a.timestamp);
          sortedItems.slice(1).forEach(item => {
            get().updateItemStatus(item.id, 'failed', 'Duplicate modal upload');
          });
          return sortedItems[0];
        }
        
        return activeModalItems[0];
      },

      getCompletedModalItem: () => {
        const queue = get().queue;
        return queue
          .filter(item => 
            item.isModalUpload && 
            item.status === 'completed' && 
            item.faceProcessingResult
          )
          .sort((a, b) => b.timestamp - a.timestamp)[0];
      },

      cleanupModalItem: (id: string) => {
        set(state => ({
          queue: state.queue.filter(item => item.id !== id)
        }));
      },

      getStats: () => {
        const queue = get().queue;
        return {
          pending: queue.filter(item => item.status === 'pending').length,
          processing: queue.filter(item => item.status === 'processing').length,
          completed: queue.filter(item => item.status === 'completed').length,
          failed: queue.filter(item => item.status === 'failed').length,
          total: queue.length,
        };
      },

      getActiveStats: () => {
        const queue = get().queue;
        const active = queue.filter(item => ['pending', 'processing', 'retrying'].includes(item.status));
        const completed = queue.filter(item => item.status === 'completed');
        const failed = queue.filter(item => item.status === 'failed');
        
        return {
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          total: queue.length,
          canAddMore: active.length < 10
        };
      },

      _setProcessing: (processing: boolean) => {
        set({ isProcessing: processing });
      },
      
      setModalCompletedCallback: (callback: (item: QueueItem) => void) => {
        set({ onModalItemCompleted: callback });
      },
    }),
    {
      name: 'upload-queue-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ 
        queue: state.queue.map(item => ({
          ...item,
          status: item.status === 'processing' ? 'pending' : item.status
        }))
      }),
    }
  )
);

export const useUploadQueue = () => {
  const store = useUploadQueueStore();
  
  return {
    addToQueue: store.addToQueue,
    stats: store.getStats(),
    activeStats: store.getActiveStats(),
    isProcessing: store.isProcessing,
    queue: store.queue,
    retryFailed: store.retryFailed,
    clearCompleted: store.clearCompleted,
    updateItemWithResults: store.updateItemWithResults,
    removeItem: store.removeItem,
    getModalItems: store.getModalItems,
    getActiveModalItem: store.getActiveModalItem,
    getCompletedModalItem: store.getCompletedModalItem,
    cleanupModalItem: store.cleanupModalItem,
    setModalCompletedCallback: store.setModalCompletedCallback,
  };
};