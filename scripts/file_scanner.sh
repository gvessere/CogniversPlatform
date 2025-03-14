#!/bin/bash
# Safely scan directories excluding sensitive paths
SCAN_ROOT="$1"
OUTPUT_FILE="${2:-directory_structure.txt}"

find "$SCAN_ROOT" -type d \( -name node_modules -o -name .git -o -name .env\* \) -prune -o -print \
  | tee "$OUTPUT_FILE"

[ -s "$OUTPUT_FILE" ] || { echo "No files scanned"; exit 1; }
grep -vq ".env" "$OUTPUT_FILE" || { echo "ERROR: .env files detected in output"; exit 2; }

