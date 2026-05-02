/**
 * Risk Module
 *
 * Combines vulnerability and reachability data to calculate risk scores
 * and prioritize remediation actions
 */

import { Package, Vulnerability, ReachabilityResult, RiskScore, Finding, RemediationStep } from '../types';

// Risk scoring constants
const REACHABILITY_MULTIPLIER = 1.5; // Increase risk for imported packages
const UNREACHABLE_MULTIPLIER = 0.3; // Decrease risk for unused dependencies
const PRODUCTION_MULTIPLIER = 1.3; // Increase risk for production code
const DEVELOPMENT_MULTIPLIER = 0.7; // Decrease risk for dev/test code
const DIRECT_DEPENDENCY_MULTIPLIER = 1.2; // Easier to fix direct dependencies
const TRANSITIVE_DEPENDENCY_MULTIPLIER = 0.9; // Harder to fix transitive dependencies

// Risk level thresholds
const CRITICAL_THRESHOLD = 80;
const HIGH_THRESHOLD = 60;
const MEDIUM_THRESHOLD = 40;
const LOW_THRESHOLD = 20;

// Finding ID prefix
const FINDING_ID_PREFIX = 'FINDING-';

/**
 * Calculate risk score for a vulnerability
 * 
 * @param vulnerability - Vulnerability data
 * @param package - Package information
 * @param reachability - Reachability analysis result
 * @returns Risk score with reasoning
 */
export function calculateRiskScore(
  vulnerability: Vulnerability,
  packageInfo: Package,
  reachability: ReachabilityResult
): RiskScore {
  // TODO: Implement sophisticated risk scoring algorithm
  console.log(`Calculating risk for ${packageInfo.name} - ${vulnerability.id}`);
  
  let score = 0;
  let reasoning = '';
  
  // Base score from CVSS
  if (vulnerability.cvssScore) {
    score = vulnerability.cvssScore * 10;
  }
  
  // Adjust for reachability
  if (reachability.isImported) {
    score *= REACHABILITY_MULTIPLIER;
    reasoning += 'Package is imported in codebase. ';
  } else {
    score *= UNREACHABLE_MULTIPLIER;
    reasoning += 'Package is not imported (unused dependency). ';
  }
  
  // Adjust for production vs dev
  if (reachability.isProduction) {
    score *= PRODUCTION_MULTIPLIER;
    reasoning += 'Used in production code. ';
  } else if (reachability.isDevelopment) {
    score *= DEVELOPMENT_MULTIPLIER;
    reasoning += 'Only used in development/test code. ';
  }
  
  // Adjust for direct vs transitive
  if (packageInfo.isDirect) {
    score *= DIRECT_DEPENDENCY_MULTIPLIER;
    reasoning += 'Direct dependency (easier to fix). ';
  } else {
    score *= TRANSITIVE_DEPENDENCY_MULTIPLIER;
    reasoning += 'Transitive dependency. ';
  }
  
  // Determine risk level
  let riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  if (score >= CRITICAL_THRESHOLD) riskLevel = 'CRITICAL';
  else if (score >= HIGH_THRESHOLD) riskLevel = 'HIGH';
  else if (score >= MEDIUM_THRESHOLD) riskLevel = 'MEDIUM';
  else if (score >= LOW_THRESHOLD) riskLevel = 'LOW';
  else riskLevel = 'INFO';
  
  return {
    vulnerability,
    package: packageInfo,
    reachability,
    riskLevel,
    score: Math.min(100, Math.round(score)),
    reasoning: reasoning.trim()
  };
}

/**
 * Generate remediation steps for a finding
 * 
 * @param riskScore - Risk score with vulnerability and package info
 * @returns Array of remediation steps
 */
export function generateRemediationSteps(riskScore: RiskScore): RemediationStep[] {
  // TODO: Implement intelligent remediation suggestions
  const steps: RemediationStep[] = [];
  
  if (riskScore.vulnerability.fixedVersions && riskScore.vulnerability.fixedVersions.length > 0) {
    steps.push({
      action: 'UPDATE',
      description: `Update ${riskScore.package.name} to version ${riskScore.vulnerability.fixedVersions[0]}`,
      targetVersion: riskScore.vulnerability.fixedVersions[0],
      effort: riskScore.package.isDirect ? 'LOW' : 'MEDIUM'
    });
  } else {
    steps.push({
      action: 'REVIEW',
      description: `Review ${riskScore.package.name} for security implications`,
      effort: 'MEDIUM'
    });
  }
  
  return steps;
}

/**
 * Create findings from risk scores
 * 
 * @param riskScores - Array of risk scores
 * @returns Array of prioritized findings
 */
export function createFindings(riskScores: RiskScore[]): Finding[] {
  // TODO: Implement finding creation and prioritization
  console.log(`Creating findings from ${riskScores.length} risk scores`);
  
  const findings: Finding[] = riskScores.map((riskScore, index) => ({
    id: `${FINDING_ID_PREFIX}${index + 1}`,
    title: `${riskScore.vulnerability.id} in ${riskScore.package.name}`,
    package: riskScore.package,
    vulnerability: riskScore.vulnerability,
    riskScore,
    remediation: generateRemediationSteps(riskScore),
    priority: index + 1
  }));
  
  // Sort by risk score (highest first)
  findings.sort((a, b) => b.riskScore.score - a.riskScore.score);
  
  // Update priorities after sorting
  findings.forEach((finding, index) => {
    finding.priority = index + 1;
  });
  
  return findings;
}

/**
 * Prioritize findings based on multiple factors
 * 
 * @param findings - Array of findings to prioritize
 * @returns Prioritized array of findings
 */
export function prioritizeFindings(findings: Finding[]): Finding[] {
  // TODO: Implement advanced prioritization logic
  console.log(`Prioritizing ${findings.length} findings`);
  
  // Priority factors:
  // 1. Reachable production vulnerabilities (highest)
  // 2. Reachable development vulnerabilities
  // 3. Unreachable production dependencies
  // 4. Unreachable development dependencies (lowest)
  
  return findings.sort((a, b) => {
    const aIsReachableProduction = a.riskScore.reachability.isProduction && a.riskScore.reachability.isImported;
    const bIsReachableProduction = b.riskScore.reachability.isProduction && b.riskScore.reachability.isImported;
    
    // First by reachability in production
    if (aIsReachableProduction && !bIsReachableProduction) {
      return -1;
    }
    if (!aIsReachableProduction && bIsReachableProduction) {
      return 1;
    }
    
    // Then by risk score
    return b.riskScore.score - a.riskScore.score;
  });
}
