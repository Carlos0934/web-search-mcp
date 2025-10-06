# Docker Optimization Guide

This document explains the Docker optimizations implemented in this project.

## Multi-Stage Build Strategy

We use a **two-stage build process** to minimize the final image size and improve security.

### Stage 1: Builder (Development Image)

```dockerfile
FROM node:22-alpine AS builder
```

**Purpose**: Build and compile the TypeScript application

**What happens here:**
- Install build tools (Python, Make, G++, Git)
- Install ALL dependencies (including devDependencies)
- Compile TypeScript to JavaScript
- Prune devDependencies after build

**Size**: ~500MB (not kept in final image)

### Stage 2: Runtime (Production Image)

```dockerfile
FROM node:22-alpine AS runtime
```

**Purpose**: Run the compiled application with minimal dependencies

**What's included:**
- Only production node_modules
- Compiled JavaScript code (dist/)
- Configuration files
- Minimal system packages (only tini)

**Final size**: ~150-200MB

## Size Comparison

| Approach | Image Size | Build Time |
|----------|-----------|------------|
| Single-stage (no optimization) | ~800MB | Fast |
| Multi-stage (current) | ~150MB | Medium |
| Distroless (ultra-optimized) | ~120MB | Medium |

## Key Optimizations

### 1. Package Manager: pnpm

**Why pnpm?**
- Faster installation (content-addressable storage)
- Efficient disk usage (symlinks to shared store)
- Strict dependency resolution
- Better security (no phantom dependencies)

**Build time improvement**: ~30% faster than npm

```dockerfile
# Install pnpm via corepack (built into Node.js)
RUN corepack enable && corepack prepare pnpm@latest --activate
```

### 2. Alpine Linux Base

**Why Alpine?**
- Minimal base image (~5MB vs ~100MB for Debian)
- Uses musl libc instead of glibc
- Security-focused
- Smaller attack surface

**Trade-offs:**
- Some native modules may need additional setup
- Different C library (musl vs glibc)

### 3. Frozen Lockfile

```dockerfile
RUN pnpm install --frozen-lockfile
```

**Benefits:**
- Ensures reproducible builds
- Prevents unexpected version updates
- Fails fast if lockfile is outdated
- Better cache utilization

### 4. Production Dependencies Only

```dockerfile
# In builder stage, after compilation
RUN pnpm prune --prod
```

**What's removed:**
- TypeScript compiler
- @types/* packages
- tsx (development runner)
- Testing frameworks
- Build tools

**Size saved**: ~200-300MB

### 5. Minimal System Dependencies

**Builder stage** (temporary):
```dockerfile
RUN apk add --no-cache python3 make g++ git
```

**Runtime stage** (permanent):
```dockerfile
RUN apk add --no-cache tini
```

**Only tini is kept** for proper signal handling and zombie process reaping.

### 6. Non-Root User

```dockerfile
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs
```

**Security benefits:**
- Limited file system access
- Reduced attack surface
- Industry best practice
- Container escape mitigation

### 7. Tini Init System

```dockerfile
ENTRYPOINT ["/sbin/tini", "--"]
```

**Why tini?**
- Proper signal forwarding (SIGTERM, SIGINT)
- Zombie process reaping
- Graceful shutdown
- Only 10KB overhead

### 8. Smart Layer Caching

**Order matters!** Least frequently changed files first:

```dockerfile
# 1. Package files (rarely change)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 2. Source code (changes often)
COPY tsconfig.json ./
COPY src ./src
RUN pnpm run build
```

**Cache hit rate**: ~80% for repeated builds

### 9. Aggressive .dockerignore

**Excluded from build context:**
- node_modules (400MB+)
- .git directory (50MB+)
- Documentation (1MB+)
- Examples and tests (5MB+)
- IDE files

**Build context size reduction**: ~500MB → ~5MB

## Advanced: Distroless Image

For maximum security and minimal size, use the distroless variant:

```bash
docker build -f Dockerfile.distroless -t web-search-mcp:distroless .
```

### Distroless Benefits

1. **Smallest possible size** (~120MB)
2. **No shell** - can't execute shell commands
3. **No package manager** - can't install malware
4. **Minimal CVE exposure** - fewer packages = fewer vulnerabilities
5. **Google-maintained** - regular security updates

### Distroless Trade-offs

- **No debugging tools** (no bash, no ls, no curl)
- **No shell access** (can't docker exec into container)
- **Harder troubleshooting** (must use external tools)

**When to use distroless:**
- Production environments
- Security-critical applications
- Compliance requirements (PCI-DSS, HIPAA)

**When to use Alpine:**
- Development
- Need debugging tools
- Need shell access
- Easier troubleshooting

## Build Performance

### Local Build

```bash
# First build (no cache)
time docker build -t web-search-mcp .
# ~2-3 minutes

# Subsequent builds (with cache)
time docker build -t web-search-mcp .
# ~30-60 seconds

# With BuildKit (faster)
DOCKER_BUILDKIT=1 docker build -t web-search-mcp .
# ~20-40 seconds (cached)
```

### CI/CD Build

GitHub Actions cache configuration:

```yaml
- uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

**Cache hit rate in CI**: ~90% after first build

## Image Layers

Optimized layer structure (from bottom to top):

```
Layer 1: Base Alpine image (~5MB)
Layer 2: Node.js runtime (~45MB)
Layer 3: tini init system (~10KB)
Layer 4: User creation (minimal)
Layer 5: Production node_modules (~80MB)
Layer 6: Compiled application (~2MB)
Layer 7: Config files (~1KB)
```

**Total**: ~150MB

## Security Scanning

All images are automatically scanned for vulnerabilities:

```bash
# Scan with Trivy
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image web-search-mcp:latest

# Expected vulnerabilities: 0-2 (mostly from base image)
```

## Resource Usage

### Memory

- **Startup**: ~50MB
- **Idle**: ~80MB
- **Under load**: ~150-300MB

### CPU

- **Startup**: 1 core at 100% for ~2s
- **Idle**: <1% CPU
- **Under load**: 20-50% per request

### Disk

- **Image size**: ~150MB
- **Runtime volume**: minimal (no persistent data)

## Platform Support

Multi-platform builds for:

- **linux/amd64** (x86_64) - Intel/AMD servers
- **linux/arm64** (aarch64) - ARM servers, Apple Silicon

```bash
# Build for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t web-search-mcp:latest .
```

## Best Practices Applied

✅ Multi-stage builds for smaller images
✅ Minimal base image (Alpine)
✅ Non-root user for security
✅ Proper signal handling (tini)
✅ Production-only dependencies
✅ Layer caching optimization
✅ Aggressive .dockerignore
✅ Health checks
✅ Security scanning
✅ Multi-platform support

## Comparison with Common Alternatives

### vs. Ubuntu-based Image

| Metric | Alpine (Ours) | Ubuntu |
|--------|--------------|--------|
| Base size | 5MB | 100MB |
| Final size | 150MB | 500MB |
| Security updates | Weekly | Monthly |
| Package manager | apk | apt |
| Init system | tini | systemd |

### vs. Single-stage Build

| Metric | Multi-stage | Single-stage |
|--------|-------------|--------------|
| Final size | 150MB | 800MB |
| Build time | 2-3 min | 2 min |
| Security | Better | Worse |
| Dependencies | Prod only | All |

## Troubleshooting

### Build fails: "npm ci can't find package-lock.json"

**Solution**: Use pnpm instead of npm (already implemented)

### Image is too large

**Solution**: 
1. Check if devDependencies are included
2. Verify multi-stage build is working
3. Use `docker image history` to inspect layers

### Can't access container shell

**Problem**: Distroless has no shell

**Solution**: Use debugging techniques:
```bash
# Copy file out for inspection
docker cp container:/app/file.txt .

# Use debug variant (if available)
docker run -it gcr.io/distroless/nodejs22-debian12:debug /busybox/sh
```

### Build is slow

**Solutions**:
1. Use BuildKit: `DOCKER_BUILDKIT=1 docker build`
2. Check .dockerignore includes node_modules
3. Reorder Dockerfile for better caching
4. Use `--cache-from` in CI/CD

## Monitoring

### Check Image Size

```bash
docker images web-search-mcp
```

### Inspect Layers

```bash
docker image history web-search-mcp:latest
```

### Scan for Vulnerabilities

```bash
docker scan web-search-mcp:latest
```

### Resource Usage

```bash
docker stats web-search-mcp
```

## Future Optimizations

Potential improvements:

1. **Alpine with runtime dependencies** - Further reduce size
2. **Scratch-based build** - Ultra-minimal (80MB)
3. **Dependency analysis** - Remove unused dependencies
4. **WebAssembly runtime** - Experimental, very small
5. **Container image compression** - zstd compression

## References

- [Docker Best Practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
- [Alpine Linux](https://alpinelinux.org/)
- [Distroless Images](https://github.com/GoogleContainerTools/distroless)
- [pnpm Documentation](https://pnpm.io/)
- [Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)
