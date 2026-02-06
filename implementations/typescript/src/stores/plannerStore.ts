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

const normalizeLanguageCode = (raw: unknown): LanguageCode => {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (value === 'en') return 'en';
  if (value === 'ja') return 'ja';
  if (value === 'zh' || value === 'zh-cn' || value === 'zh_cn') return 'zh-CN';
  return 'en';
};

const normalizePortfolioAssetClasses = (
  assetClasses: unknown
): UserProfile['portfolio']['asset_classes'] => {
  const defaults = DEFAULT_USER_PROFILE.portfolio.asset_classes;
  const existingArray = Array.isArray(assetClasses) ? assetClasses : [];

  const byName = new Map<string, any>();
  for (const asset of existingArray) {
    const name = String((asset as any)?.name ?? '');
    if (!name) continue;
    byName.set(name, asset);
  }

  const normalized: any[] = [];
  for (const d of defaults) {
    const existing = byName.get(d.name);
    if (existing) {
      normalized.push({
        ...d,
        ...existing,
        name: existing.name ?? d.name,
        allocation_percentage: Number(
          existing.allocation_percentage ?? d.allocation_percentage ?? 0
        ),
        expected_return: Number(
          existing.expected_return ?? d.expected_return ?? 0
        ),
        volatility: Number(existing.volatility ?? d.volatility ?? 0),
        liquidity_level: existing.liquidity_level ?? d.liquidity_level,
        display_name: existing.display_name ?? d.display_name,
      });
      byName.delete(d.name);
    } else {
      normalized.push({
        ...d,
        allocation_percentage: 0,
      });
    }
  }

  // Keep any extra user-defined asset classes after the defaults
  for (const [, extra] of byName.entries()) {
    normalized.push({
      ...extra,
      name: String(extra?.name ?? ''),
      allocation_percentage: Number(extra?.allocation_percentage ?? 0),
      expected_return: Number(extra?.expected_return ?? 0),
      volatility: Number(extra?.volatility ?? 0),
      display_name: String(extra?.display_name ?? extra?.name ?? ''),
      liquidity_level: extra?.liquidity_level ?? 'low',
    });
  }

  return normalized as any;
};

const normalizeIncomeExpenseItems = (
  items: unknown,
  isIncome: boolean
): IncomeExpenseItem[] => {
  const array = Array.isArray(items) ? items : [];

  const toFiniteNumber = (raw: any, fallback = 0): number => {
    const num = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(num) ? num : fallback;
  };

  const toFiniteInt = (raw: any, fallback = 0): number => {
    return Math.floor(toFiniteNumber(raw, fallback));
  };

  const normalizeTimeUnit = (raw: any): IncomeExpenseItem['time_unit'] => {
    const value = String(raw ?? '');
    if (value === 'monthly') return 'monthly';
    if (value === 'quarterly') return 'quarterly';
    if (value === 'annually') return 'annually';
    if (value === 'annual' || value === 'yearly' || value === 'year')
      return 'annually';
    if (value === 'month') return 'monthly';
    if (value === 'quarter') return 'quarterly';
    return 'annually';
  };

  const normalizeFrequency = (raw: any): IncomeExpenseItem['frequency'] => {
    const value = String(raw ?? '');
    if (value === 'recurring') return 'recurring';
    if (value === 'one-time' || value === 'one_time') return 'one-time';
    if (value === 'annual' || value === 'monthly') return 'recurring';
    return 'recurring';
  };

  const normalizeIntervalPeriods = (raw: any): number => {
    const num = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(num)) return 1;
    return Math.max(1, Math.floor(num));
  };

  const normalizePhase = (raw: any): 1 | 2 | 3 | 4 | undefined => {
    const num = typeof raw === 'number' ? raw : Number(raw);
    if (num === 1 || num === 2 || num === 3 || num === 4) return num;
    return undefined;
  };

  const normalizePhaseEnd = (
    rawPhase: 1 | 2 | 3 | 4 | undefined,
    rawEnd: any
  ): 1 | 2 | 3 | 4 | undefined => {
    if (!rawPhase) return undefined;
    const end = normalizePhase(rawEnd);
    if (!end) return undefined;
    return end >= rawPhase ? end : rawPhase;
  };

  return array.filter(Boolean).map((raw: any): IncomeExpenseItem => {
    const normalizedFrequency = normalizeFrequency(raw?.frequency);
    const inferredTimeUnit =
      raw?.frequency === 'monthly'
        ? 'monthly'
        : raw?.frequency === 'annual'
          ? 'annually'
          : raw?.time_unit;

    const timeUnit = normalizeTimeUnit(inferredTimeUnit);
    const interval =
      normalizedFrequency === 'one-time'
        ? 1
        : normalizeIntervalPeriods(raw?.interval_periods ?? raw?.interval);

    const startAge = Math.max(0, toFiniteInt(raw?.start_age, 0));
    const endAge =
      raw?.end_age === undefined || raw?.end_age === null
        ? undefined
        : (() => {
            const parsed = toFiniteNumber(raw.end_age, NaN);
            return Number.isFinite(parsed)
              ? Math.max(0, Math.floor(parsed))
              : undefined;
          })();

    return {
      id: typeof raw?.id === 'string' && raw.id.length > 0 ? raw.id : uuidv4(),
      name: typeof raw?.name === 'string' ? raw.name : '',
      phase:
        normalizedFrequency === 'one-time'
          ? undefined
          : normalizePhase(raw?.phase),
      phase_end:
        normalizedFrequency === 'one-time'
          ? undefined
          : normalizePhaseEnd(
              normalizePhase(raw?.phase),
              raw?.phase_end ?? raw?.phase_to
            ),
      after_tax_amount_per_period: toFiniteNumber(
        raw?.after_tax_amount_per_period ?? raw?.amount,
        0
      ),
      time_unit: timeUnit,
      frequency: normalizedFrequency,
      interval_periods: interval,
      start_age: startAge,
      end_age: endAge,
      annual_growth_rate: toFiniteNumber(
        raw?.annual_growth_rate ?? raw?.growth_rate,
        0
      ),
      is_income: typeof raw?.is_income === 'boolean' ? raw.is_income : isIncome,
      category: raw?.category,
      predefined_type: raw?.predefined_type,
    };
  });
};

const materializeAgeRangeFromPhase = (
  phaseStart: 1 | 2 | 3 | 4,
  phaseEnd: 1 | 2 | 3 | 4,
  profile: Partial<UserProfile> | undefined
): { startAge: number; endAge: number } | null => {
  if (!profile) return null;

  const birthYear = Number(profile.birth_year);
  const asOfYear = Number(profile.as_of_year ?? new Date().getFullYear());
  const expectedFireAge = Number(profile.expected_fire_age);
  const legalRetirementAge = Number(profile.legal_retirement_age);
  const expectedHealthyAgeRaw =
    (profile as any)?.expected_healthy_age ??
    (profile as any)?.expectedHealthyAge;
  const lifeExpectancy = Number(profile.life_expectancy);

  if (
    !Number.isFinite(birthYear) ||
    !Number.isFinite(asOfYear) ||
    !Number.isFinite(expectedFireAge) ||
    !Number.isFinite(legalRetirementAge) ||
    !Number.isFinite(lifeExpectancy)
  ) {
    return null;
  }

  const currentAge = asOfYear - birthYear;

  const expectedHealthyAge = Number(expectedHealthyAgeRaw);
  const hasHealthyAge =
    Number.isFinite(expectedHealthyAge) &&
    expectedHealthyAge > legalRetirementAge &&
    expectedHealthyAge < lifeExpectancy;

  const getStartAgeForPhase = (p: 1 | 2 | 3 | 4): number | null => {
    if (p === 1) return currentAge;
    if (p === 2) return expectedFireAge + 1;
    if (p === 3) return legalRetirementAge + 1;
    if (!hasHealthyAge) return null;
    return expectedHealthyAge + 1;
  };

  const getEndAgeForPhase = (p: 1 | 2 | 3 | 4): number | null => {
    if (p === 1) return expectedFireAge;
    if (p === 2) return legalRetirementAge;
    if (p === 3) return hasHealthyAge ? expectedHealthyAge : lifeExpectancy;
    if (!hasHealthyAge) return null;
    return lifeExpectancy;
  };

  const normalizedEnd = phaseEnd >= phaseStart ? phaseEnd : phaseStart;
  const startAge = getStartAgeForPhase(phaseStart);
  const endAge = getEndAgeForPhase(normalizedEnd);
  if (startAge === null || endAge === null) return null;

  return { startAge, endAge };
};

const materializePhaseAgesForItem = (
  item: IncomeExpenseItem,
  profile: Partial<UserProfile> | undefined
): IncomeExpenseItem => {
  if (item.frequency === 'one-time') {
    if (item.phase === undefined) return item;
    return { ...item, phase: undefined, phase_end: undefined };
  }

  if (item.phase === undefined) return item;

  const range = materializeAgeRangeFromPhase(
    item.phase,
    item.phase_end ?? item.phase,
    profile
  );
  if (!range) return item;

  return {
    ...item,
    start_age: Math.max(0, Math.floor(range.startAge)),
    end_age: Math.max(0, Math.floor(range.endAge)),
  };
};

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
  language: normalizeLanguageCode(language),
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

          const updatedIncomeItems = state.data.income_items.map(item =>
            materializePhaseAgesForItem(item, updatedProfile)
          );
          const updatedExpenseItems = state.data.expense_items.map(item =>
            materializePhaseAgesForItem(item, updatedProfile)
          );

          return {
            data: {
              ...state.data,
              user_profile: updatedProfile,
              income_items: updatedIncomeItems,
              expense_items: updatedExpenseItems,
              updated_at: new Date().toISOString(),
            },
            isDirty: true,
          };
        },
        false,
        'updateUserProfile'
      );
    },

    syncLanguage: (language: LanguageCode) => {
      const normalizedLanguage = normalizeLanguageCode(language);
      set(
        state => ({
          data: {
            ...state.data,
            language: normalizedLanguage,
            updated_at: new Date().toISOString(),
          },
        }),
        false,
        'syncLanguage'
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

    removeOverridesByItemId: (itemId: string) => {
      set(
        state => ({
          data: {
            ...state.data,
            overrides: state.data.overrides.filter(
              override => override.item_id !== itemId
            ),
            updated_at: new Date().toISOString(),
          },
          isDirty: true,
        }),
        false,
        'removeOverridesByItemId'
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
      const normalizedProfile = state.data.user_profile
        ? {
            ...state.data.user_profile,
            as_of_year:
              state.data.user_profile.as_of_year ?? new Date().getFullYear(),
            bridge_discount_rate:
              state.data.user_profile.bridge_discount_rate ?? 1.0,
            portfolio: state.data.user_profile.portfolio
              ? {
                  ...state.data.user_profile.portfolio,
                  asset_classes: normalizePortfolioAssetClasses(
                    state.data.user_profile.portfolio.asset_classes
                  ),
                }
              : DEFAULT_USER_PROFILE.portfolio,
          }
        : state.data.user_profile;
      return {
        version: '1.0',
        title: title || `FIRE Plan - ${new Date().toISOString()}`,
        created_at: new Date().toISOString(),
        user_profile: normalizedProfile,
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
        const nowYear = new Date().getFullYear();
        const normalizedProfile =
          config.user_profile || config.profile
            ? {
                ...(config.user_profile || config.profile),
                as_of_year:
                  (config.user_profile || config.profile).as_of_year ?? nowYear,
                bridge_discount_rate:
                  (config.user_profile || config.profile)
                    .bridge_discount_rate ?? 1.0,
                portfolio: {
                  ...(config.user_profile || config.profile).portfolio,
                  asset_classes: normalizePortfolioAssetClasses(
                    (config.user_profile || config.profile).portfolio
                      ?.asset_classes
                  ),
                },
              }
            : config.user_profile || config.profile;

        // Block invalid age progression that would silently disable bridge logic
        if (
          normalizedProfile?.expected_fire_age !== undefined &&
          normalizedProfile?.legal_retirement_age !== undefined &&
          Number(normalizedProfile.legal_retirement_age) <=
            Number(normalizedProfile.expected_fire_age)
        ) {
          console.error(
            '❌ Invalid profile: legal_retirement_age must be greater than expected_fire_age'
          );
          return false;
        }

        // 一次性重置并设置新数据，避免竞态条件
        set(
          {
            ...initialPlannerState,
            data: {
              ...createInitialPlannerData(),
              user_profile: normalizedProfile,
              income_items: normalizeIncomeExpenseItems(
                config.income_items,
                true
              ).map(item =>
                materializePhaseAgesForItem(item, normalizedProfile)
              ),
              expense_items: normalizeIncomeExpenseItems(
                config.expense_items,
                false
              ).map(item =>
                materializePhaseAgesForItem(item, normalizedProfile)
              ),
              overrides: config.overrides || [],
              simulation_settings:
                config.simulation_settings || DEFAULT_SIMULATION_SETTINGS,
              language: normalizeLanguageCode(config.language || 'en'),
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
