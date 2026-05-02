/**
 * Shared TypeScript types for SupplyShield
 */

/**
 * Represents a package dependency
 */
export interface Package {
  name: string;
  version: string;
  isDev: boolean;
  isDirect: boolean;
  path: string[]; // Dependency path from root
  license?: string;
  description?: string;
}

/**
 * Represents a vulnerability from OSV.dev
 */
export interface Vulnerability {
  id: string; // CVE or GHSA ID
  summary: string;
  details: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  cvssScore?: number;
  affectedVersions: string[];
  fixedVersions?: string[];
  references: string[];
  published: string;
  modified: string;
}

/**
 * Result of reachability analysis for a package
 */
export interface ReachabilityResult {
  packageName: string;
  isImported: boolean;
  importLocations: ImportLocation[];
  isProduction: boolean;
  isDevelopment: boolean;
}

/**
 * Location where a package is imported
 */
export interface ImportLocation {
  file: string;
  line: number;
  importStatement: string;
}

/**
 * Combined risk assessment for a vulnerability
 */
export interface RiskScore {
  vulnerability: Vulnerability;
  package: Package;
  reachability: ReachabilityResult;
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  score: number; // 0-100
  reasoning: string;
}

/**
 * A prioritized finding for remediation
 */
export interface Finding {
  id: string;
  title: string;
  package: Package;
  vulnerability: Vulnerability;
  riskScore: RiskScore;
  remediation: RemediationStep[];
  priority: number; // 1 = highest
}

/**
 * Remediation step for a finding
 */
export interface RemediationStep {
  action: 'UPDATE' | 'REPLACE' | 'REMOVE' | 'REVIEW';
  description: string;
  targetVersion?: string;
  effort: 'LOW' | 'MEDIUM' | 'HIGH';
}

/**
 * Final report structure
 */
export interface Report {
  metadata: ReportMetadata;
  summary: ReportSummary;
  findings: Finding[];
  sbom?: any; // CycloneDX SBOM object
  generatedAt: string;
}

/**
 * Report metadata
 */
export interface ReportMetadata {
  projectName: string;
  projectVersion: string;
  scanDate: string;
  supplyShieldVersion: string;
}

/**
 * Report summary statistics
 */
export interface ReportSummary {
  totalPackages: number;
  directDependencies: number;
  transitiveDependencies: number;
  totalVulnerabilities: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  reachableVulnerabilities: number;
  unreachableVulnerabilities: number;
}

/**
 * CLI options
 */
export interface ScanOptions {
  projectPath: string;
  outputPath?: string;
  format?: 'html' | 'json' | 'both';
  includeDev?: boolean;
  skipReachability?: boolean;
  verbose?: boolean;
}
