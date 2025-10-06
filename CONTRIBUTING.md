# Contributing to Web Search MCP Server

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Development Setup

1. **Fork the repository**

2. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR-USERNAME/web-search-mcp.git
   cd web-search-mcp
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

5. **Build and run:**
   ```bash
   npm run build
   npm run dev
   ```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions or changes
- `chore/` - Maintenance tasks

### 2. Make Changes

- Write clear, concise commit messages
- Follow the existing code style
- Add tests for new features
- Update documentation as needed

### 3. Test Your Changes

```bash
# Build the project
npm run build

# Test Docker build
docker build -t web-search-mcp:test .

# Run the container
docker run -p 3000:3000 --env-file .env web-search-mcp:test
```

### 4. Commit Your Changes

```bash
git add .
git commit -m "type: description

Detailed explanation of changes"
```

Commit message types:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Test changes
- `chore:` - Maintenance tasks
- `ci:` - CI/CD changes

### 5. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 6. Create a Pull Request

1. Go to the original repository
2. Click "New Pull Request"
3. Select your fork and branch
4. Fill in the PR template
5. Submit the PR

## Pull Request Guidelines

### PR Checklist

- [ ] Code builds successfully (`npm run build`)
- [ ] All TypeScript compilation passes
- [ ] Documentation updated (if needed)
- [ ] Commit messages follow conventions
- [ ] Branch is up to date with main

### PR Title Format

```
type(scope): description

Example:
feat(search): add language filter to news search
fix(docker): correct healthcheck endpoint
docs(api): update HTTP API documentation
```

### PR Description

Include:
- **What:** What changes were made
- **Why:** Why these changes were needed
- **How:** How the changes were implemented
- **Testing:** How the changes were tested
- **Screenshots:** If applicable

## CI/CD Process

### Automated Checks

When you submit a PR, the following checks run automatically:

1. **CI Pipeline**
   - Linting and TypeScript compilation
   - Build verification
   - Docker build test

2. **Security Scan**
   - Trivy vulnerability scanning
   - Dependency security checks

3. **Docker Build Test**
   - Multi-platform build validation

All checks must pass before merging.

### After Merge

When your PR is merged to `main`:

1. **Docker Image Build**
   - Automatically builds and publishes to GHCR
   - Tagged as `main` and `latest`

2. **Deployment**
   - Docker image available at: `ghcr.io/OWNER/REPO:main`

## Release Process

### Creating a Release

Releases are created by repository maintainers:

1. **Update version:**
   ```bash
   # Update version in package.json
   npm version patch  # or minor, or major
   ```

2. **Create a tag:**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

3. **Automated release workflow:**
   - Builds the project
   - Creates GitHub Release
   - Publishes Docker images with version tags
   - Generates release artifacts

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (v2.0.0): Breaking changes
- **MINOR** (v1.1.0): New features, backwards compatible
- **PATCH** (v1.0.1): Bug fixes, backwards compatible

## Code Style

### TypeScript

- Use TypeScript strict mode
- Define explicit types for function parameters and return values
- Use interfaces for object shapes
- Avoid `any` type when possible

### Formatting

- Indentation: 2 spaces
- Line length: 100 characters (suggested)
- Use meaningful variable names
- Add comments for complex logic

### File Organization

```
src/
├── server.ts           # Main server entry
├── httpServer.ts       # HTTP server implementation
├── config.ts           # Configuration management
├── types.ts            # Type definitions
├── errors.ts           # Error handling
├── utils.ts            # Utility functions
├── rateLimit.ts        # Rate limiting
├── googleNewsSearch.ts # News search tool
└── fetchPage.ts        # Page fetching tool
```

## Testing

### Manual Testing

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Test health endpoint:**
   ```bash
   curl http://localhost:3000/health
   ```

3. **Test MCP endpoint:**
   ```bash
   curl -X POST http://localhost:3000/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
   ```

### Docker Testing

```bash
# Build
docker build -t web-search-mcp:test .

# Run
docker run -p 3000:3000 --env-file .env web-search-mcp:test

# Test
curl http://localhost:3000/health
```

## Documentation

### What to Document

- New features and their usage
- API changes
- Configuration options
- Breaking changes
- Migration guides

### Where to Document

- **README.md**: Overview, quick start, basic usage
- **HTTP_API.md**: Complete API reference
- **CI_CD.md**: CI/CD documentation
- **Code comments**: Complex logic, non-obvious code

## Issue Reporting

### Bug Reports

Include:
- Description of the bug
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment (OS, Node version, Docker version)
- Logs/screenshots

### Feature Requests

Include:
- Description of the feature
- Use case/motivation
- Proposed implementation (if any)
- Alternatives considered

## Security

### Reporting Security Issues

**DO NOT** open public issues for security vulnerabilities.

Instead:
1. Email the maintainers privately
2. Include detailed information about the vulnerability
3. Wait for confirmation before disclosing

### Security Considerations

When contributing:
- Validate all user inputs
- Avoid hardcoding credentials
- Use secure defaults
- Follow security best practices
- Review dependencies for vulnerabilities

## Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Documentation**: Check existing docs first

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Collaborate openly
- Follow project guidelines

## Recognition

Contributors will be:
- Listed in release notes
- Credited in documentation
- Recognized in the community

Thank you for contributing! 🎉