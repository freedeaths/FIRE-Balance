/**
 * Planner Store - FIRE planning business logic state management
 *
 * Manages all planner data including user profile, income/expense items,
 * projections, overrides, and calculation results. This is the core
 * business logic store that mirrors the FIREPlanner class functionality.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { PlannerStore, PlannerState, StoreConfig } from './types';
import {
  PlannerStage,
  DEFAULT_USER_PROFILE,
  DEFAULT_SIMULATION_SETTINGS,
} from '../types';
import type {
  PlannerData,
  UserProfile,
  IncomeExpenseItem,
  Override,
  PlannerResults,
  SimulationSettings,
  LanguageCode,
  AnnualProjectionRow,
} from '../types';

// =============================================================================
// Initial State
// =============================================================================

const createInitialPlannerData = (
  language: LanguageCode = 'en'
): PlannerData => ({
  current_stage: PlannerStage.STAGE1_INPUT,
  user_profile: undefined,
  income_items: [],
  expense_items: [],
  projection_data: undefined,
  overrides: [],
  results: undefined,
  session_id: uuidv4(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  language,
  simulation_settings: { ...DEFAULT_SIMULATION_SETTINGS },
});

const initialPlannerState: PlannerState = {
  // Core planner data
  data: createInitialPlannerData(),

  // Stage-specific state
  currentStage: PlannerStage.STAGE1_INPUT,
  isTransitioning: false,
  stageProgress: {
    [PlannerStage.STAGE1_INPUT]: false,
    [PlannerStage.STAGE2_ADJUSTMENT]: false,
    [PlannerStage.STAGE3_ANALYSIS]: false,
  },

  // Calculation state
  isCalculating: false,
  calculationProgress: 0,

  // Session management
  sessionId: '',
  isDirty: false,
  lastSaved: undefined,
};

// =============================================================================
// Store Creator Function
// =============================================================================

export const createPlannerStore = (config?: StoreConfig) => {
  const storeCreator = (set: any, get: any) => ({
    ...initialPlannerState,
    sessionId: uuidv4(),

    // =============================================================================
    // Data Management
    // =============================================================================

    loadData: (newData: Partial<PlannerData>) => {
      set(
        state => ({
          data: { ...state.data, ...newData },
          currentStage: newData.current_stage ?? state.currentStage,
          isDirty: true,
        }),
        false,
        'loadData'
      );
    },

    updateUserProfile: (profile: Partial<UserProfile>) => {
      set(
        state => {
          const currentProfile = state.data.user_profile || {};

          const updatedProfile = { ...currentProfile, ...profile };

          return {
            data: {
              ...state.data,
              user_profile: updatedProfile,
              updated_at: new Date().toISOString(),
            },
            isDirty: true,
          };
        },
        false,
        'updateUserProfile'
      );
    },

    // =============================================================================
    // Income/Expense Management
    // =============================================================================

    addIncomeItem: (item: IncomeExpenseItem) => {
      set(
        state => ({
          data: {
            ...state.data,
            income_items: [...state.data.income_items, item],
            updated_at: new Date().toISOString(),
          },
          isDirty: true,
        }),
        false,
        'addIncomeItem'
      );
    },

    updateIncomeItem: (id: string, updates: Partial<IncomeExpenseItem>) => {
      set(
        state => ({
          data: {
            ...state.data,
            income_items: state.data.income_items.map(item =>
              item.id === id ? { ...item, ...updates } : item
            ),
            updated_at: new Date().toISOString(),
          },
          isDirty: true,
        }),
        false,
        'updateIncomeItem'
      );
    },

    removeIncomeItem: (id: string) => {
      set(
        state => ({
          data: {
            ...state.data,
            income_items: state.data.income_items.filter(
              item => item.id !== id
            ),
            updated_at: new Date().toISOString(),
          },
          isDirty: true,
        }),
        false,
        'removeIncomeItem'
      );

      // Cleanup orphaned overrides after removing item
      get().cleanupOrphanedOverrides();
    },

    addExpenseItem: (item: IncomeExpenseItem) => {
      set(
        state => ({
          data: {
            ...state.data,
            expense_items: [...state.data.expense_items, item],
            updated_at: new Date().toISOString(),
          },
          isDirty: true,
        }),
        false,
        'addExpenseItem'
      );
    },

    updateExpenseItem: (id: string, updates: Partial<IncomeExpenseItem>) => {
      set(
        state => ({
          data: {
            ...state.data,
            expense_items: state.data.expense_items.map(item =>
              item.id === id ? { ...item, ...updates } : item
            ),
            updated_at: new Date().toISOString(),
          },
          isDirty: true,
        }),
        false,
        'updateExpenseItem'
      );
    },

    removeExpenseItem: (id: string) => {
      set(
        state => ({
          data: {
            ...state.data,
            expense_items: state.data.expense_items.filter(
              item => item.id !== id
            ),
            updated_at: new Date().toISOString(),
          },
          isDirty: true,
        }),
        false,
        'removeExpenseItem'
      );

      // Cleanup orphaned overrides after removing item
      get().cleanupOrphanedOverrides();
    },

    // =============================================================================
    // Override Management
    // =============================================================================

    addOverride: (override: Override) => {
      set(
        state => ({
          data: {
            ...state.data,
            overrides: [...state.data.overrides, override],
            updated_at: new Date().toISOString(),
          },
          isDirty: true,
        }),
        false,
        'addOverride'
      );
    },

    updateOverride: (index: number, updates: Partial<Override>) => {
      set(
        state => ({
          data: {
            ...state.data,
            overrides: state.data.overrides.map((override, i) =>
              i === index ? { ...override, ...updates } : override
            ),
            updated_at: new Date().toISOString(),
          },
          isDirty: true,
        }),
        false,
        'updateOverride'
      );
    },

    removeOverride: (index: number) => {
      set(
        state => ({
          data: {
            ...state.data,
            overrides: state.data.overrides.filter((_, i) => i !== index),
            updated_at: new Date().toISOString(),
          },
          isDirty: true,
        }),
        false,
        'removeOverride'
      );
    },

    clearOverrides: () => {
      set(
        state => ({
          data: {
            ...state.data,
            overrides: [],
            updated_at: new Date().toISOString(),
          },
          isDirty: true,
        }),
        false,
        'clearOverrides'
      );
    },

    cleanupOrphanedOverrides: (): void => {
      set(
        (state: PlannerState) => {
          const allItems = [
            ...state.data.income_items,
            ...state.data.expense_items,
          ];
          const validItemIds = new Set(allItems.map(item => item.id));

          // Only keep overrides for items that still exist
          const validOverrides = state.data.overrides.filter(
            (override: Override) => validItemIds.has(override.item_id)
          );

          const removedCount =
            state.data.overrides.length - validOverrides.length;

          if (removedCount > 0) {
            return {
              data: {
                ...state.data,
                overrides: validOverrides,
                updated_at: new Date().toISOString(),
              },
              isDirty: true,
            };
          }

          return state;
        },
        false,
        'cleanupOrphanedOverrides'
      );
    },

    // =============================================================================
    // Stage Navigation
    // =============================================================================

    setStage: (stage: PlannerStage) => {
      set(
        state => ({
          currentStage: stage,
          data: {
            ...state.data,
            current_stage: stage,
            updated_at: new Date().toISOString(),
          },
        }),
        false,
        'setStage'
      );
    },

    advanceStage: (): boolean => {
      const state = get();
      const stages = [
        PlannerStage.STAGE1_INPUT,
        PlannerStage.STAGE2_ADJUSTMENT,
        PlannerStage.STAGE3_ANALYSIS,
      ];

      const currentIndex = stages.indexOf(state.currentStage);
      const nextIndex = currentIndex + 1;

      if (nextIndex < stages.length) {
        const nextStage = stages[nextIndex];

        // 设置全局变量以供 useFIRECalculation hook 检测 stage 转换
        (window as any).__fireStageTransition = {
          from: state.currentStage,
          to: nextStage,
          timestamp: Date.now(),
        };

        state.setStage(nextStage);
        return true;
      }

      return false;
    },

    goToPreviousStage: (): boolean => {
      const state = get();
      const stages = [
        PlannerStage.STAGE1_INPUT,
        PlannerStage.STAGE2_ADJUSTMENT,
        PlannerStage.STAGE3_ANALYSIS,
      ];

      const currentIndex = stages.indexOf(state.currentStage);
      const previousIndex = currentIndex - 1;

      if (previousIndex >= 0) {
        const previousStage = stages[previousIndex];
        state.setStage(previousStage);
        return true;
      }

      return false;
    },

    setStageProgress: (stage: PlannerStage, completed: boolean) => {
      set(
        state => ({
          stageProgress: {
            ...state.stageProgress,
            [stage]: completed,
          },
        }),
        false,
        'setStageProgress'
      );
    },

    setTransitioning: (transitioning: boolean) => {
      set({ isTransitioning: transitioning }, false, 'setTransitioning');
    },

    // =============================================================================
    // Projection Management
    // =============================================================================

    updateProjectionData: (data: AnnualProjectionRow[]) => {
      set(
        state => ({
          data: {
            ...state.data,
            projection_data: data,
            updated_at: new Date().toISOString(),
          },
          isDirty: true,
        }),
        false,
        'updateProjectionData'
      );
    },

    // =============================================================================
    // Calculation Management
    // =============================================================================

    setCalculationProgress: (progress: number) => {
      set({ calculationProgress: progress }, false, 'setCalculationProgress');
    },

    setCalculating: (calculating: boolean) => {
      set({ isCalculating: calculating }, false, 'setCalculating');
    },

    updateResults: (results: PlannerResults) => {
      set(
        state => ({
          data: {
            ...state.data,
            results,
            updated_at: new Date().toISOString(),
          },
          isDirty: true,
        }),
        false,
        'updateResults'
      );
    },

    // =============================================================================
    // Simulation Settings
    // =============================================================================

    updateSimulationSettings: (settings: Partial<SimulationSettings>) => {
      set(
        state => ({
          data: {
            ...state.data,
            simulation_settings: {
              ...state.data.simulation_settings,
              ...settings,
            },
            updated_at: new Date().toISOString(),
          },
          isDirty: true,
        }),
        false,
        'updateSimulationSettings'
      );
    },

    // =============================================================================
    // Session Management
    // =============================================================================

    markDirty: () => {
      set({ isDirty: true }, false, 'markDirty');
    },

    markClean: () => {
      set({ isDirty: false }, false, 'markClean');
    },

    updateLastSaved: () => {
      set(
        {
          lastSaved: new Date().toISOString(),
          isDirty: false,
        },
        false,
        'updateLastSaved'
      );
    },

    // =============================================================================
    // Utilities
    // =============================================================================

    exportConfig: (title?: string) => {
      const state = get();
      return {
        version: '1.0',
        title: title || `FIRE Plan - ${new Date().toISOString()}`,
        created_at: new Date().toISOString(),
        user_profile: state.data.user_profile,
        income_items: state.data.income_items,
        expense_items: state.data.expense_items,
        overrides: state.data.overrides,
        simulation_settings: state.data.simulation_settings,
        language: state.data.language,
      };
    },

    importConfig: (config: any): boolean => {
      try {
        // 验证导入数据是否合法
        if (
          !config ||
          !config.version ||
          (!config.user_profile && !config.profile)
        ) {
          console.error('❌ Config validation failed!');
          return false;
        }

        const currentStage = get().data.current_stage;

        // 一次性重置并设置新数据，避免竞态条件
        set(
          {
            ...initialPlannerState,
            data: {
              ...createInitialPlannerData(),
              user_profile: config.user_profile || config.profile,
              income_items: config.income_items || [],
              expense_items: config.expense_items || [],
              overrides: config.overrides || [],
              simulation_settings:
                config.simulation_settings || DEFAULT_SIMULATION_SETTINGS,
              language: config.language || 'en',
              current_stage: currentStage,
              updated_at: new Date().toISOString(),
            },
            currentStage,
            sessionId: uuidv4(),
            isDirty: true,
          },
          false,
          'importConfig'
        );

        return true;
      } catch (error) {
        console.error('Failed to import config:', error);
        return false;
      }
    },

    reset: () => {
      const newSessionId = uuidv4();
      set(
        {
          ...initialPlannerState,
          data: createInitialPlannerData(),
          sessionId: newSessionId,
        },
        false,
        'reset'
      );
    },
  });

  // Create store with conditional persistence
  if (config?.persist?.enabled) {
    return create<PlannerStore>()(
      devtools(
        persist(storeCreator, {
          name: config.persist.key ?? 'fire-planner-state',
          partialize: state => ({
            data: state.data,
            currentStage: state.currentStage,
            stageProgress: state.stageProgress,
            sessionId: state.sessionId,
          }),
        }),
        {
          name: 'FIRE-Planner-Store',
          enabled: config?.devtools ?? process.env.NODE_ENV === 'development',
        }
      )
    );
  } else {
    return create<PlannerStore>()(
      devtools(storeCreator, {
        name: 'FIRE-Planner-Store',
        enabled: config?.devtools ?? process.env.NODE_ENV === 'development',
      })
    );
  }
};

// =============================================================================
// Default Store Instance
// =============================================================================

// Export the store type for external usage
export type { PlannerStore } from './types';

export const usePlannerStore = createPlannerStore({
  persist: {
    enabled: true, // Enable persistence with localStorage
    key: 'fire-planner-state',
    storage: 'localStorage',
  },
  devtools: true,
});

// =============================================================================
// Store Selectors (for performance optimization)
// =============================================================================

// Data selectors
export const usePlannerData = () => usePlannerStore(state => state.data);
export const useUserProfile = () =>
  usePlannerStore(state => state.data.user_profile);
export const useIncomeItems = () =>
  usePlannerStore(state => state.data.income_items);
export const useExpenseItems = () =>
  usePlannerStore(state => state.data.expense_items);
export const useOverrides = () =>
  usePlannerStore(state => state.data.overrides);
export const useResults = () => usePlannerStore(state => state.data.results);
export const useSimulationSettings = () =>
  usePlannerStore(state => state.data.simulation_settings);

// Stage selectors
export const useCurrentStage = () =>
  usePlannerStore(state => state.currentStage);
export const useIsTransitioning = () =>
  usePlannerStore(state => state.isTransitioning);
export const useStageProgress = () =>
  usePlannerStore(state => state.stageProgress);

// Calculation selectors
export const useIsCalculating = () =>
  usePlannerStore(state => state.isCalculating);
export const useCalculationProgress = () =>
  usePlannerStore(state => state.calculationProgress);

// Session selectors
export const useIsDirty = () => usePlannerStore(state => state.isDirty);
export const useLastSaved = () => usePlannerStore(state => state.lastSaved);
