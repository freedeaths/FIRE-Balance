/**
 * UI Store - User interface state management
 *
 * Handles all UI-specific state including modals, tables, forms, responsive design,
 * notifications, and other interface concerns separate from business logic.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { UIStore, UIState, StoreConfig, Notification, Toast } from './types';

// =============================================================================
// Initial State
// =============================================================================

const initialUIState: UIState = {
  // Layout state
  sidebarOpen: false,
  headerHeight: 70,

  // Modal and overlay state
  modals: {},
  activeModal: null,

  // Table and form state
  tableFilters: {},
  formValidation: {},

  // Responsive design state
  screenSize: 'desktop',
  isMobile: false,

  // Component-specific UI state
  expandedCards: [],
  activeTab: 'overview',

  // Notifications and feedback
  notifications: [],
  toasts: [],
};

// =============================================================================
// Utility Functions
// =============================================================================

const getScreenSize = (width: number): 'mobile' | 'tablet' | 'laptop' | 'desktop' => {
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  if (width < 1200) return 'laptop';
  return 'desktop';
};

const detectScreenSize = (): 'mobile' | 'tablet' | 'laptop' | 'desktop' => {
  if (typeof window === 'undefined') return 'desktop';
  return getScreenSize(window.innerWidth);
};

// =============================================================================
// Store Creator Function
// =============================================================================

export const createUIStore = (config?: StoreConfig) =>
  create<UIStore>()(
    devtools(
      (set, get) => ({
        ...initialUIState,
        screenSize: detectScreenSize(),
        isMobile: detectScreenSize() === 'mobile',

        // =============================================================================
        // Layout Management
        // =============================================================================

        setSidebarOpen: (open: boolean) => {
          set({ sidebarOpen: open }, false, 'setSidebarOpen');
        },

        toggleSidebar: () => {
          const state = get();
          set({ sidebarOpen: !state.sidebarOpen }, false, 'toggleSidebar');
        },

        setHeaderHeight: (height: number) => {
          set({ headerHeight: height }, false, 'setHeaderHeight');
        },

        // =============================================================================
        // Modal Management
        // =============================================================================

        openModal: (modalId: string) => {
          set((state) => ({
            modals: { ...state.modals, [modalId]: true },
            activeModal: modalId,
          }), false, 'openModal');
        },

        closeModal: (modalId: string) => {
          set((state) => {
            const newModals = { ...state.modals };
            delete newModals[modalId];

            return {
              modals: newModals,
              activeModal: state.activeModal === modalId ? null : state.activeModal,
            };
          }, false, 'closeModal');
        },

        closeAllModals: () => {
          set({
            modals: {},
            activeModal: null,
          }, false, 'closeAllModals');
        },

        // =============================================================================
        // Table and Form Management
        // =============================================================================

        setTableFilter: (tableId: string, filter: any) => {
          set((state) => ({
            tableFilters: { ...state.tableFilters, [tableId]: filter },
          }), false, 'setTableFilter');
        },

        clearTableFilter: (tableId: string) => {
          set((state) => {
            const newFilters = { ...state.tableFilters };
            delete newFilters[tableId];
            return { tableFilters: newFilters };
          }, false, 'clearTableFilter');
        },

        setFormValidation: (formId: string, field: string, error: string) => {
          set((state) => ({
            formValidation: {
              ...state.formValidation,
              [formId]: {
                ...state.formValidation[formId],
                [field]: error,
              },
            },
          }), false, 'setFormValidation');
        },

        clearFormValidation: (formId: string, field?: string) => {
          set((state) => {
            if (field) {
              // Clear specific field
              const formValidation = { ...state.formValidation };
              if (formValidation[formId]) {
                const newFormValidation = { ...formValidation[formId] };
                delete newFormValidation[field];
                formValidation[formId] = newFormValidation;
              }
              return { formValidation };
            } else {
              // Clear entire form
              const newValidation = { ...state.formValidation };
              delete newValidation[formId];
              return { formValidation: newValidation };
            }
          }, false, 'clearFormValidation');
        },

        // =============================================================================
        // Responsive Design Management
        // =============================================================================

        setScreenSize: (size: 'mobile' | 'tablet' | 'laptop' | 'desktop') => {
          set({
            screenSize: size,
            isMobile: size === 'mobile',
          }, false, 'setScreenSize');
        },

        updateResponsiveState: () => {
          if (typeof window !== 'undefined') {
            const size = getScreenSize(window.innerWidth);
            const state = get();
            if (state.screenSize !== size) {
              state.setScreenSize(size);
            }
          }
        },

        // =============================================================================
        // Component State Management
        // =============================================================================

        expandCard: (cardId: string) => {
          set((state) => ({
            expandedCards: state.expandedCards.includes(cardId)
              ? state.expandedCards
              : [...state.expandedCards, cardId],
          }), false, 'expandCard');
        },

        collapseCard: (cardId: string) => {
          set((state) => ({
            expandedCards: state.expandedCards.filter(id => id !== cardId),
          }), false, 'collapseCard');
        },

        toggleCard: (cardId: string) => {
          const state = get();
          if (state.expandedCards.includes(cardId)) {
            state.collapseCard(cardId);
          } else {
            state.expandCard(cardId);
          }
        },

        setActiveTab: (tabId: string) => {
          set({ activeTab: tabId }, false, 'setActiveTab');
        },

        // =============================================================================
        // Notifications
        // =============================================================================

        addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => {
          const newNotification: Notification = {
            ...notification,
            id: uuidv4(),
            timestamp: Date.now(),
            autoClose: notification.autoClose ?? true,
            duration: notification.duration ?? 5000,
          };

          set((state) => ({
            notifications: [...state.notifications, newNotification],
          }), false, 'addNotification');

          // Auto-remove notification if enabled
          if (newNotification.autoClose) {
            setTimeout(() => {
              get().removeNotification(newNotification.id);
            }, newNotification.duration);
          }
        },

        removeNotification: (id: string) => {
          set((state) => ({
            notifications: state.notifications.filter(n => n.id !== id),
          }), false, 'removeNotification');
        },

        clearNotifications: () => {
          set({ notifications: [] }, false, 'clearNotifications');
        },

        addToast: (toast: Omit<Toast, 'id' | 'timestamp'>) => {
          const newToast: Toast = {
            ...toast,
            id: uuidv4(),
            timestamp: Date.now(),
            duration: toast.duration ?? 3000,
          };

          set((state) => ({
            toasts: [...state.toasts, newToast],
          }), false, 'addToast');

          // Auto-remove toast
          setTimeout(() => {
            get().removeToast(newToast.id);
          }, newToast.duration);
        },

        removeToast: (id: string) => {
          set((state) => ({
            toasts: state.toasts.filter(t => t.id !== id),
          }), false, 'removeToast');
        },

        clearToasts: () => {
          set({ toasts: [] }, false, 'clearToasts');
        },

        // =============================================================================
        // Utilities
        // =============================================================================

        reset: () => {
          set({
            ...initialUIState,
            screenSize: detectScreenSize(),
            isMobile: detectScreenSize() === 'mobile',
          }, false, 'reset');
        },
      }),

      // DevTools configuration
      {
        name: 'FIRE-UI-Store',
        enabled: config?.devtools ?? process.env.NODE_ENV === 'development',
      }
    )
  );

// =============================================================================
// Default Store Instance
// =============================================================================

// Export the store type for external usage
export type { UIStore } from './types';

export const useUIStore = createUIStore({
  devtools: true,
});

// =============================================================================
// Store Selectors (for performance optimization)
// =============================================================================

// Layout selectors
export const useSidebarOpen = () => useUIStore((state) => state.sidebarOpen);
export const useHeaderHeight = () => useUIStore((state) => state.headerHeight);

// Modal selectors
export const useModals = () => useUIStore((state) => state.modals);
export const useActiveModal = () => useUIStore((state) => state.activeModal);
export const useIsModalOpen = (modalId: string) => useUIStore((state) => !!state.modals[modalId]);

// Responsive design selectors
export const useScreenSize = () => useUIStore((state) => state.screenSize);
export const useIsMobile = () => useUIStore((state) => state.isMobile);

// Component state selectors
export const useExpandedCards = () => useUIStore((state) => state.expandedCards);
export const useActiveTab = () => useUIStore((state) => state.activeTab);
export const useIsCardExpanded = (cardId: string) => useUIStore((state) =>
  state.expandedCards.includes(cardId)
);

// Notifications selectors
export const useNotifications = () => useUIStore((state) => state.notifications);
export const useToasts = () => useUIStore((state) => state.toasts);

// Form validation selectors
export const useFormValidation = (formId: string) => useUIStore((state) =>
  state.formValidation[formId] || {}
);
export const useFieldError = (formId: string, fieldName: string) => useUIStore((state) =>
  state.formValidation[formId]?.[fieldName]
);

// =============================================================================
// Store Actions (for direct usage without hooks)
// =============================================================================

// Layout actions
export const setSidebarOpen = (open: boolean) => useUIStore.getState().setSidebarOpen(open);
export const toggleSidebar = () => useUIStore.getState().toggleSidebar();

// Modal actions
export const openModal = (modalId: string) => useUIStore.getState().openModal(modalId);
export const closeModal = (modalId: string) => useUIStore.getState().closeModal(modalId);
export const closeAllModals = () => useUIStore.getState().closeAllModals();

// Notification actions
export const addNotification = (notification: Omit<Notification, 'id' | 'timestamp'>) =>
  useUIStore.getState().addNotification(notification);
export const addToast = (toast: Omit<Toast, 'id' | 'timestamp'>) =>
  useUIStore.getState().addToast(toast);

// Component actions
export const setActiveTab = (tabId: string) => useUIStore.getState().setActiveTab(tabId);
export const toggleCard = (cardId: string) => useUIStore.getState().toggleCard(cardId);

// Responsive design actions
export const updateResponsiveState = () => useUIStore.getState().updateResponsiveState();

// =============================================================================
// Window Resize Listener Setup
// =============================================================================

// Auto-setup responsive state updates
if (typeof window !== 'undefined') {
  const handleResize = () => {
    updateResponsiveState();
  };

  window.addEventListener('resize', handleResize);

  // Initial check
  updateResponsiveState();
}
