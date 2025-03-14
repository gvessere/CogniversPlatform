#!/bin/bash

# Get the absolute path to the project directory
PROJECT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$PROJECT_DIR"

echo "Running mypy type checker..."

# Create mypy.ini if it doesn't exist
if [ ! -f mypy.ini ]; then
    echo "Creating mypy.ini..."
    cat > mypy.ini << 'EOF'
[mypy]
python_version = 3.11
warn_return_any = True
warn_unused_configs = True
disallow_untyped_defs = False
disallow_incomplete_defs = False
check_untyped_defs = True
disallow_untyped_decorators = False
no_implicit_optional = True
strict_optional = True
warn_redundant_casts = True
warn_unused_ignores = True
warn_no_return = True
warn_unreachable = True
namespace_packages = True
explicit_package_bases = True

# For third-party libraries without type hints
[mypy.sqlalchemy.*]
ignore_missing_imports = True

[mypy.fastapi.*]
ignore_missing_imports = True

[mypy.pydantic.*]
ignore_missing_imports = True

[mypy.jose.*]
ignore_missing_imports = True

[mypy.argon2.*]
ignore_missing_imports = True
EOF
fi

echo "Running mypy with namespace packages mode to avoid module resolution issues..."
mypy --namespace-packages --explicit-package-bases . --config-file mypy.ini

# Check the exit code
if [ $? -eq 0 ]; then
    echo "✅ Type checking passed!"
    exit 0
else
    echo "❌ Type checking failed. Please fix the errors above."
    exit 1
fi 