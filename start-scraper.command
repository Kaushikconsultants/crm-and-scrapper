#!/usr/bin/env bash
echo "==================================================="
echo "    Starting GMB Scraper Control Panel..."
echo "==================================================="
echo ""

# Ensure we are in the script's directory
cd "$(dirname "$0")"

# Check if Node.js is installed
if ! command -v node &> /dev/null
then
    echo "ERROR: Node.js is not installed!"
    echo "Please download and install the LTS version from: https://nodejs.org/"
    echo "Once installed, double-click this file again."
    read -p "Press [Enter] to exit..."
    exit
fi

echo "Installing dependencies (if needed)..."
npm install

echo "Starting the application..."
npm run dev
