#!/bin/bash
set -e

# Create secure directory for keys
mkdir -p .sops

# Generate age encryption keypair
age-keygen -o .sops/keys.txt

# Restrict access to private key
chmod 600 .sops/keys.txt

# Extract public key for SOPS config
grep "public key: " .sops/keys.txt | awk '{print $3}' > .sops/public_key.txt

echo "✅ Keys generated - private: .sops/keys.txt | public: .sops/public_key.txt"

