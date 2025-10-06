import { useEffect, useRef, useMemo } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { generateClient } from 'aws-amplify/api';
import { getCurrentUser } from 'aws-amplify/auth';

const client = generateClient();
let activeSubscriptionCount = 0;

// Global subscription tracking to prevent duplicates
const activeSubscriptions = new Map<string, { 
  count: number; 
  subscription: any;
  handlers: Set<(data: any) => void>;
}>();

export type SubscriptionHandler<T = any> = {
  onReceived?: (data: T) => void;
  onError?: (error: any) => void;
  enabled?: boolean;
};

export function useSubscription<T = any>(
  subscription: string,
  variables: Record<string, any> = {},
  handler: SubscriptionHandler<T> = {}
) {
  const queryClient = useQueryClient();
  const subscriptionRef = useRef<any>(null);
  const { onReceived, onError, enabled = true } = handler;
  
  // Create stable subscription key for deduplication
  const subscriptionKey = useMemo(() => {
    const queryName = subscription.match(/subscription\s+(\w+)/)?.[1] || 'unknown';
    return `${queryName}:${JSON.stringify(variables)}`;
  }, [subscription, JSON.stringify(variables)]);

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;
    let appStateSubscription: any;
    let handlerCleanup: (() => void) | null = null;

    const cleanupSubscription = () => {
      if (handlerCleanup) {
        handlerCleanup();
        handlerCleanup = null;
      }
      
      // Decrement the reference count for this subscription
      const existing = activeSubscriptions.get(subscriptionKey);
      if (existing) {
        existing.count--;
        console.log(`📉 [SUBSCRIPTION] Decrementing ref count for ${subscriptionKey.split(':')[0]} (count: ${existing.count})`);
        
        if (existing.count <= 0) {
          // Last reference, actually unsubscribe
          if (existing.subscription?.unsubscribe) {
            existing.subscription.unsubscribe();
            activeSubscriptionCount = Math.max(0, activeSubscriptionCount - 1);
            console.log(`✅ [SUBSCRIPTION] 🧹 Fully unsubscribed from ${subscriptionKey.split(':')[0]} (Total active: ${activeSubscriptionCount})`);
          }
          activeSubscriptions.delete(subscriptionKey);
        }
      }
    };

    const startSubscription = async () => {
      try {
        // Create handler for this hook instance
        const myHandler = (data: any) => {
          if (!isMounted) return;
          onReceived?.(data);
        };
        
        // Check if subscription already exists
        const existing = activeSubscriptions.get(subscriptionKey);
        
        if (existing && existing.subscription) {
          // Subscription already exists, just add our handler and increment reference count
          existing.count++;
          existing.handlers.add(myHandler);
          console.log(`♻️ [SUBSCRIPTION] Reusing existing subscription for ${subscriptionKey.split(':')[0]} (ref count: ${existing.count})`);
          
          // Set up cleanup function to remove our handler
          handlerCleanup = () => {
            existing.handlers.delete(myHandler);
          };
          
          subscriptionRef.current = existing.subscription;
          return;
        }

        // Create new subscription
        activeSubscriptionCount++;
        console.log(`📊 [SUBSCRIPTION] 🚀 Creating new subscription for ${subscriptionKey.split(':')[0]} (Total active: ${activeSubscriptionCount})`);

        const observable = await client.graphql({
          query: subscription,
          variables,
          authMode: 'userPool',
        });

        const handlers = new Set<(data: any) => void>();
        handlers.add(myHandler);

        const subscriptionInstance = (observable as any).subscribe({
          next: (data: any) => {
            // Call all registered handlers
            handlers.forEach(handler => {
              try {
                handler(data);
              } catch (e) {
                console.error(`❌ [SUBSCRIPTION] Handler error:`, e);
              }
            });
          },
          error: (error: any) => {
            onError?.(error);

            if (error?.errors?.[0]?.message?.includes('MaxSubscriptionsReachedError')) {
              console.error(`❌ [SUBSCRIPTION] Max subscriptions reached! Current count: ${activeSubscriptionCount}`);
              return;
            }

            if (AppState.currentState === 'active') {
              setTimeout(() => {
                if (isMounted && enabled && AppState.currentState === 'active') {
                  startSubscription();
                }
              }, 5000);
            }
          },
        });

        // Store in global map
        activeSubscriptions.set(subscriptionKey, {
          count: 1,
          subscription: subscriptionInstance,
          handlers: handlers
        });
        
        subscriptionRef.current = subscriptionInstance;
        
        // Set up cleanup for this specific handler
        handlerCleanup = () => {
          handlers.delete(myHandler);
        };
      } catch (err) {
        activeSubscriptionCount = Math.max(0, activeSubscriptionCount - 1);
        console.error(`❌ [SUBSCRIPTION] Failed to create subscription for ${subscriptionKey.split(':')[0]}:`, err);
        onError?.(err);
      }
    };

    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Don't cleanup on background, just pause
        console.log(`⏸️ [SUBSCRIPTION] App going to background, keeping subscriptions`);
      } else if (nextAppState === 'active' && isMounted && enabled) {
        // Refresh data when coming back
        setTimeout(() => onReceived?.({ type: 'RECONNECTION_REFRESH' } as T), 1000);
      }
    };

    startSubscription();
    appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      isMounted = false;
      cleanupSubscription();
      appStateSubscription?.remove?.();
    };
  }, [subscriptionKey, enabled]);

  return { isConnected: !!subscriptionRef.current };
}

export function useSubscriptionInvalidation() {
  const queryClient = useQueryClient();
  return {
    invalidateQueries: (queryKey: any[]) => queryClient.invalidateQueries({ queryKey, refetchType: 'active' }),
    invalidateAll: () => queryClient.invalidateQueries(),
  };
}

export async function getCurrentUserId(): Promise<string> {
  try {
    const { username } = await getCurrentUser();
    return username;
  } catch (err) {
    console.error('❌ [SUBSCRIPTION] Failed to get current user:', err);
    throw err;
  }
}

// Global cleanup function for all subscriptions
export function cleanupAllSubscriptions() {
  console.log(`🧹 [SUBSCRIPTION] Cleaning up all ${activeSubscriptions.size} active subscriptions`);
  
  activeSubscriptions.forEach((sub, key) => {
    if (sub.subscription?.unsubscribe) {
      sub.subscription.unsubscribe();
      activeSubscriptionCount = Math.max(0, activeSubscriptionCount - 1);
      console.log(`✅ [SUBSCRIPTION] Cleaned up ${key.split(':')[0]}`);
    }
  });
  
  activeSubscriptions.clear();
  activeSubscriptionCount = 0;
  console.log(`✅ [SUBSCRIPTION] All subscriptions cleaned up`);
}
