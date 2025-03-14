#!/bin/bash

# Create pre-commit hook directory if it doesn't exist
mkdir -p .git/hooks

# Create pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

# Get the list of staged Python files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.py$')

if [[ "$STAGED_FILES" = "" ]]; then
  # No Python files are staged, so we can skip type checking
  exit 0
fi

echo "Running type checking on staged Python files..."

# Run mypy on the entire codebase
./scripts/check_types.sh

# Check the exit code
if [ $? -ne 0 ]; then
  echo "❌ Type checking failed. Please fix the errors before committing."
  exit 1
fi

echo "✅ Type checking passed!"
exit 0
EOF

# Make the hook executable
chmod +x .git/hooks/pre-commit

echo "Git hooks have been set up successfully!"
echo "Type checking will now run automatically before each commit." 