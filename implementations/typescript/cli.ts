#!/usr/bin/env node

/**
 * FIRE Planner CLI - TypeScript Implementation
 * Direct TypeScript port from Python fire_planner.py
 *
 * This CLI tool provides identical interface and output format as the Python version,
 * using the aligned core modules for consistent calculations.
 *
 * Usage:
 *   npx tsx cli.ts [path_to_json_file]
 *   npx tsx cli.ts --help
 */

import * as fs from 'fs';
import * as path from 'path';
import { FIREPlanner, createPlannerFromJSON } from './src/core/planner';
import { createSimulationSettings } from './src/core/data_models';
import type {
  PlannerConfigV1,
  PlannerResults,
  SimulationSettings,
} from './src/core/planner_models';

// =============================================================================
// CLI Configuration and Types
// =============================================================================

interface CLIArgs {
  jsonFile?: string;
  quickMc: boolean;
  output?: string;
  help: boolean;
}

/**
 * Output format matching Python CLI's save_results_to_file function
 */
interface CLIOutput {
  metadata: {
    export_timestamp: string;
    export_type: string;
    description: string;
  };
  input_configuration: PlannerConfigV1;
  results: {
    fire_calculation: {
      is_fire_achievable: boolean;
      fire_net_worth: number;
      min_net_worth_after_fire: number;
      final_net_worth: number;
      safety_buffer_months: number;
      min_safety_buffer_ratio: number;
      retirement_years: number;
      total_years_simulated: number;
      traditional_fire_number: number;
      traditional_fire_achieved: boolean;
      fire_success_probability: number;
      yearly_results: {
        age: number;
        total_income: number;
        total_expense: number;
        investment_return: number;
        net_cash_flow: number;
        portfolio_value: number;
        net_worth: number;
        is_sustainable: boolean;
      }[];
    };
    monte_carlo_success_rate?: number;
    recommendations: any[];
    calculation_timestamp: string;
  };
  analysis_report: {
    user_profile: {
      current_age: number;
      fire_age: number;
      life_expectancy: number;
      current_net_worth: string;
      inflation_rate: string;
      safety_buffer_months: number;
    };
    fire_calculation: {
      is_achievable: boolean;
      achievable_text: string;
      net_worth_at_fire: string;
      min_net_worth_post_fire: string;
      final_net_worth: string;
      safety_buffer_ratio: string;
    };
    traditional_fire_metrics: {
      four_percent_rule_number: string;
      four_percent_rule_achieved: boolean;
      four_percent_rule_text: string;
    };
    monte_carlo_analysis: {
      success_rate: string;
      risk_assessment: string;
    };
    recommendations: {
      number: number;
      type: string;
      title: string;
      description: string;
      is_achievable: boolean;
      status: string;
      params: any;
    }[];
    key_insights: {
      years_until_fire: number;
      years_in_retirement: number;
      avg_annual_savings_needed?: string;
    };
    generation_timestamp: string;
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

function parseArgs(argv: string[]): CLIArgs {
  const args: CLIArgs = {
    quickMc: false,
    help: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case '--help':
      case '-h':
        args.help = true;
        break;
      case '--output':
      case '-o':
        args.output = argv[++i];
        break;
      case '--quick-mc':
        args.quickMc = true;
        break;
      default:
        if (!args.jsonFile && !arg.startsWith('-')) {
          args.jsonFile = arg;
        }
        break;
    }
  }

  return args;
}

function showHelp(): void {
  console.log(`
FIRE Planner - Calculate Financial Independence projections

Usage:
    npx tsx cli.ts [path_to_json_file]

Options:
    --quick-mc              Run quick Monte Carlo analysis with fewer simulations
    --output, -o <file>     Save results to JSON file
    --help, -h              Show this help message

Example usage:
    npx tsx cli.ts
    npx tsx cli.ts /path/to/my_plan.json
    npx tsx cli.ts --quick-mc --output results.json
`);
}

function printHeader(title: string, width = 80): void {
  console.log(`\n${'='.repeat(width)}`);
  console.log(title.padStart((width + title.length) / 2).padEnd(width));
  console.log('='.repeat(width));
}

function printSection(title: string, width = 60): void {
  console.log(`\n${'-'.repeat(width)}`);
  console.log(title);
  console.log(`${'-'.repeat(width)}`);
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function progressCallback(progress: number): void {
  // Convert progress to percentage for display
  const percentage = Math.round(progress * 100);
  if (percentage % 5 === 0 && percentage > 0) {
    // Show progress every 5%
    console.log(`    Progress: ${percentage}%`);
  }
}

// =============================================================================
// Main Functions (Direct ports from Python CLI)
// =============================================================================

function showPlanSummary(planner: FIREPlanner, jsonFile: string): boolean {
  console.log('📁 Loaded plan from:', jsonFile);

  try {
    console.log('✅ Successfully loaded configuration');
  } catch (error) {
    console.log(`❌ Error loading configuration: ${error}`);
    return false;
  }

  const profile = planner.data.user_profile;
  if (profile) {
    printSection('User Profile');
    const currentAge = new Date().getFullYear() - profile.birth_year;
    console.log(
      `Current Age: ${currentAge} → FIRE Age: ${profile.expected_fire_age} (Life: ${profile.life_expectancy})`
    );
    console.log(
      `Current Net Worth: ${formatCurrency(profile.current_net_worth)}`
    );
    console.log(
      `Inflation Rate: ${profile.inflation_rate}% | Safety Buffer: ${profile.safety_buffer_months} months`
    );
  }

  printSection('Income & Expense Summary');
  console.log(`Income Items: ${planner.data.income_items.length}`);
  console.log(`Expense Items: ${planner.data.expense_items.length}`);
  if (planner.data.overrides.length > 0) {
    console.log(`Overrides Applied: ${planner.data.overrides.length}`);
  }

  return true;
}

function runCalculations(planner: FIREPlanner): boolean {
  console.log('🔄 Setting up financial projections...');

  try {
    const df = planner.generateProjectionTable();
    console.log(
      `✅ Generated projection table with ${df.length} years of data`
    );
  } catch (error) {
    console.log(`❌ Error generating projection: ${error}`);
    return false;
  }

  return true;
}

async function runAnalysis(
  planner: FIREPlanner
): Promise<PlannerResults | null> {
  printHeader('FIRE ANALYSIS RESULTS');

  console.log('⚙️ Running FIRE calculations...');

  // Show simulation settings
  const settings = planner.getSimulationSettings();
  printSection('Monte Carlo Simulation Settings');
  console.log(`Number of Simulations: ${settings.num_simulations}`);
  console.log(`Confidence Level: ${settings.confidence_level}`);
  console.log(
    `Include Black Swan Events: ${settings.include_black_swan_events}`
  );
  console.log(`Income Volatility: ${settings.income_base_volatility}`);
  console.log(`Expense Volatility: ${settings.expense_base_volatility}`);

  let results: PlannerResults;
  try {
    results = await planner.runCalculations(progressCallback);
    console.log('\n✅ Calculations completed successfully');
  } catch (error) {
    console.log(`❌ Error during calculations: ${error}`);
    return null;
  }

  printSection('FIRE Calculation Results');
  const fireResult = results.fire_calculation;

  console.log(
    `🎯 FIRE Achievable: ${fireResult.is_fire_achievable ? 'YES' : 'NO'}`
  );
  console.log(
    `💰 Net Worth at FIRE Age: ${formatCurrency(fireResult.fire_net_worth)}`
  );
  console.log(
    `📉 Minimum Net Worth (Post-FIRE): ${formatCurrency(
      fireResult.min_net_worth_after_fire
    )}`
  );
  console.log(
    `💵 Final Net Worth: ${formatCurrency(fireResult.final_net_worth)}`
  );
  console.log(`🛡️ Safety Buffer (months): ${fireResult.safety_buffer_months}`);
  console.log(
    `📊 Min Safety Buffer Ratio: ${fireResult.min_safety_buffer_ratio.toFixed(
      2
    )}`
  );

  printSection('Traditional FIRE Metrics');
  console.log(
    `4% Rule FIRE Number: ${formatCurrency(fireResult.traditional_fire_number)}`
  );
  console.log(
    `4% Rule Achieved: ${fireResult.traditional_fire_achieved ? 'YES' : 'NO'}`
  );

  printSection('Monte Carlo Risk Analysis');
  if (results.monte_carlo_success_rate !== undefined) {
    const successRate = results.monte_carlo_success_rate;
    console.log(`🎲 Success Rate: ${(successRate * 100).toFixed(2)}%`);

    let riskLevel: string;
    if (successRate >= 0.9) {
      riskLevel = '🟢 LOW RISK';
    } else if (successRate >= 0.7) {
      riskLevel = '🟡 MEDIUM RISK';
    } else {
      riskLevel = '🔴 HIGH RISK';
    }

    console.log(`📈 Risk Assessment: ${riskLevel}`);
  } else {
    console.log('⚠️ Monte Carlo simulation not available');
  }

  printSection('Recommendations');
  if (results.recommendations && results.recommendations.length > 0) {
    for (let i = 0; i < results.recommendations.length; i++) {
      const recDict = results.recommendations[i];
      const achievableStatus = recDict.is_achievable ? '✅' : '❌';
      const recType = recDict.type;
      const params = recDict.params;

      // Create title and description based on type (matching Python logic)
      let title: string;
      let description: string;

      switch (recType) {
        case 'early_retirement':
          title = `Early Retirement at Age ${params.age}`;
          description = `You can retire ${params.years} year(s) earlier at age ${params.age}.`;
          break;
        case 'delayed_retirement':
          title = `Delayed Retirement to Age ${params.age}`;
          description = `Delay retirement by ${params.years} year(s) to age ${params.age}.`;
          break;
        case 'delayed_retirement_not_feasible':
          title = 'Delayed Retirement Not Feasible';
          description = `Even delaying to legal retirement age (${params.age}) would not achieve FIRE.`;
          break;
        case 'increase_income':
          title = `Increase Income by ${
            params.percentage?.toFixed(1) || 'N/A'
          }%`;
          description = `Increase income by ${
            params.percentage?.toFixed(1) || 'N/A'
          }% ($${params.amount?.toLocaleString() || '0'} annually).`;
          break;
        case 'reduce_expenses':
          title = `Reduce Expenses by ${
            params.percentage?.toFixed(1) || 'N/A'
          }%`;
          description = `Reduce expenses by ${
            params.percentage?.toFixed(1) || 'N/A'
          }% ($${params.amount?.toLocaleString() || '0'} annually).`;
          break;
        default:
          title = `Unknown recommendation: ${recType}`;
          description = `Parameters: ${JSON.stringify(params)}`;
          break;
      }

      console.log(`${i + 1}. ${achievableStatus} ${title}`);
      console.log(`   ${description}`);

      const monteCarloRate = recDict.monte_carlo_success_rate;
      if (monteCarloRate !== undefined) {
        console.log(`   Success Rate: ${(monteCarloRate * 100).toFixed(1)}%`);
      }
    }
  } else {
    console.log('No specific recommendations available');
  }

  // Additional analysis
  printSection('Key Insights');
  const currentAge =
    new Date().getFullYear() - planner.data.user_profile!.birth_year;
  const fireAge = planner.data.user_profile!.expected_fire_age;
  const yearsToFire = fireAge - currentAge;
  const retirementYears = fireResult.retirement_years;

  console.log(`⏰ Years until FIRE: ${yearsToFire}`);
  console.log(`🏖️ Years in retirement: ${retirementYears}`);

  if (fireResult.is_fire_achievable && yearsToFire > 0) {
    const annualSavingsNeeded =
      (fireResult.fire_net_worth -
        planner.data.user_profile!.current_net_worth) /
      yearsToFire;
    console.log(
      `💸 Average annual savings needed: ${formatCurrency(annualSavingsNeeded)}`
    );
  }

  console.log('\n✅ Stage 3 Complete: Analysis finished');
  return results;
}

function saveResultsToFile(
  planner: FIREPlanner,
  results: PlannerResults,
  outputPath: string
): void {
  // Generate formatted analysis report (matching Python implementation)
  const analysisReport = generateAnalysisReport(planner, results);

  // Create comprehensive output with results (matching Python structure)
  const outputData: CLIOutput = {
    metadata: {
      export_timestamp: new Date().toISOString(),
      export_type: 'fire_analysis_results',
      description:
        'Complete FIRE analysis results including calculations, projections, and recommendations',
    },
    input_configuration: planner.exportToConfig(
      `FIRE Results - ${new Date().toISOString()}`
    ),
    results: {
      fire_calculation: {
        is_fire_achievable: results.fire_calculation.is_fire_achievable,
        fire_net_worth: results.fire_calculation.fire_net_worth,
        min_net_worth_after_fire:
          results.fire_calculation.min_net_worth_after_fire,
        final_net_worth: results.fire_calculation.final_net_worth,
        safety_buffer_months: results.fire_calculation.safety_buffer_months,
        min_safety_buffer_ratio:
          results.fire_calculation.min_safety_buffer_ratio,
        retirement_years: results.fire_calculation.retirement_years,
        total_years_simulated: results.fire_calculation.total_years_simulated,
        traditional_fire_number:
          results.fire_calculation.traditional_fire_number,
        traditional_fire_achieved:
          results.fire_calculation.traditional_fire_achieved,
        fire_success_probability:
          results.fire_calculation.fire_success_probability,
        yearly_results: results.fire_calculation.yearly_results.map(state => ({
          age: state.age,
          total_income: state.total_income,
          total_expense: state.total_expense,
          investment_return: state.investment_return,
          net_cash_flow: state.net_cash_flow,
          portfolio_value: state.portfolio_value,
          net_worth: state.net_worth,
          is_sustainable: state.is_sustainable,
        })),
      },
      monte_carlo_success_rate: results.monte_carlo_success_rate,
      recommendations: results.recommendations || [],
      calculation_timestamp: results.calculation_timestamp.toISOString(),
    },
    analysis_report: analysisReport,
  };

  // Save to file
  try {
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), 'utf-8');
    console.log(`\n💾 Results saved to: ${outputPath}`);
  } catch (error) {
    console.error(`Error saving results to ${outputPath}:`, error);
    process.exit(1);
  }
}

function generateAnalysisReport(
  planner: FIREPlanner,
  results: PlannerResults
): CLIOutput['analysis_report'] {
  const fireResult = results.fire_calculation;
  const profile = planner.data.user_profile!;
  const currentAge = new Date().getFullYear() - profile.birth_year;

  // User profile summary
  const userSummary = {
    current_age: currentAge,
    fire_age: profile.expected_fire_age,
    life_expectancy: profile.life_expectancy,
    current_net_worth: formatCurrency(profile.current_net_worth),
    inflation_rate: `${profile.inflation_rate}%`,
    safety_buffer_months: profile.safety_buffer_months,
  };

  // FIRE calculation summary
  const fireSummary = {
    is_achievable: fireResult.is_fire_achievable,
    achievable_text: fireResult.is_fire_achievable ? '✅ YES' : '❌ NO',
    net_worth_at_fire: formatCurrency(fireResult.fire_net_worth),
    min_net_worth_post_fire: formatCurrency(
      fireResult.min_net_worth_after_fire
    ),
    final_net_worth: formatCurrency(fireResult.final_net_worth),
    safety_buffer_ratio: fireResult.min_safety_buffer_ratio.toFixed(2),
  };

  // Traditional FIRE metrics
  const traditionalMetrics = {
    four_percent_rule_number: formatCurrency(
      fireResult.traditional_fire_number
    ),
    four_percent_rule_achieved: fireResult.traditional_fire_achieved,
    four_percent_rule_text: fireResult.traditional_fire_achieved
      ? '✅ YES'
      : '❌ NO',
  };

  // Monte Carlo analysis
  const mcSuccessRate = results.monte_carlo_success_rate || 0.0;
  const riskAssessment =
    mcSuccessRate < 0.7
      ? '🔴 HIGH RISK'
      : mcSuccessRate < 0.9
        ? '🟡 MODERATE RISK'
        : '🟢 LOW RISK';

  const monteCarloSummary = {
    success_rate: `${(mcSuccessRate * 100).toFixed(2)}%`,
    risk_assessment: riskAssessment,
  };

  // Format recommendations
  const recommendationsFormatted = (results.recommendations || []).map(
    (rec, i) => {
      const recType = rec.type;
      const params = rec.params;
      let title: string;
      let description: string;

      switch (recType) {
        case 'early_retirement':
          title = `Early Retirement at Age ${params.age}`;
          description = `You can retire ${params.years} year(s) earlier at age ${params.age}.`;
          break;
        case 'delayed_retirement':
          title = `Delayed Retirement to Age ${params.age}`;
          description = `Delay retirement by ${params.years} year(s) to age ${params.age}.`;
          break;
        case 'delayed_retirement_not_feasible':
          title = 'Delayed Retirement Not Feasible';
          description = `Even delaying to legal retirement age (${params.age}) would not achieve FIRE.`;
          break;
        case 'increase_income':
          title = `Increase Income by ${
            params.percentage?.toFixed(1) || 'N/A'
          }%`;
          description = `Increase income by ${
            params.percentage?.toFixed(1) || 'N/A'
          }% ($${params.amount?.toLocaleString() || '0'} annually).`;
          break;
        case 'reduce_expenses':
          title = `Reduce Expenses by ${
            params.percentage?.toFixed(1) || 'N/A'
          }%`;
          description = `Reduce expenses by ${
            params.percentage?.toFixed(1) || 'N/A'
          }% ($${params.amount?.toLocaleString() || '0'} annually).`;
          break;
        default:
          title = `Recommendation ${i + 1}`;
          description = 'Details not available';
          break;
      }

      return {
        number: i + 1,
        type: recType,
        title,
        description,
        is_achievable: rec.is_achievable,
        status: rec.is_achievable ? '✅' : '❌',
        params,
      };
    }
  );

  // Key insights
  const yearsToFire = profile.expected_fire_age - currentAge;
  const retirementYears = fireResult.retirement_years;

  const keyInsights: any = {
    years_until_fire: yearsToFire,
    years_in_retirement: retirementYears,
  };

  // Additional calculations if plan is achievable
  if (fireResult.is_fire_achievable && yearsToFire > 0) {
    const annualSavingsNeeded =
      (fireResult.fire_net_worth - profile.current_net_worth) / yearsToFire;
    keyInsights.avg_annual_savings_needed = formatCurrency(annualSavingsNeeded);
  }

  return {
    user_profile: userSummary,
    fire_calculation: fireSummary,
    traditional_fire_metrics: traditionalMetrics,
    monte_carlo_analysis: monteCarloSummary,
    recommendations: recommendationsFormatted,
    key_insights: keyInsights,
    generation_timestamp: new Date().toISOString(),
  };
}

// =============================================================================
// Main Function
// =============================================================================

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.help) {
    showHelp();
    return;
  }

  // Determine JSON file path
  let jsonFile: string;
  if (args.jsonFile) {
    jsonFile = path.resolve(args.jsonFile);
  } else {
    jsonFile = path.resolve(
      __dirname,
      '..',
      'example_fire_plan_predefined.json'
    );
  }

  if (!fs.existsSync(jsonFile)) {
    console.error(`❌ Error: File not found: ${jsonFile}`);
    process.exit(1);
  }

  printHeader('🔥 FIRE PLANNER 🔥');
  console.log(`Calculating FIRE projections from: ${path.basename(jsonFile)}`);
  console.log(`Timestamp: ${new Date().toLocaleString()}`);

  // Initialize planner
  let planner: FIREPlanner;
  try {
    const jsonContent = fs.readFileSync(jsonFile, 'utf-8');
    planner = createPlannerFromJSON(jsonContent);

    if (args.quickMc) {
      // Set quick simulation settings
      const quickSettings = createSimulationSettings({
        num_simulations: 200,
        confidence_level: 0.95,
        include_black_swan_events: true,
      });
      planner.setSimulationSettings(quickSettings);
    }
  } catch (error) {
    console.error(`❌ Error loading planner configuration: ${error}`);
    process.exit(1);
  }

  try {
    // Load plan and show summary
    printHeader('FIRE PLAN SUMMARY');
    if (!showPlanSummary(planner, jsonFile)) {
      process.exit(1);
    }

    // Run calculations
    if (!runCalculations(planner)) {
      process.exit(1);
    }

    // Run analysis and show results
    const results = await runAnalysis(planner);
    if (!results) {
      process.exit(1);
    }

    // Save results if requested
    if (args.output) {
      const outputPath = path.resolve(args.output);
      saveResultsToFile(planner, results, outputPath);
    }

    printHeader('✅ ANALYSIS COMPLETE');
    console.log('FIRE calculations completed successfully!');
  } catch (error) {
    if (error instanceof Error && error.message.includes('interrupted')) {
      console.log('\n\n⏹️ Analysis interrupted by user');
    } else {
      console.log(`\n\n❌ Unexpected error: ${error}`);
      process.exit(1);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ CLI error:', error);
    process.exit(1);
  });
}
