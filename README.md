# SupplyShield

Supply chain security for npm projects. Scans your dependency tree,
generates a CycloneDX-format Software Bill of Materials (SBOM),
cross-references against the OSV.dev vulnerability database, and
produces a prioritized remediation report — with reachability-aware
risk analysis.

## Status

✅ **Core Complete** - All business logic modules implemented and tested.

Built for the IBM Bob Dev Day Hackathon (May 1-3, 2026).

## Why SupplyShield

US Executive Order 14028 requires SBOMs for federal software vendors.
The EU's Cyber Resilience Act is moving the same direction. Most
companies don't have SBOMs and don't know what's actually in their
software supply chain.

Existing tools cost $10K-$50K/year (Snyk, Black Duck) or only do part
of the job (`npm audit`, Syft). SupplyShield combines SBOM generation,
vulnerability scanning, and actionable remediation in a single CLI
that runs locally and produces compliance-ready output.

**Key Differentiator:** Reachability analysis filters vulnerabilities by whether
the vulnerable code is actually imported and used in your codebase, prioritizing
real-world risk over noise.

## Tech Stack

- Node.js 18+ with TypeScript (strict mode)
- Commander.js for CLI
- Chalk for terminal colors
- CycloneDX 1.5 SBOM format
- OSV.dev vulnerability database
- Axios for HTTP requests
- Glob for file pattern matching

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/supplyshield.git
cd supplyshield

# Install dependencies
npm install

# Build the project
npm run build

# Run the CLI
npm start -- --version
```

## Usage

```bash
# Show version
supplyshield --version

# Show help
supplyshield --help

# Scan a project (full analysis)
supplyshield scan

# Scan with options
supplyshield scan --path ./my-project --output report.html --include-dev

# Generate SBOM only
supplyshield sbom --output sbom.json

# Check vulnerabilities without reachability analysis
supplyshield check
```

### Command Options

#### `scan` - Full Security Scan
- `-p, --path <path>` - Project path to scan (default: current directory)
- `-o, --output <path>` - Output path for report (default: ./supplyshield-report.html)
- `-f, --format <format>` - Report format: html, json, or both (default: html)
- `--include-dev` - Include dev dependencies in scan
- `--skip-reachability` - Skip reachability analysis (faster but less accurate)
- `--verbose` - Verbose output

#### `sbom` - Generate SBOM
- `-p, --path <path>` - Project path (default: current directory)
- `-o, --output <path>` - Output path for SBOM (default: ./sbom.json)
- `--include-dev` - Include dev dependencies

#### `check` - Quick Vulnerability Check
- `-p, --path <path>` - Project path (default: current directory)
- `--include-dev` - Include dev dependencies

## Project Structure

```
supplyshield/
├── src/
│   ├── cli/
│   │   └── index.ts          # CLI entry point with Commander.js
│   ├── parsers/
│   │   └── index.ts          # Parse package.json and package-lock.json
│   ├── sbom/
│   │   └── index.ts          # CycloneDX 1.5 SBOM generation
│   ├── vulnerabilities/
│   │   └── index.ts          # OSV.dev API integration
│   ├── reachability/
│   │   └── index.ts          # Source code import scanning
│   ├── risk/
│   │   └── index.ts          # Risk scoring and prioritization
│   ├── report/
│   │   └── index.ts          # HTML/JSON report generation
│   ├── types/
│   │   └── index.ts          # Shared TypeScript types
│   └── index.ts              # Main orchestration logic
├── bin/
│   └── supplyshield.js       # Executable entry point
├── dist/                     # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
└── README.md
```

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch mode (auto-rebuild on changes)
npm run watch

# Run in development mode (with tsx)
npm run dev

# Clean build artifacts
npm run clean
```

## Module Overview

### `parsers/`
Extracts dependency information from `package.json` and `package-lock.json`:
- Builds complete dependency tree
- Identifies direct vs transitive dependencies
- Tracks dependency paths
- Separates production and dev dependencies

### `sbom/`
Generates CycloneDX 1.5 compliant Software Bill of Materials:
- Creates machine-readable SBOM in JSON format
- Includes component metadata (name, version, license)
- Tracks dependency relationships
- Validates against CycloneDX schema

### `vulnerabilities/`
Integrates with OSV.dev vulnerability database:
- Queries OSV.dev API for known vulnerabilities
- Batch processing with rate limiting
- Parses CVE/GHSA data
- Checks version ranges for affected packages

### `reachability/`
Analyzes source code to determine if vulnerable packages are actually used:
- Scans JavaScript/TypeScript files for import statements
- Uses AST parsing for accurate detection
- Classifies imports as production or development
- Traces dependency paths to determine reachability

### `risk/`
Combines vulnerability and reachability data into prioritized findings:
- Calculates risk scores (0-100) based on multiple factors
- Prioritizes reachable production vulnerabilities
- Generates remediation recommendations
- Ranks findings by real-world impact

### `report/`
Generates human-readable reports:
- HTML reports with inline CSS (single-file, portable)
- JSON reports for programmatic consumption
- Summary statistics and visualizations
- Detailed findings with remediation steps

## Risk Scoring Algorithm

SupplyShield uses a multi-factor risk scoring system:

1. **Base Score** - CVSS score from vulnerability database
2. **Reachability Multiplier** - 1.5x if imported, 0.3x if unused
3. **Context Multiplier** - 1.3x for production, 0.7x for dev-only
4. **Dependency Type** - 1.2x for direct, 0.9x for transitive

**Risk Levels:**
- 🔴 **CRITICAL** (80-100): Reachable production vulnerability with high CVSS
- 🟠 **HIGH** (60-79): Reachable vulnerability or high CVSS unused dependency
- 🟡 **MEDIUM** (40-59): Moderate risk or dev-only vulnerability
- 🟢 **LOW** (20-39): Low CVSS or unreachable transitive dependency
- ℹ️ **INFO** (0-19): Minimal risk, informational only

## Report Output

HTML reports include:
- Executive summary with key metrics
- Vulnerability breakdown by severity
- Reachability statistics
- Prioritized findings list with:
  - Risk level badges
  - Package and vulnerability details
  - Risk score and reasoning
  - Actionable remediation steps
- Complete SBOM (optional)

## Roadmap

- [x] Project scaffold and TypeScript setup
- [x] CLI framework with Commander.js
- [x] Module structure and type definitions
- [x] Package.json/package-lock.json parsing
- [x] CycloneDX SBOM generation
- [x] OSV.dev API integration
- [x] Source code import scanning
- [x] Risk scoring algorithm
- [x] HTML report generation
- [x] JSON report generation
- [x] End-to-end testing

## Contributing

This is a hackathon project. Contributions welcome after initial release.

## License

MIT License - see LICENSE file for details.