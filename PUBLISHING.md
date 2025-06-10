# 📦 Publishing Guide

This guide explains how to test the package before publishing it to npm.

## 🧪 Testing Publication (Without Publishing)

### 1. Check Package Contents

```bash
# Lists all files that will be included in the package
npm pack --dry-run
```

This command shows:
- Which files will be included
- Final package size
- Tarball structure

### 2. Create Local Package

```bash
# Creates a .tgz file locally
bun run pack
# or
npm pack
```

This will create a `url-ast-1.0.0.tgz` file that you can:
- Inspect manually
- Install locally in another project for testing

### 3. Test Local Installation

```bash
# In another project, install the local package
npm install /path/to/url-ast-1.0.0.tgz
# or
bun add /path/to/url-ast-1.0.0.tgz
```

### 4. Complete Publication Simulation

```bash
# Simulates the entire publication process without sending
bun run publish:dry
# or
npm publish --dry-run
```

## 📋 Pre-Publishing Checklist

- [ ] Tests passing: `bun test`
- [ ] Build working: `bun run build`
- [ ] Version updated in `package.json`
- [ ] README.md updated
- [ ] CHANGELOG.md updated (if any)
- [ ] Unnecessary files excluded via `.npmignore`
- [ ] Publication test successful: `bun run test:publish`

## 🚀 Actual Publication

When everything is ready:

```bash
# Publish to npm
npm publish

# Publish with specific tag (e.g. beta)
npm publish --tag beta
```

## 📝 Available Scripts

- `bun run test:publish` - Tests if the package is ready for publication
- `bun run pack` - Creates the .tgz file locally
- `bun run publish:dry` - Simulates complete publication

## ⚠️ Ignored Files

The `.npmignore` file ensures that the following items are NOT published:
- TypeScript source code (`/src`)
- Tests (`/test`, `*.test.ts`)
- Development configurations
- Benchmarks and examples
- IDE and temporary files

Only essential files are included:
- `/dist` - Compiled code
- `package.json`
- `README.md`
- `LICENSE` (if any) 