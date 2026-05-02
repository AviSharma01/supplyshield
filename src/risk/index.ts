/**
 * Risk Module
 * 
 * Combines vulnerability and reachability data to calculate risk scores
 * and prioritize remediation actions
 */

import { Package, Vulnerability, ReachabilityResult, RiskScore, Finding, RemediationStep } from '../types';

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
  pkg: Package,
  reachability: ReachabilityResult
): RiskScore {
  // TODO: Implement sophisticated risk scoring algorithm
  console.log(`Calculating risk for ${pkg.name} - ${vulnerability.id}`);
  
  let score = 0;
  let reasoning = '';
  
  // Base score from CVSS
  if (vulnerability.cvssScore) {
    score = vulnerability.cvssScore * 10;
  }
  
  // Adjust for reachability
  if (reachability.isImported) {
    score *= 1.5;
    reasoning += 'Package is imported in codebase. ';
  } else {
    score *= 0.3;
    reasoning += 'Package is not imported (unused dependency). ';
  }
  
  // Adjust for production vs dev
  if (reachability.isProduction) {
    score *= 1.3;
    reasoning += 'Used in production code. ';
  } else if (reachability.isDevelopment) {
    score *= 0.7;
    reasoning += 'Only used in development/test code. ';
  }
  
  // Adjust for direct vs transitive
  if (pkg.isDirect) {
    score *= 1.2;
    reasoning += 'Direct dependency (easier to fix). ';
  } else {
    score *= 0.9;
    reasoning += 'Transitive dependency. ';
  }
  
  // Determine risk level
  let riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  if (score >= 80) riskLevel = 'CRITICAL';
  else if (score >= 60) riskLevel = 'HIGH';
  else if (score >= 40) riskLevel = 'MEDIUM';
  else if (score >= 20) riskLevel = 'LOW';
  else riskLevel = 'INFO';
  
  return {
    vulnerability,
    package: pkg,
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
    id: `FINDING-${index + 1}`,
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
    // First by reachability in production
    if (a.riskScore.reachability.isProduction && a.riskScore.reachability.isImported) {
      if (!b.riskScore.reachability.isProduction || !b.riskScore.reachability.isImported) {
        return -1;
      }
    }
    
    // Then by risk score
    return b.riskScore.score - a.riskScore.score;
  });
}

// Made with Bob
