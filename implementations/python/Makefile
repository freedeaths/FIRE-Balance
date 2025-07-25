# FIRE Balance Calculator - Python Implementation
# Development tools and commands

.PHONY: help install install-dev check fmt lint test clean all

# Default target
help:
	@echo "Available commands:"
	@echo "  install        Install production dependencies"
	@echo "  install-dev    Install development dependencies"
	@echo "  all            Run complete development workflow (fmt + lint + test)"
	@echo "  check          Run all checks (lint + type check)"
	@echo "  fmt            Format code (autoflake + isort + black)"
	@echo "  lint           Run linting (flake8 + mypy)"
	@echo "  test           Run tests with pytest"
	@echo "  clean          Clean up cache and temporary files"
	@echo ""
	@echo "Note: Pre-commit hooks are configured at project root level"
	@echo "Run 'cd ../.. && pre-commit install' to set up pre-commit hooks"

# Install dependencies
install:
	pip install -r requirements.txt

install-dev:
	pip install -r requirements.txt
	pip install -r dev-requirements.txt

# Format code
fmt:
	@echo "🧹 Removing unused imports..."
	python -m autoflake --remove-all-unused-imports --recursive --remove-unused-variables --in-place --exclude=__pycache__ .
	@echo "📦 Sorting imports..."
	python -m isort .
	@echo "🎨 Formatting code..."
	python -m black .
	@echo "✅ Code formatting complete!"

# Lint and type check
lint:
	@echo "🔍 Running flake8..."
	python -m flake8 .
	@echo "🔍 Running mypy..."
	python -m mypy .
	@echo "✅ Linting complete!"

# Run all checks
check: lint
	@echo "✅ All checks passed!"

# Run tests
test:
	@echo "🧪 Running tests..."
	python -m pytest
	@echo "✅ Tests complete!"

# Clean up cache and temporary files
clean:
	@echo "🧹 Cleaning up..."
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	@echo "✅ Cleanup complete!"

# All-in-one development workflow
all: fmt lint test
	@echo "🎉 All development tasks complete! (format + lint + test)"

# CI/CD targets (used by GitHub Actions and pre-commit)
ci-check: lint test
	@echo "✅ CI checks passed!"
