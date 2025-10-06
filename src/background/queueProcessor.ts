import { useUploadQueueStore, FaceProcessingResult } from '../stores/uploadQueueStore';

interface UploadPhotoMutation {
  mutate: (variables: any, options?: any) => void;
}

interface SharePhotoMutation {
  mutate: (variables: any, options?: any) => void;
}

interface ShareEventPhotoMutation {
  mutate: (variables: any, options?: any) => void;
}

class QueueProcessor {
  private processingTimeout: ReturnType<typeof setTimeout> | null = null;
  private isRunning = false;
  private uploadPhoto: UploadPhotoMutation | null = null;
  private shareFaceMatchedPhotoMutation: SharePhotoMutation | null = null;
  private shareEventMatchedPhotoMutation: ShareEventPhotoMutation | null = null;
  private storeUnsubscribe: (() => void) | null = null;

  initialize(
    uploadPhoto: UploadPhotoMutation, 
    shareFaceMatchedPhotoMutation: SharePhotoMutation,
    shareEventMatchedPhotoMutation: ShareEventPhotoMutation
  ) {
    this.uploadPhoto = uploadPhoto;
    this.shareFaceMatchedPhotoMutation = shareFaceMatchedPhotoMutation;
    this.shareEventMatchedPhotoMutation = shareEventMatchedPhotoMutation;
    
    this.storeUnsubscribe = useUploadQueueStore.subscribe(
      (state, prevState) => {
        const newItems = state.queue.filter(item => 
          item.status === 'pending' && 
          !prevState.queue.some(prev => prev.id === item.id)
        );
        
        if (newItems.length > 0 && !this.isRunning && this.uploadPhoto) {
          this.start();
        }
      }
    );
  }

  async start() {
    if (this.isRunning || !this.uploadPhoto) {
      return;
    }
    
    this.isRunning = true;
    useUploadQueueStore.getState().startProcessing();
    await this.processNext();
  }

  stop() {
    this.isRunning = false;
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
      this.processingTimeout = null;
    }
    useUploadQueueStore.getState().stopProcessing();
  }

  destroy() {
    this.stop();
    if (this.storeUnsubscribe) {
      this.storeUnsubscribe();
      this.storeUnsubscribe = null;
    }
  }

  private async processNext() {
    if (!this.isRunning || !this.uploadPhoto) return;

    const store = useUploadQueueStore.getState();
    
    const modalPendingItem = store.queue.find(item => 
      item.isModalUpload && (item.status === 'pending' || item.status === 'retrying')
    );
    
    const pendingItem = modalPendingItem || store.queue.find(item => 
      item.status === 'pending' || item.status === 'retrying'
    );

    if (!pendingItem) {
      store._setProcessing(false);
      this.isRunning = false;
      return;
    }

    store.updateItemStatus(pendingItem.id, 'processing');

    try {
      const uploadResult = await new Promise<any>((resolve, reject) => {
        this.uploadPhoto!.mutate(
          {
            photoUri: pendingItem.photoUri,
            selectedCam: pendingItem.selectedCam,
            isBackgroundUpload: true,
          },
          {
            onSuccess: (data: any) => resolve(data),
            onError: (error: any) => reject(error),
          }
        );
      });

      // Handle auto-share based on photo type
      if (uploadResult?.faceProcessingResult?.matches?.length > 0) {
        try {
          if (pendingItem.selectedCam) {
            // Shared camera photo with faces detected - always auto-share (implicit consent)
            await new Promise<void>((resolve, reject) => {
              this.shareEventMatchedPhotoMutation!.mutate(
                {
                  photoId: uploadResult.photo.id,
                  selectedTargets: uploadResult.faceProcessingResult.matches.map((m: any) => m.userId),
                  matches: uploadResult.faceProcessingResult.matches,
                  isBackgroundShare: true,
                  sharedCameraId: pendingItem.selectedCam,
                },
                {
                  onSuccess: () => resolve(),
                  onError: (error: any) => reject(error),
                }
              );
            });
          } else if (pendingItem.shouldAutoShare) {
            // Face-match photo - only auto-share if user has enabled the setting
            await new Promise<void>((resolve, reject) => {
              this.shareFaceMatchedPhotoMutation!.mutate(
                {
                  photoId: uploadResult.photo.id,
                  selectedTargets: uploadResult.faceProcessingResult.matches.map((m: any) => m.userId),
                  matches: uploadResult.faceProcessingResult.matches,
                  isBackgroundShare: true,
                },
                {
                  onSuccess: () => resolve(),
                  onError: (error: any) => reject(error),
                }
              );
            });
          }
        } catch (shareError) {
          console.error('Auto-share failed:', shareError);
        }
      }

      if (pendingItem.isModalUpload) {
        const faceResult: FaceProcessingResult = {
          photoId: uploadResult.photo.id,
          s3Key: `protected/${uploadResult.photo.ownerIdentityId}/${uploadResult.photo.s3Key}`,
          ownerIdentityId: uploadResult.photo.ownerIdentityId,
          facesDetected: uploadResult.faceProcessingResult?.facesDetected || 0,
          friendsMatched: uploadResult.faceProcessingResult?.friendsMatched || 0,
          matches: uploadResult.faceProcessingResult?.matches || [],
          processingFailed: !uploadResult.faceProcessingResult
        };
        
        store.updateItemWithResults(pendingItem.id, faceResult);
        
        setTimeout(() => {
          store.updateItemStatus(pendingItem.id, 'completed');
        }, 200);
      } else {
        // Store results for background uploads too (for photo preview)
        const faceResult: FaceProcessingResult = {
          photoId: uploadResult.photo.id,
          s3Key: `protected/${uploadResult.photo.ownerIdentityId}/${uploadResult.photo.s3Key}`,
          ownerIdentityId: uploadResult.photo.ownerIdentityId,
          facesDetected: uploadResult.faceProcessingResult?.facesDetected || 0,
          friendsMatched: uploadResult.faceProcessingResult?.friendsMatched || 0,
          matches: uploadResult.faceProcessingResult?.matches || [],
          processingFailed: !uploadResult.faceProcessingResult
        };
        
        store.updateItemWithResults(pendingItem.id, faceResult);
        store.updateItemStatus(pendingItem.id, 'completed');
      }

    } catch (error: any) {
      if (pendingItem.retryCount < 3) {
        store.updateItemStatus(pendingItem.id, 'retrying', error.message);
      } else {
        store.updateItemStatus(pendingItem.id, 'failed', error.message);
        
        if (pendingItem.isModalUpload) {
          const errorResult: FaceProcessingResult = {
            photoId: 'failed',
            s3Key: '',
            ownerIdentityId: '',
            facesDetected: 0,
            friendsMatched: 0,
            matches: [],
            processingFailed: true,
          };
          store.updateItemWithResults(pendingItem.id, errorResult);
        }
      }
    }

    const delay = pendingItem.isModalUpload ? 200 : 1000;
    this.processingTimeout = setTimeout(() => {
      this.processNext();
    }, delay);
  }
}

export const queueProcessor = new QueueProcessor();