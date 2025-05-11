#!/usr/bin/env bash
set -e

# --------------------------------------------------------------------------
# init_git.sh: Initialize Git repository with .gitignore and initial commit
# Usage:
#   chmod +x init_git.sh
#   ./init_git.sh
# --------------------------------------------------------------------------

# Check if already a git repo
if [ ! -d .git ]; then
  echo "🟢 Initializing new Git repository..."
  git init

  echo "📝 Creating .gitignore..."
  cat > .gitignore << 'EOF'
# Python
__pycache__/
*.py[cod]
# Poetry
poetry.lock
# Node
node_modules/
dist/
# Editor directories
.vscode/
.idea/
# Logs and environment files
*.log
*.env
EOF

  echo "✅ Staging .gitignore and committing..."
  git add .gitignore
  git commit -m "chore: initialize repository with .gitignore"

  echo "🎉 Git repository initialized with initial commit."
  echo
  echo "Next steps:" 
  echo "  1. Stage all your project files: git add ."
  echo "  2. Commit: git commit -m 'feat: initial scaffold'"
  echo "  3. Create remote repo on GitHub/Azure DevOps and get its URL"
  echo "  4. Add remote: git remote add origin <YOUR_REMOTE_URL>"
  echo "  5. Rename branch to main: git branch -M main"
  echo "  6. Push: git push -u origin main"
else
  echo "⚠️ Git repository already initialized."
  echo "To proceed, add remote and push your commits:"
  echo "  git remote add origin <YOUR_REMOTE_URL>"
  echo "  git branch -M main"
  echo "  git push -u origin main"
fi
