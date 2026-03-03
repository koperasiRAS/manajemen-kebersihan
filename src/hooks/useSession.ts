'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { IDLE_TIMEOUT_MS } from '@/lib/constants';

/**
 * Hook that monitors user idle time and signs out after timeout.
 * Also handles session refresh and expired session redirect.
 */
export function useSession() {
  const { user, signOut } = useAuth();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (user) {
      timeoutRef.current = setTimeout(async () => {
        await signOut();
        window.location.href = '/login?expired=1';
      }, IDLE_TIMEOUT_MS);
    }
  }, [user, signOut]);

  useEffect(() => {
    if (!user) return;

    // Activity events to track
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];

    const handleActivity = () => resetTimer();

    events.forEach((event) => {
      document.addEventListener(event, handleActivity);
    });

    // Start initial timer
    resetTimer();

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [user, resetTimer]);

  return { isActive: !!user };
}
