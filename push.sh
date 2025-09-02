#!/usr/bin/env bash
set -euo pipefail
git init
git branch -m main || true
git add .
git commit -m "Initial commit"
# Replace YOURUSER with your GitHub username first:
git remote add origin https://github.com/YOURUSER/Max.git
git push -u origin main
