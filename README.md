# SupplyShield

Supply chain security for npm projects. Scans your dependency tree, 
generates a CycloneDX-format Software Bill of Materials (SBOM), 
cross-references against the OSV.dev vulnerability database, and 
produces a prioritized remediation report — with codebase-aware 
risk analysis powered by IBM Bob.

## Status

Early development. Built for the IBM Bob Dev Day Hackathon (May 1-3, 2026).

## Why SupplyShield

US Executive Order 14028 requires SBOMs for federal software vendors. 
The EU's Cyber Resilience Act is moving the same direction. Most 
companies don't have SBOMs and don't know what's actually in their 
software supply chain.

Existing tools cost $10K-$50K/year (Snyk, Black Duck) or only do part 
of the job (`npm audit`, Syft). SupplyShield combines SBOM generation, 
vulnerability scanning, and actionable remediation in a single CLI 
that runs locally and produces compliance-ready output.

## Tech stack

- Node.js + TypeScript
- IBM Bob (development partner + runtime contextual analysis)
- CycloneDX 1.5 SBOM format
- OSV.dev vulnerability database