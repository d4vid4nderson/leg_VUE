#!/usr/bin/env node

/**
 * Automated Version Update Script
 *
 * Updates the package.json version based on Azure Pipeline build number.
 * Versioning scheme: 1.1.{BUILD_NUMBER}
 *
 * Usage:
 *   node update-version.js [buildNumber]
 *
 * If no build number is provided, increments the patch version.
 */

const fs = require('fs');
const path = require('path');

// Read package.json
const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Get build number from command line args or environment variable
const buildNumber = process.argv[2] || process.env.BUILD_BUILDID || null;

// Parse current version
const currentVersion = packageJson.version;
const [major, minor, patch] = currentVersion.split('.').map(Number);

let newVersion;

if (buildNumber) {
  // Use build number as patch version for production builds
  newVersion = `${major}.${minor}.${buildNumber}`;
  console.log(`🔢 Using Azure Pipeline build number: ${buildNumber}`);
} else {
  // Increment patch version for local/manual builds
  newVersion = `${major}.${minor}.${patch + 1}`;
  console.log(`📦 No build number provided, incrementing patch version`);
}

// Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`✅ Version updated: ${currentVersion} → ${newVersion}`);
console.log(`📄 Updated file: ${packageJsonPath}`);

// Create a version info file for runtime access
const versionInfo = {
  version: newVersion,
  buildNumber: buildNumber || 'local',
  buildDate: new Date().toISOString(),
  previousVersion: currentVersion
};

const versionInfoPath = path.join(__dirname, 'src', 'version.json');
fs.writeFileSync(versionInfoPath, JSON.stringify(versionInfo, null, 2) + '\n');

console.log(`📋 Created version info: ${versionInfoPath}`);
console.log(JSON.stringify(versionInfo, null, 2));

// Exit successfully
process.exit(0);
