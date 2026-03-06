#!/bin/bash
# Atom CLI Update Script

echo "Updating Atom CLI..."

# Check if git repo
if [ ! -d ".git" ]; then
  echo "Error: Not a git repository"
  exit 1
fi

# Pull latest changes
echo "Pulling latest changes..."
git pull

# Clean stale npm temp directories if they exist (needs sudo due to permissions)
if ls node_modules/.atom-* 1> /dev/null 2>&1; then
  echo "Cleaning stale npm directories (requires sudo)..."
  sudo rm -rf node_modules/.atom-*
fi

# Update dependencies
echo "Updating dependencies..."
npm i

if [ $? -ne 0 ]; then
  echo ""
  echo "✗ npm install failed!"
  echo "This usually means dependencies couldn't be updated."
  echo ""
  echo "Try manually:"
  echo "  sudo rm -rf node_modules/.atom-*"
  echo "  npm install"
  echo ""
  exit 1
fi

# Reinstall globally
echo "Reinstalling globally..."
sudo npm install -g .

if [ $? -eq 0 ]; then
  echo ""
  echo "✓ Update complete!"
  echo "Version: $(node -p "require('./package.json').version")"
else
  echo ""
  echo "✗ Global install failed"
  exit 1
fi
