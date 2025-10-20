# Stage 1: Build stage
FROM node:25-alpine AS builder

# Set working directory
WORKDIR /app

# Install pnpm - use specific version for reproducibility
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

# Install build dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install all dependencies (including devDependencies for building)
# Use --no-frozen-lockfile for flexibility with lockfile versions
RUN pnpm install --no-frozen-lockfile

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build the TypeScript code
RUN pnpm run build

# Remove devDependencies
RUN pnpm prune --prod

# Stage 2: Runtime stage
FROM node:25-alpine AS runtime

# Set working directory
WORKDIR /app

# Install only runtime dependencies needed for native modules
# jsdom requires some libraries, but we minimize what we install
RUN apk add --no-cache \
    tini

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy package.json (needed for node to resolve modules)
COPY --from=builder /app/package.json ./package.json

# Copy configuration files
COPY mcp.config.json ./

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose the port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Use tini to handle signals properly
ENTRYPOINT ["/sbin/tini", "--"]

# Start the server
CMD ["node", "dist/server.js"]