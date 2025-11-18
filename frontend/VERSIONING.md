# Automated Versioning System

## Overview

LegislativeVUE uses an automated versioning system that increments the application version with each production deployment to Azure.

## Version Format

**Version Format:** `MAJOR.MINOR.BUILD_NUMBER`

- **MAJOR**: 1 (incremented for major releases with breaking changes)
- **MINOR**: 1 (incremented for feature releases)
- **BUILD_NUMBER**: Azure Pipeline Build ID (auto-incremented with each deployment)

**Example Versions:**
- `1.1.100` - Build #100
- `1.1.101` - Build #101
- `1.1.102` - Build #102

## How It Works

### Automated Pipeline Process

1. **Pre-Build Step**: Azure Pipeline runs `update-version.js` before building the frontend
2. **Version Update**: Script updates `package.json` with new version: `1.1.{BUILD_ID}`
3. **Build Process**: Docker image is built with the updated version
4. **Deployment**: Version is deployed and visible in the footer

### Manual Version Updates

For local development or manual version changes:

```bash
cd frontend
node update-version.js [buildNumber]
```

If no build number is provided, the patch version increments by 1.

## Version Display

The current version is displayed in the application footer:

**Footer Text:** `© 2025 Built with ❤️ by MOREgroup Solutions Development. All rights reserved. Version: 1.1.XXX`

## Files Involved

### Primary Files
- **`package.json`**: Contains the current version number
- **`update-version.js`**: Script that updates the version
- **`src/version.json`**: Auto-generated version metadata (git-ignored)

### Configuration
- **`azure-pipelines.yml`**: Pipeline configuration with version update step
- **`.gitignore`**: Excludes auto-generated `version.json`

## Version Metadata

The `update-version.js` script creates a `src/version.json` file with detailed version info:

```json
{
  "version": "1.1.100",
  "buildNumber": "100",
  "buildDate": "2025-11-18T20:00:00.000Z",
  "previousVersion": "1.1.99"
}
```

This file can be imported for runtime version checks or debugging.

## Incrementing Major or Minor Versions

To increment the major or minor version:

1. Manually edit `package.json` to set the new base version
2. Commit and push the change
3. The build number will continue auto-incrementing from the new base

**Example:**
```json
{
  "version": "1.2.0"  // Changed from 1.1.0
}
```

Next build will become `1.2.{BUILD_ID}`

## Version History

- **v1.0.0** - Initial release version
- **v1.1.0** - Automated versioning system implemented
- **v1.1.X** - Auto-incremented production builds

## Troubleshooting

### Version Not Updating

1. Check Azure Pipeline logs for the "Update version number" step
2. Verify `update-version.js` has no syntax errors
3. Ensure Node.js 18.x is installed in the pipeline

### Version Shows as 1.0.0

1. Clear browser cache
2. Verify the build completed successfully
3. Check that the Docker image was rebuilt with new version

### Local Development Version

During local development (`npm run dev`), the version comes from `package.json`. To test version updates locally:

```bash
node update-version.js 9999
npm run dev
```

## Best Practices

1. **Don't manually edit version in package.json** except for major/minor changes
2. **Let the pipeline handle patch versions** (build numbers)
3. **Document version changes** in commit messages when changing major/minor
4. **Monitor version in footer** after each deployment to confirm updates

## Questions?

Contact MOREgroup Solutions Development team for assistance with versioning.
