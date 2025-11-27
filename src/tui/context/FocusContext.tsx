/**
 * FocusContext
 *
 * Centralized focus management for the TUI.
 * Handles Tab/Shift+Tab navigation, focus trapping for modals,
 * and provides visual focus ring coordination.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useInput } from "ink";

export interface FocusArea {
  /** Unique identifier for the focus area */
  id: string;
  /** Display name (for debugging) */
  name?: string;
  /** Order in the focus cycle (lower = earlier) */
  order?: number;
  /** Whether this area can receive focus */
  focusable?: boolean;
}

interface FocusContextValue {
  /** Currently focused area ID */
  focusedArea: string | null;
  /** Set focus to a specific area */
  setFocus: (areaId: string | null) => void;
  /** Move focus to next area */
  focusNext: () => void;
  /** Move focus to previous area */
  focusPrev: () => void;
  /** Register a focusable area */
  registerArea: (area: FocusArea) => void;
  /** Unregister a focusable area */
  unregisterArea: (areaId: string) => void;
  /** Check if an area is focused */
  isFocused: (areaId: string) => boolean;
  /** Push a focus trap (for modals) */
  pushTrap: (areaId: string) => void;
  /** Pop a focus trap */
  popTrap: () => void;
  /** Get all registered areas */
  areas: FocusArea[];
}

const FocusContext = createContext<FocusContextValue | null>(null);

export interface FocusProviderProps {
  /** Initial focused area */
  initialFocus?: string;
  /** Whether to handle Tab/Shift+Tab globally */
  handleTabNavigation?: boolean;
  /** Children */
  children: React.ReactNode;
}

export function FocusProvider({
  initialFocus,
  handleTabNavigation = true,
  children,
}: FocusProviderProps) {
  const [focusedArea, setFocusedArea] = useState<string | null>(initialFocus || null);
  const [areas, setAreas] = useState<FocusArea[]>([]);
  const [trapStack, setTrapStack] = useState<string[]>([]);

  // Get sorted focusable areas
  const getSortedAreas = useCallback(() => {
    return [...areas]
      .filter((a) => a.focusable !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [areas]);

  // Register a focusable area
  const registerArea = useCallback((area: FocusArea) => {
    setAreas((prev) => {
      // Update if exists, add if new
      const exists = prev.find((a) => a.id === area.id);
      if (exists) {
        return prev.map((a) => (a.id === area.id ? { ...a, ...area } : a));
      }
      return [...prev, area];
    });
  }, []);

  // Unregister a focusable area
  const unregisterArea = useCallback((areaId: string) => {
    setAreas((prev) => prev.filter((a) => a.id !== areaId));
    // If this area was focused, clear focus
    setFocusedArea((prev) => (prev === areaId ? null : prev));
  }, []);

  // Set focus to a specific area
  const setFocus = useCallback((areaId: string | null) => {
    // If trapped, only allow focus within trap
    if (trapStack.length > 0 && areaId !== null) {
      const trapId = trapStack[trapStack.length - 1];
      if (areaId !== trapId) {
        return; // Cannot focus outside trap
      }
    }
    setFocusedArea(areaId);
  }, [trapStack]);

  // Move to next focusable area
  const focusNext = useCallback(() => {
    const sorted = getSortedAreas();
    if (sorted.length === 0) return;

    // If trapped, stay on trap
    if (trapStack.length > 0) return;

    const currentIndex = focusedArea
      ? sorted.findIndex((a) => a.id === focusedArea)
      : -1;

    const nextIndex = (currentIndex + 1) % sorted.length;
    setFocusedArea(sorted[nextIndex].id);
  }, [focusedArea, getSortedAreas, trapStack]);

  // Move to previous focusable area
  const focusPrev = useCallback(() => {
    const sorted = getSortedAreas();
    if (sorted.length === 0) return;

    // If trapped, stay on trap
    if (trapStack.length > 0) return;

    const currentIndex = focusedArea
      ? sorted.findIndex((a) => a.id === focusedArea)
      : 0;

    const prevIndex = currentIndex <= 0 ? sorted.length - 1 : currentIndex - 1;
    setFocusedArea(sorted[prevIndex].id);
  }, [focusedArea, getSortedAreas, trapStack]);

  // Check if area is focused
  const isFocused = useCallback(
    (areaId: string) => focusedArea === areaId,
    [focusedArea]
  );

  // Push focus trap (for modals)
  const pushTrap = useCallback((areaId: string) => {
    setTrapStack((prev) => [...prev, areaId]);
    setFocusedArea(areaId);
  }, []);

  // Pop focus trap
  const popTrap = useCallback(() => {
    setTrapStack((prev) => {
      if (prev.length === 0) return prev;
      const newStack = prev.slice(0, -1);
      // Restore focus to previous trap or clear
      if (newStack.length > 0) {
        setFocusedArea(newStack[newStack.length - 1]);
      }
      return newStack;
    });
  }, []);

  // Handle Tab/Shift+Tab navigation
  useInput(
    (input, key) => {
      if (!handleTabNavigation) return;

      if (key.tab) {
        if (key.shift) {
          focusPrev();
        } else {
          focusNext();
        }
      }
    },
    { isActive: handleTabNavigation }
  );

  // Set initial focus if not set
  useEffect(() => {
    if (focusedArea === null && areas.length > 0 && initialFocus) {
      const area = areas.find((a) => a.id === initialFocus);
      if (area) {
        setFocusedArea(initialFocus);
      }
    }
  }, [areas, focusedArea, initialFocus]);

  const value: FocusContextValue = {
    focusedArea,
    setFocus,
    focusNext,
    focusPrev,
    registerArea,
    unregisterArea,
    isFocused,
    pushTrap,
    popTrap,
    areas,
  };

  return (
    <FocusContext.Provider value={value}>
      {children}
    </FocusContext.Provider>
  );
}

/**
 * Hook to use focus context
 */
export function useFocusContext() {
  const context = useContext(FocusContext);
  if (!context) {
    throw new Error("useFocusContext must be used within a FocusProvider");
  }
  return context;
}

/**
 * Hook to register a focusable area and get its focus state
 */
export function useFocusArea(area: FocusArea) {
  const { registerArea, unregisterArea, isFocused, setFocus } = useFocusContext();

  useEffect(() => {
    registerArea(area);
    return () => unregisterArea(area.id);
  }, [area.id, area.order, area.focusable, registerArea, unregisterArea]);

  return {
    isFocused: isFocused(area.id),
    focus: () => setFocus(area.id),
  };
}

/**
 * Hook for focus trap (modals, dialogs)
 */
export function useFocusTrap(areaId: string, active: boolean) {
  const { pushTrap, popTrap } = useFocusContext();

  useEffect(() => {
    if (active) {
      pushTrap(areaId);
      return () => popTrap();
    }
  }, [active, areaId, pushTrap, popTrap]);
}
