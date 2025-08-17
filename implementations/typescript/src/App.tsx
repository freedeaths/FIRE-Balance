/**
 * Main App component for FIRE Balance Calculator
 *
 * This is the root component that orchestrates the three-stage FIRE planning system:
 * - Stage 1: User profile and income/expense data collection
 * - Stage 2: Interactive financial projection with adjustments
 * - Stage 3: Monte Carlo analysis and advisor recommendations
 *
 * The app manages the planner state and provides a simplified layout structure.
 */

import React, { useEffect } from "react";
import { setLanguage } from "./core/i18n";

// New Zustand stores
import { useCurrentLanguage } from "./stores/appStore";

// Import new unified layout
import { Layout } from "./components/layout/Layout";

/**
 * Main Application Component
 * Manages i18n initialization and renders the unified layout
 */
const App: React.FC = () => {
  // Zustand store selectors
  const currentLanguage = useCurrentLanguage();

  // Handle language changes
  useEffect(() => {
    setLanguage(currentLanguage as "en" | "zh-CN" | "ja");
  }, [currentLanguage]);

  return <Layout />;
};

export default App;
