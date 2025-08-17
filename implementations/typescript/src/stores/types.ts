/**
 * Zustand Store Types
 *
 * Type definitions for all store states and actions
 */

import type {
  PlannerData,
  PlannerStage,
  UserProfile,
  IncomeExpenseItem,
  Override,
  PlannerResults,
  SimulationSettings,
  LanguageCode,
  AnnualProjectionRow,
} from '../types';

// =============================================================================
// App Store Types
// =============================================================================

export interface AppState {
  // Language and i18n
  currentLanguage: LanguageCode;
  isI18nLoaded: boolean;

  // App-wide UI state
  isLoading: boolean;
  error: string | null;

  // Theme and preferences
  theme: 'light' | 'dark' | 'system';

  // App metadata
  version: string;
  buildTime?: string;
}

export interface AppActions {
  // Language management
  setLanguage: (language: LanguageCode) => void;
  setI18nLoaded: (loaded: boolean) => void;

  // Global state management
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  // Theme management
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  // Utilities
  reset: () => void;
}

export type AppStore = AppState & AppActions;

// =============================================================================
// Planner Store Types
// =============================================================================

export interface PlannerState {
  // Core planner data (mirrors FIREPlanner class)
  data: PlannerData;

  // Stage-specific state
  currentStage: PlannerStage;
  isTransitioning: boolean;
  stageProgress: Record<PlannerStage, boolean>;

  // Calculation state
  isCalculating: boolean;
  calculationProgress: number;

  // Session management
  sessionId: string;
  isDirty: boolean; // Has unsaved changes
  lastSaved: string | undefined;
}

export interface PlannerActions {
  // Data management
  loadData: (data: Partial<PlannerData>) => void;
  updateUserProfile: (profile: Partial<UserProfile>) => void;

  // Income/Expense management
  addIncomeItem: (item: IncomeExpenseItem) => void;
  updateIncomeItem: (id: string, item: Partial<IncomeExpenseItem>) => void;
  removeIncomeItem: (id: string) => void;

  addExpenseItem: (item: IncomeExpenseItem) => void;
  updateExpenseItem: (id: string, item: Partial<IncomeExpenseItem>) => void;
  removeExpenseItem: (id: string) => void;

  // Override management
  addOverride: (override: Override) => void;
  updateOverride: (index: number, override: Partial<Override>) => void;
  removeOverride: (index: number) => void;
  clearOverrides: () => void;
  cleanupOrphanedOverrides: () => void;

  // Stage navigation
  setStage: (stage: PlannerStage) => void;
  advanceStage: () => boolean;
  goToPreviousStage: () => boolean;
  setStageProgress: (stage: PlannerStage, completed: boolean) => void;
  setTransitioning: (transitioning: boolean) => void;

  // Projection management
  updateProjectionData: (data: AnnualProjectionRow[]) => void;

  // Calculation management
  setCalculationProgress: (progress: number) => void;
  setCalculating: (calculating: boolean) => void;
  updateResults: (results: PlannerResults) => void;

  // Simulation settings
  updateSimulationSettings: (settings: Partial<SimulationSettings>) => void;

  // Session management
  markDirty: () => void;
  markClean: () => void;
  updateLastSaved: () => void;

  // Utilities
  exportConfig: (title?: string) => any;
  importConfig: (config: any) => boolean;
  reset: () => void;
}

export type PlannerStore = PlannerState & PlannerActions;

// =============================================================================
// UI Store Types
// =============================================================================

export interface UIState {
  // Layout state
  sidebarOpen: boolean;
  headerHeight: number;

  // Modal and overlay state
  modals: Record<string, boolean>;
  activeModal: string | null;

  // Table and form state
  tableFilters: Record<string, any>;
  formValidation: Record<string, Record<string, string>>;

  // Responsive design state
  screenSize: 'mobile' | 'tablet' | 'laptop' | 'desktop';
  isMobile: boolean;

  // Component-specific UI state
  expandedCards: string[];
  activeTab: string;

  // Notifications and feedback
  notifications: Notification[];
  toasts: Toast[];
}

export interface UIActions {
  // Layout management
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setHeaderHeight: (height: number) => void;

  // Modal management
  openModal: (modalId: string) => void;
  closeModal: (modalId: string) => void;
  closeAllModals: () => void;

  // Table and form management
  setTableFilter: (tableId: string, filter: any) => void;
  clearTableFilter: (tableId: string) => void;
  setFormValidation: (formId: string, field: string, error: string) => void;
  clearFormValidation: (formId: string, field?: string) => void;

  // Responsive design management
  setScreenSize: (size: 'mobile' | 'tablet' | 'laptop' | 'desktop') => void;
  updateResponsiveState: () => void;

  // Component state management
  expandCard: (cardId: string) => void;
  collapseCard: (cardId: string) => void;
  toggleCard: (cardId: string) => void;
  setActiveTab: (tabId: string) => void;

  // Notifications
  addNotification: (
    notification: Omit<Notification, 'id' | 'timestamp'>
  ) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;

  addToast: (toast: Omit<Toast, 'id' | 'timestamp'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;

  // Utilities
  reset: () => void;
}

export type UIStore = UIState & UIActions;

// =============================================================================
// Utility Types
// =============================================================================

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  timestamp: number;
  autoClose?: boolean;
  duration?: number;
}

export interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: number;
  duration?: number;
}

// =============================================================================
// Store Configuration Types
// =============================================================================

export interface StoreConfig {
  // Persistence settings
  persist?: {
    enabled: boolean;
    key: string;
    storage?: 'localStorage' | 'sessionStorage';
    exclude?: string[];
  };

  // Development settings
  devtools?: boolean;

  // Custom middleware
  middleware?: any[];
}
