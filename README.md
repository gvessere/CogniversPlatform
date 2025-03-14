# Cognivers

## Quick Start

1. **Prerequisites**:
   - bash 4.0+
   - Coreutils (find, tee)

2. **Initial Setup**:
   ```bash
   cp .env.example .env  # Configure environment variables
   chmod +x scripts/*.sh  # Make scripts executable
   ```

3. **Run Security Scan**:
   ```bash
   ./scripts/file_scanner.sh ~/Documents/src/Cognivers
   # Verify:
   [ -f directory_structure.txt ] && echo "Scan complete" || echo "Scan failed"
   ```

4. **Run Test Suite**:
   ```bash
   ./test/test_exclusions.sh
   # Expected outcome: "Exclusion tests passed"
   ```
---
⚠️ **Security Note**: Never commit actual .env files. Use .env.example instead.

