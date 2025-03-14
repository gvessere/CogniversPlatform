#!/bin/sh

# Environment file checks
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "Created .env from .env.example"
    else
        echo "MISSING .env.example" >&amp;2
        exit 1
    fi
fi

# Code verification
if ! grep -q 'os.getenv("JWT_SECRET_KEY")' api/main.py; then
    echo "JWT_SECRET_KEY not using environment variable" >&amp;2
    exit 1
fi

echo "All security checks passed"

