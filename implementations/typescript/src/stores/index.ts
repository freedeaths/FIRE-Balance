/**
 * Zustand Store System Entry Point
 *
 * This file exports all store hooks and provides the main interface
 * for accessing application state throughout the app.
 */

// Main stores
export { useAppStore, type AppStore } from './appStore';
export { usePlannerStore, type PlannerStore } from './plannerStore';
export { useUIStore, type UIStore } from './uiStore';

// Store utilities
export { createAppStore } from './appStore';
export { createPlannerStore } from './plannerStore';
export { createUIStore } from './uiStore';

// Types
export type * from './types';
