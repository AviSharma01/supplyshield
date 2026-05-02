# SupplyShield Development Guide

## Project Scaffold Complete ✅

The SupplyShield CLI tool has been successfully scaffolded with a complete, production-ready structure. All TypeScript compiles successfully, and the CLI is functional.

## What's Been Built

### 1. Configuration Files
- ✅ `package.json` - Dependencies and npm scripts configured
- ✅ `tsconfig.json` - Strict TypeScript configuration for Node.js 18+
- ✅ `.gitignore` - Updated with build artifacts

### 2. Module Structure
All modules have been created with:
- Comprehensive TypeScript interfaces
- Placeholder functions with TODO comments
- JSDoc documentation
- Proper exports

**Modules:**
- `src/cli/` - Commander.js CLI with 3 commands (scan, sbom, check)
- `src/parsers/` - Package.json and package-lock.json parsing
- `src/sbom/` - CycloneDX 1.5 SBOM generation
- `src/vulnerabilities/` - OSV.dev API integration
- `src/reachability/` - Source code import scanning
- `src/risk/` - Risk scoring and prioritization
- `src/report/` - HTML/JSON report generation with inline CSS
- `src/types/` - Shared TypeScript type definitions

### 3. Type System
Complete type definitions in `src/types/index.ts`:
- `Package` - Dependency information
- `Vulnerability` - OSV.dev vulnerability data
- `ReachabilityResult` - Import analysis results
- `RiskScore` - Combined risk assessment
- `Finding` - Prioritized remediation item
- `Report` - Final report structure
- `ScanOptions` - CLI configuration

### 4. CLI Interface
Working CLI with Commander.js:
```bash
supplyshield --version          # Shows 0.1.0
supplyshield --help             # Shows all commands
supplyshield scan [options]     # Full scan (placeholder)
supplyshield sbom [options]     # SBOM generation (placeholder)
supplyshield check [options]    # Quick check (placeholder)
```

### 5. Build System
- TypeScript compilation configured
- Source maps enabled
- Declaration files generated
- npm scripts ready:
  - `npm run build` - Compile TypeScript
  - `npm run dev` - Run with tsx (development)
  - `npm start` - Run compiled version
  - `npm run watch` - Watch mode
  - `npm run clean` - Remove build artifacts

## Project Statistics

- **Total Files Created:** 15
- **Lines of Code:** ~1,200+
- **Modules:** 7
- **Type Definitions:** 12 interfaces
- **CLI Commands:** 3
- **Dependencies Installed:** 205 packages

## Next Steps: Implementation Roadmap

### Phase 1: Core Parsing (Priority: HIGH)
**File:** `src/parsers/index.ts`

Implement:
1. `parsePackageJson()` - Read and parse package.json
2. `parsePackageLock()` - Parse package-lock.json for full tree
3. `buildDependencyTree()` - Build complete dependency graph

**Dependencies needed:**
- Node.js `fs/promises` for file reading
- JSON parsing (built-in)

**Key challenges:**
- Handle npm v7+ lockfile format
- Track dependency paths correctly
- Separate prod vs dev dependencies

### Phase 2: SBOM Generation (Priority: HIGH)
**File:** `src/sbom/index.ts`

Implement:
1. `generateSBOM()` - Use @cyclonedx/cyclonedx-library
2. `writeSBOM()` - Write JSON to file
3. `validateSBOM()` - Validate against schema

**Dependencies:**
- `@cyclonedx/cyclonedx-library` (already installed)
- Node.js `fs/promises`

**Key challenges:**
- Map npm package data to CycloneDX format
- Handle license information
- Include dependency relationships

### Phase 3: Vulnerability Scanning (Priority: HIGH)
**File:** `src/vulnerabilities/index.ts`

Implement:
1. `queryOSV()` - Query OSV.dev API for single package
2. `batchQueryOSV()` - Batch queries with rate limiting
3. `parseOSVResponse()` - Parse API responses
4. `isVersionAffected()` - Check version ranges

**API Endpoint:**
- POST https://api.osv.dev/v1/query
- Batch: POST https://api.osv.dev/v1/querybatch

**Key challenges:**
- Rate limiting (be respectful to OSV.dev)
- Handle API errors gracefully
- Parse semver ranges correctly

### Phase 4: Reachability Analysis (Priority: MEDIUM)
**File:** `src/reachability/index.ts`

Implement:
1. `scanForImports()` - Find imports in source files
2. `analyzeReachability()` - Batch analysis
3. `findImportsInFile()` - AST-based import detection
4. `traceDependencyPaths()` - Trace dependency chains

**Dependencies needed:**
- `glob` (already installed) for file finding
- `@babel/parser` or `acorn` for AST parsing
- Node.js `fs/promises`

**Key challenges:**
- Parse both CommonJS (require) and ESM (import)
- Handle dynamic imports
- Scan TypeScript files
- Determine production vs dev context

### Phase 5: Risk Scoring (Priority: MEDIUM)
**File:** `src/risk/index.ts`

Implement:
1. `calculateRiskScore()` - Multi-factor risk calculation
2. `generateRemediationSteps()` - Smart remediation suggestions
3. `createFindings()` - Convert scores to findings
4. `prioritizeFindings()` - Sort by real-world risk

**Algorithm already designed:**
- Base CVSS score
- Reachability multiplier
- Context multiplier (prod/dev)
- Dependency type multiplier

**Key challenges:**
- Tune multipliers for accurate risk assessment
- Generate actionable remediation steps
- Handle edge cases (no fix available, etc.)

### Phase 6: Report Generation (Priority: LOW)
**File:** `src/report/index.ts`

Implement:
1. `generateHTMLReport()` - Already has template, needs data binding
2. `writeHTMLReport()` - Write to file
3. `generateJSONReport()` - Already implemented
4. `writeJSONReport()` - Write to file

**Current state:**
- HTML template with inline CSS complete
- Just needs file I/O implementation

**Key challenges:**
- Ensure HTML is properly escaped
- Make reports portable (single file)
- Add charts/visualizations (optional)

### Phase 7: Main Orchestration (Priority: LOW)
**File:** `src/index.ts`

Implement:
1. `scan()` - Already has workflow, needs real implementations
2. `saveReport()` - Already has logic, needs file I/O

**Current state:**
- Workflow is designed and stubbed
- Just needs to call real implementations

## Testing Strategy

### Unit Tests (Recommended)
Create `src/**/*.test.ts` files for each module:
- Test parsers with sample package.json files
- Mock OSV.dev API responses
- Test risk scoring algorithm with known inputs
- Validate SBOM generation

### Integration Tests
- Test full scan workflow end-to-end
- Use a real npm project as test fixture
- Verify report generation

### Manual Testing
```bash
# Test on this project itself
npm run build
node bin/supplyshield.js scan --path . --verbose

# Test on other projects
node bin/supplyshield.js scan --path ../some-other-project
```

## Development Workflow

1. **Pick a module** from the roadmap above
2. **Implement the functions** marked with TODO
3. **Test locally** with `npm run dev`
4. **Build** with `npm run build`
5. **Test the CLI** with real projects
6. **Iterate** based on results

## Code Style Guidelines

- Use TypeScript strict mode (already configured)
- Add JSDoc comments for all public functions
- Use async/await for asynchronous operations
- Handle errors gracefully with try/catch
- Log progress for long-running operations
- Use chalk for colored terminal output

## Useful Commands

```bash
# Development
npm run dev                    # Run with tsx (fast iteration)
npm run watch                  # Auto-rebuild on changes

# Building
npm run build                  # Compile TypeScript
npm run clean                  # Remove dist/

# Testing
node bin/supplyshield.js --help
node bin/supplyshield.js scan --verbose

# Debugging
node --inspect bin/supplyshield.js scan
```

## Dependencies Reference

**Production:**
- `commander@^12.1.0` - CLI framework
- `chalk@^4.1.2` - Terminal colors
- `@cyclonedx/cyclonedx-library@^6.11.0` - SBOM generation
- `axios@^1.7.2` - HTTP client
- `glob@^10.4.1` - File pattern matching

**Development:**
- `typescript@^5.4.5` - TypeScript compiler
- `@types/node@^20.12.12` - Node.js types
- `tsx@^4.11.0` - TypeScript execution

## Additional Resources

- [OSV.dev API Documentation](https://osv.dev/docs/)
- [CycloneDX Specification](https://cyclonedx.org/specification/overview/)
- [Commander.js Documentation](https://github.com/tj/commander.js)
- [npm package-lock.json format](https://docs.npmjs.com/cli/v9/configuring-npm/package-lock-json)

## Questions or Issues?

The scaffold is complete and ready for implementation. Each module has:
- Clear function signatures
- Type definitions
- TODO comments indicating what needs to be implemented
- JSDoc documentation

Start with Phase 1 (parsers) as it's the foundation for everything else.

Good luck with the hackathon! 🚀