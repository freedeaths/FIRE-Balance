# FIRE Balance Calculator - TypeScript Implementation

A modern, responsive web application for Financial Independence, Retire Early (FIRE) planning, built with React, TypeScript, and best practices.

## 🚀 Features

- **💰 Complete FIRE Planning**: 3-stage planning process from data input to advanced analysis
- **📱 Progressive Web App**: Installable, offline-capable, responsive design
- **🌍 Multi-language**: English, Chinese, Japanese support
- **📊 Advanced Analytics**: Monte Carlo simulations, risk analysis, recommendation engine
- **🎨 Modern UI**: Mantine components, Tailwind CSS, responsive design
- **⚡ High Performance**: Vite build system, code splitting, optimized bundles

## 🏗️ Architecture & Best Practices

### Technology Stack

- **Framework**: React 18+ with TypeScript 5+
- **Build Tool**: Vite 5+ with PWA plugin
- **UI Library**: Mantine 8+ components
- **Styling**: Tailwind CSS with custom design system
- **Testing**: Jest + React Testing Library
- **Code Quality**: ESLint + Prettier with strict rules
- **PWA**: Service worker, offline support, installable

### Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Basic UI elements (Button, Input, etc.)
│   ├── forms/          # Form components
│   ├── charts/         # Chart components
│   └── layout/         # Layout components
├── pages/              # Page components (Stage1, Stage2, Stage3)
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
├── types/              # TypeScript type definitions
├── core/               # Business logic (ported from Python)
│   ├── models/         # Data models
│   ├── engine/         # Calculation engine
│   ├── portfolio/      # Portfolio management
│   └── monteCarlo/     # Monte Carlo simulation
├── assets/             # Static assets
└── __tests__/          # Test files
```

### Code Organization Philosophy

1. **Function-to-Function Porting**: Direct TypeScript equivalents of Python functions
2. **Separation of Concerns**: UI components separate from business logic
3. **Type Safety**: Comprehensive TypeScript types for all data
4. **Component Composition**: Small, reusable, testable components
5. **Custom Hooks**: Reusable logic extraction
6. **Path Aliases**: Clean imports using @ prefixes

## 🛠️ Development Setup

### Prerequisites

- Node.js 20.10.0+
- npm 10.2.3+

### Installation

```bash
cd implementations/typescript
npm install
```

### Development Commands

```bash
# Start development server (http://localhost:3000)
npm run dev

# Type checking
npm run type-check

# Linting and formatting
npm run lint          # Check for lint errors
npm run lint:fix      # Auto-fix lint errors
npm run format        # Format code with Prettier
npm run format:check  # Check formatting

# Testing
npm run test          # Run tests once
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
npm run test:ui       # Interactive test runner

# Build for production
npm run build         # Create optimized production build
npm run preview       # Preview production build locally

# Utilities
npm run clean         # Clean build artifacts
npm run prepare       # Full quality check (lint + type + test)
```

## 📱 Responsive Design

### Breakpoint System

- **xs**: 480px+ (Large phones)
- **sm**: 640px+ (Small tablets)
- **md**: 768px+ (Tablets)
- **lg**: 1024px+ (Laptops/Desktops)
- **xl**: 1280px+ (Large desktops)
- **2xl**: 1536px+ (Extra large desktops)

### Mobile-First Approach

All components are designed mobile-first with progressive enhancement for larger screens.

## 🎨 Design System

### Color Palette

- **Primary**: Orange theme (#f97316) for brand and actions
- **Success**: Green for positive financial outcomes
- **Warning**: Yellow for caution and alerts
- **Danger**: Red for problems and errors
- **Neutral**: Gray scale for text and backgrounds

### Component Guidelines

- **Accessibility**: WCAG 2.1 AA compliance
- **Consistency**: Follow Mantine design principles
- **Responsiveness**: Mobile-first, touch-friendly
- **Performance**: Lazy loading, code splitting

## 🧪 Testing Strategy

### Testing Philosophy

- **Unit Tests**: Individual functions and components
- **Integration Tests**: Component interactions and user flows
- **Accessibility Tests**: Screen reader and keyboard navigation
- **Visual Regression**: Component appearance consistency

### Test Coverage Goals

- **Branches**: 70%+
- **Functions**: 70%+
- **Lines**: 70%+
- **Statements**: 70%+

## 📦 Build & Deployment

### Build Optimization

- **Code Splitting**: Automatic vendor/library chunking
- **Tree Shaking**: Dead code elimination
- **Bundle Analysis**: Webpack bundle analyzer
- **PWA**: Service worker for offline functionality

### Performance Targets

- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Time to Interactive**: < 3.0s
- **Lighthouse Score**: 90+ (Performance, Accessibility, Best Practices, SEO)

## 🔗 Integration with Python Implementation

### Algorithm Consistency

All financial calculations are direct ports from the Python implementation to ensure:

- Identical results across platforms
- Consistent business logic
- Shared test cases for validation
- Cross-reference testing capabilities

### Shared Resources

- **i18n Files**: Reuse translation JSON from `/shared/i18n/`
- **Test Data**: Common test cases for algorithm validation
- **Documentation**: Shared user guides and API documentation

## 🚀 Future Enhancements

- [ ] Real-time data integration (stock prices, inflation rates)
- [ ] Advanced portfolio optimization algorithms
- [ ] Social features (plan sharing, community insights)
- [ ] Mobile app version (React Native)
- [ ] Advanced data visualization and reporting
- [ ] Integration with financial institutions APIs

## 📚 Learning Resources

This implementation follows modern React best practices and serves as a learning resource for:

- TypeScript with React development
- Progressive Web App implementation
- Responsive design with Tailwind CSS
- Test-driven development with Jest
- Modern build tooling with Vite
- Code quality with ESLint/Prettier

## 🤝 Contributing

1. Follow the existing code style and conventions
2. Write comprehensive tests for new features
3. Update documentation for API changes
4. Ensure cross-platform algorithm consistency
5. Maintain responsive design compatibility
