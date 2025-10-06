# CI/CD Documentation

This project uses GitHub Actions for continuous integration and deployment, automatically building and publishing Docker images to GitHub Container Registry (ghcr.io).

## Workflows

### 1. CI Pipeline (`.github/workflows/ci.yml`)

Runs on every push and pull request to `main` and `develop` branches.

**Jobs:**

- **Lint and Test**
  - Runs on 22.x
  - Installs dependencies
  - Runs TypeScript compilation checks
  - Builds the project
  - Archives build artifacts

- **Security Scan**
  - Runs Trivy vulnerability scanner
  - Uploads results to GitHub Security tab
  - Scans for security issues in dependencies

- **Docker Build Test**
  - Builds Docker image without pushing
  - Tests the built image
  - Validates Docker build process

### 2. Docker Publish (`.github/workflows/docker-publish.yml`)

Automatically builds and publishes Docker images on:
- Push to `main` or `develop` branches
- Tagged releases (`v*.*.*`)
- Manual workflow dispatch

**Features:**

- Multi-platform builds (linux/amd64, linux/arm64)
- Automatic tagging:
  - Branch name for branch pushes
  - Semantic version tags for releases
  - `latest` tag for main branch
  - SHA-based tags
- Build caching for faster builds
- Artifact attestation for supply chain security

**Published Images:**
```
ghcr.io/<username>/<repository>:latest
ghcr.io/<username>/<repository>:main
ghcr.io/<username>/<repository>:develop
ghcr.io/<username>/<repository>:v1.0.0
ghcr.io/<username>/<repository>:v1.0
ghcr.io/<username>/<repository>:v1
```

### 3. Release Workflow (`.github/workflows/release.yml`)

Triggered when a version tag is pushed (e.g., `v1.0.0`).

**Jobs:**

- **Create Release**
  - Builds the project
  - Creates release archives (tar.gz, zip)
  - Generates changelog
  - Creates GitHub Release with artifacts

- **Publish Docker**
  - Builds multi-platform Docker images
  - Publishes to GitHub Container Registry
  - Tags with semantic versions
  - Generates artifact attestations

### 4. Dependabot (`.github/dependabot.yml`)

Automated dependency updates for:
- npm packages (weekly)
- GitHub Actions (weekly)
- Docker base images (weekly)

## Setup Instructions

### 1. Repository Settings

No additional secrets needed! The workflows use `GITHUB_TOKEN` which is automatically available.

**Enable GitHub Container Registry:**

1. Go to your repository settings
2. Navigate to **Actions** → **General**
3. Scroll to **Workflow permissions**
4. Select "Read and write permissions"
5. Check "Allow GitHub Actions to create and approve pull requests"
6. Click Save

### 2. Package Visibility

After the first successful workflow run:

1. Go to your profile/organization packages
2. Find the `web-search-mcp` package
3. Click on it and go to **Package settings**
4. Change visibility to **Public** (if desired)
5. Link to repository if not automatically linked

### 3. Creating a Release

To create a new release and trigger the release workflow:

```bash
# Tag the release
git tag v1.0.0

# Push the tag
git push origin v1.0.0
```

Or use GitHub's UI:
1. Go to **Releases** → **Create a new release**
2. Create a new tag (e.g., `v1.0.0`)
3. Add release notes
4. Publish release

### 4. Manual Workflow Trigger

You can manually trigger the Docker publish workflow:

1. Go to **Actions** tab
2. Select "Build and Publish Docker Image"
3. Click "Run workflow"
4. Select branch
5. Click "Run workflow"

## Using Published Images

### Pull the Latest Image

```bash
docker pull ghcr.io/<username>/web-search-mcp:latest
```

### Pull a Specific Version

```bash
docker pull ghcr.io/<username>/web-search-mcp:v1.0.0
```

### Run the Container

```bash
docker run -d \
  -p 3000:3000 \
  -e GOOGLE_CSE_KEY=your_key \
  -e GOOGLE_CSE_CX=your_cx \
  ghcr.io/<username>/web-search-mcp:latest
```

### Docker Compose

```yaml
version: '3.8'

services:
  web-search-mcp:
    image: ghcr.io/<username>/web-search-mcp:latest
    ports:
      - "3000:3000"
    environment:
      - GOOGLE_CSE_KEY=${GOOGLE_CSE_KEY}
      - GOOGLE_CSE_CX=${GOOGLE_CSE_CX}
    restart: unless-stopped
```

## Authentication for Private Images

If your package is private:

```bash
# Create a personal access token with read:packages scope
echo $GITHUB_TOKEN | docker login ghcr.io -u <username> --password-stdin

# Pull the image
docker pull ghcr.io/<username>/web-search-mcp:latest
```

## Workflow Status Badges

Add these badges to your README.md:

```markdown
![CI](https://github.com/<username>/<repository>/actions/workflows/ci.yml/badge.svg)
![Docker Publish](https://github.com/<username>/<repository>/actions/workflows/docker-publish.yml/badge.svg)
![Release](https://github.com/<username>/<repository>/actions/workflows/release.yml/badge.svg)
```

## Image Tags Strategy

| Tag Pattern | Description | Example |
|-------------|-------------|---------|
| `latest` | Latest stable release from main | `latest` |
| `main` | Latest commit on main branch | `main` |
| `develop` | Latest commit on develop branch | `develop` |
| `v{major}.{minor}.{patch}` | Specific version | `v1.2.3` |
| `v{major}.{minor}` | Minor version | `v1.2` |
| `v{major}` | Major version | `v1` |
| `{branch}-{sha}` | Commit-specific | `main-abc123` |

## Build Cache

The workflows use GitHub Actions cache to speed up builds:
- Docker layer caching
- Node modules caching
- Build artifact caching

This reduces build times significantly for subsequent runs.

## Security Features

### 1. Trivy Security Scanning

Automatically scans for:
- Known vulnerabilities in dependencies
- Misconfigurations
- Security issues in Docker images

Results are uploaded to GitHub Security tab.

### 2. Artifact Attestation

Build provenance is generated and attached to published images, providing:
- Verification of build source
- Build environment details
- Supply chain security

### 3. Dependabot

Automated security updates for:
- npm dependencies
- GitHub Actions
- Docker base images

## Troubleshooting

### Docker Build Fails

**Issue:** Build fails with "permission denied"

**Solution:** Check repository settings → Actions → Workflow permissions

### Package Not Visible

**Issue:** Can't find published package

**Solution:** 
1. Check workflow logs for errors
2. Verify package visibility settings
3. Ensure workflow completed successfully

### Authentication Issues

**Issue:** Can't pull private images

**Solution:**
```bash
# Create token at: https://github.com/settings/tokens
# Scope: read:packages
echo $TOKEN | docker login ghcr.io -u <username> --password-stdin
```

### Multi-platform Build Fails

**Issue:** ARM64 build fails

**Solution:** This is expected in some environments. You can modify the workflow to only build for amd64:

```yaml
platforms: linux/amd64
```

## Monitoring

### View Workflow Runs

1. Go to **Actions** tab
2. Select a workflow
3. Click on a run to see details
4. Review logs for each job

### Package Statistics

View package downloads and usage:
1. Go to **Packages**
2. Select your package
3. View insights and statistics

## Best Practices

1. **Semantic Versioning:** Use proper version tags (v1.0.0)
2. **Changelog:** Maintain a CHANGELOG.md file
3. **Branch Protection:** Require PR reviews before merging
4. **Status Checks:** Require CI to pass before merging
5. **Security Scanning:** Review Trivy scan results regularly
6. **Dependencies:** Keep dependencies updated via Dependabot

## Local Testing

Test Docker build locally before pushing:

```bash
# Build the image
docker build -t web-search-mcp:test .

# Test the image
docker run --rm web-search-mcp:test node --version

# Run the container
docker run -p 3000:3000 --env-file .env web-search-mcp:test
```

## Advanced Configuration

### Custom Registry

To use a different registry, update the workflow:

```yaml
env:
  REGISTRY: docker.io  # or your custom registry
  IMAGE_NAME: username/image-name
```

### Additional Platforms

Add more platforms:

```yaml
platforms: linux/amd64,linux/arm64,linux/arm/v7
```

### Build Arguments

Pass build arguments:

```yaml
build-args: |
  NODE_VERSION=22
  BUILD_DATE=${{ github.event.head_commit.timestamp }}
```

## Support

For issues with CI/CD:
1. Check workflow logs
2. Review GitHub Actions documentation
3. Open an issue in the repository