import { useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface PreselectedSlot {
  date: string | null;
  time: string | null;
  professionalId: string | null;
  promoId: string | null;
}

/**
 * Centralized hook for managing preselected booking slots from URL params.
 * Used by: professional profile quick booking, promotions, open schedule, marketplace.
 * 
 * The "locked" slot persists through service/professional selection changes
 * and is only cleared when the user explicitly changes the time.
 */
export function usePreselectedSlot() {
  const [searchParams] = useSearchParams();

  // Capture initial values once from URL
  const initialDate = useRef(searchParams.get('date'));
  const initialTime = useRef(searchParams.get('time'));
  const initialProfessional = useRef(searchParams.get('professional'));
  const initialPromo = useRef(searchParams.get('promo'));

  // Track whether we have an active locked slot
  const hasLockedSlot = useRef(!!(initialDate.current && initialTime.current));
  const lockedTime = useRef(initialTime.current);
  const lockedDate = useRef(initialDate.current);

  const getInitialValues = useCallback((): PreselectedSlot => ({
    date: initialDate.current,
    time: initialTime.current,
    professionalId: initialProfessional.current,
    promoId: initialPromo.current,
  }), []);

  /**
   * Check if a given time matches the locked preselected slot.
   * Used to prevent clearing the time during service/professional changes.
   */
  const isLockedTime = useCallback((time: string | null): boolean => {
    return hasLockedSlot.current && time === lockedTime.current;
  }, []);

  /**
   * Check if a preselected slot is active (date + time from URL).
   */
  const isActive = useCallback((): boolean => {
    return hasLockedSlot.current;
  }, []);

  /**
   * Clear the locked slot (e.g. when user manually changes time).
   */
  const clearLock = useCallback(() => {
    hasLockedSlot.current = false;
    lockedTime.current = null;
    lockedDate.current = null;
  }, []);

  /**
   * Parse the initial date string into a Date object.
   */
  const getParsedDate = useCallback((): Date | null => {
    if (!initialDate.current) return null;
    const [y, mo, d] = initialDate.current.split('-').map(Number);
    return new Date(y, mo - 1, d);
  }, []);

  return {
    getInitialValues,
    isLockedTime,
    isActive,
    clearLock,
    getParsedDate,
    lockedTime: lockedTime.current,
    lockedDate: lockedDate.current,
  };
}

/**
 * Build search params string for navigating to booking with preselected slot.
 */
export function buildPreselectedSlotSearch(params: {
  date?: string;
  time?: string;
  professionalId?: string;
  promoId?: string;
}): string {
  const sp = new URLSearchParams();
  if (params.date) sp.set('date', params.date);
  if (params.time) sp.set('time', params.time);
  if (params.professionalId) sp.set('professional', params.professionalId);
  if (params.promoId) sp.set('promo', params.promoId);
  return sp.toString();
}
