#!/bin/bash
# Test exclusion patterns work as expected
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

# Create test files
mkdir -p "$TEMP_DIR/.env" "$TEMP_DIR/secret" \
  "$TEMP_DIR/node_modules" "$TEMP_DIR/project"
touch "$TEMP_DIR/.env/production" \
  "$TEMP_DIR/secret/password.txt" \
  "$TEMP_DIR/project/main.go"

# Run scanner
output=$(mktemp)
./scripts/file_scanner.sh "$TEMP_DIR" "$output"

# Verify exclusions
! grep -q ".env" "$output" || exit 1 
! grep -q "node_modules" "$output" || exit 2
grep -q "project/main.go" "$output" || exit 3

echo "Exclusion tests passed"

