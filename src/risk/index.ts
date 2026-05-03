/**
 * Risk Module
 *
 * Combines vulnerability and reachability data to calculate risk scores
 * and prioritize remediation actions
 */

import { Package, Vulnerability, ReachabilityResult, Finding, PriorityLevel } from '../types';

/**
 * Classify risk and create prioritized findings
 *
 * Combines vulnerability data + reachability data + dependency metadata
 * into prioritized findings ranked by real-world impact.
 *
 * @param packageVulnerabilities - Map of package keys (name@version) to their vulnerabilities
 * @param reachabilityMap - Map of package names to reachability results
 * @param packages - Array of all packages
 * @returns Array of findings sorted by priority (highest first)
 */
export function classifyRisk(
  packageVulnerabilities: Map<string, Vulnerability[]>,
  reachabilityMap: Map<string, ReachabilityResult>,
  packages: Package[]
): Finding[] {
  const findings: Finding[] = [];
  
  // Create a map of package names to package objects for quick lookup
  const packageMap = new Map<string, Package>();
  for (const pkg of packages) {
    packageMap.set(pkg.name, pkg);
  }
  
  // Create findings for each package-vulnerability combination
  for (const [pkgKey, vulns] of packageVulnerabilities) {
    // Extract package name from key (name@version)
    const packageName = pkgKey.split('@').slice(0, -1).join('@');
    const pkg = packageMap.get(packageName);
    if (!pkg) continue;
    
    const reachability = reachabilityMap.get(packageName) || {
      packageName,
      isReachable: false,
      importedIn: [],
      importCount: 0,
      importType: 'static' as const,
      isProduction: !pkg.isDev,
      isDevelopment: pkg.isDev
    };
    
    for (const vuln of vulns) {
      const finding = createFinding(vuln, pkg, reachability);
      findings.push(finding);
    }
  }
  
  // Sort findings by priority score (highest first)
  findings.sort((a, b) => b.priorityScore - a.priorityScore);
  
  return findings;
}

/**
 * Create a single finding from vulnerability, package, and reachability data
 */
function createFinding(
  vulnerability: Vulnerability,
  pkg: Package,
  reachability: ReachabilityResult
): Finding {
  const { priorityLevel, priorityScore } = calculatePriority(
    vulnerability,
    reachability
  );
  
  const recommendation = generateRecommendation(
    vulnerability,
    pkg,
    reachability,
    priorityLevel
  );
  
  return {
    vulnerability,
    package: pkg,
    reachability,
    priorityLevel,
    priorityScore,
    recommendation
  };
}

/**
 * Calculate priority level and score based on vulnerability severity,
 * reachability, and production/dev status
 */
function calculatePriority(
  vulnerability: Vulnerability,
  reachability: ReachabilityResult
): { priorityLevel: PriorityLevel; priorityScore: number } {
  const severity = vulnerability.severity || 'MEDIUM';
  const isReachable = reachability.isReachable;
  const isProduction = reachability.isProduction;
  const isDevelopment = reachability.isDevelopment;
  
  // Priority logic:
  // - Reachable + prod = highest priority (use vuln severity)
  // - Reachable + dev = medium priority regardless of severity
  // - Unreachable + prod = lower priority (use vuln severity but cap at MEDIUM_UNREACHABLE)
  // - Unreachable + dev = DEV_ONLY (lowest)
  
  let priorityLevel: PriorityLevel;
  let priorityScore: number;
  
  if (isReachable && isProduction) {
    // Reachable in production - highest priority
    switch (severity) {
      case 'CRITICAL':
        priorityLevel = 'CRITICAL_REACHABLE';
        priorityScore = 100;
        break;
      case 'HIGH':
        priorityLevel = 'HIGH_REACHABLE';
        priorityScore = 85;
        break;
      case 'MEDIUM':
        priorityLevel = 'MEDIUM_REACHABLE';
        priorityScore = 70;
        break;
      case 'LOW':
      default:
        priorityLevel = 'LOW_REACHABLE';
        priorityScore = 55;
        break;
    }
  } else if (isReachable && isDevelopment) {
    // Reachable in dev - medium priority regardless of severity
    priorityLevel = 'MEDIUM_REACHABLE';
    priorityScore = 40;
  } else if (!isReachable && isProduction) {
    // Unreachable but in prod tree - lower priority, capped at MEDIUM_UNREACHABLE
    switch (severity) {
      case 'CRITICAL':
        priorityLevel = 'CRITICAL_UNREACHABLE';
        priorityScore = 30;
        break;
      case 'HIGH':
        priorityLevel = 'HIGH_UNREACHABLE';
        priorityScore = 25;
        break;
      case 'MEDIUM':
        priorityLevel = 'MEDIUM_UNREACHABLE';
        priorityScore = 20;
        break;
      case 'LOW':
      default:
        priorityLevel = 'LOW_UNREACHABLE';
        priorityScore = 15;
        break;
    }
  } else {
    // Unreachable + dev = DEV_ONLY (lowest)
    priorityLevel = 'DEV_ONLY';
    priorityScore = 5;
  }
  
  return { priorityLevel, priorityScore };
}

/**
 * Generate recommendation text based on finding details
 */
function generateRecommendation(
  vulnerability: Vulnerability,
  pkg: Package,
  reachability: ReachabilityResult,
  _priorityLevel: PriorityLevel
): string {
  const fixedVersion = vulnerability.fixedVersions?.[0];
  
  if (reachability.isReachable) {
    // Reachable - provide upgrade recommendation with file paths
    let recommendation = `Upgrade ${pkg.name} to ${fixedVersion || 'a patched version'}`;
    
    if (reachability.importedIn.length > 0) {
      const fileList = reachability.importedIn.slice(0, 3).join(', ');
      const moreFiles = reachability.importedIn.length > 3 
        ? ` and ${reachability.importedIn.length - 3} more` 
        : '';
      recommendation += `. Imported in: ${fileList}${moreFiles}`;
    }
    
    return recommendation;
  } else if (reachability.isProduction) {
    // Unreachable but in prod tree
    return `Vulnerable but not directly imported. Safe to defer unless transitively executed.`;
  } else {
    // Dev-only
    return `Dev dependency only — no production exposure.`;
  }
}

/**
 * Legacy function - kept for backward compatibility
 * Use classifyRisk instead
 */
export function calculateRiskScore(
  vulnerability: Vulnerability,
  packageInfo: Package,
  reachability: ReachabilityResult
): any {
  console.warn('calculateRiskScore is deprecated. Use classifyRisk instead.');
  
  const pkgKey = `${packageInfo.name}@${packageInfo.version}`;
  const packageVulnerabilities = new Map([[pkgKey, [vulnerability]]]);
  const findings = classifyRisk(packageVulnerabilities, new Map([[packageInfo.name, reachability]]), [packageInfo]);
  
  if (findings.length === 0) {
    return {
      vulnerability,
      package: packageInfo,
      reachability,
      riskLevel: 'INFO',
      score: 0,
      reasoning: 'No risk calculated'
    };
  }
  
  const finding = findings[0]!;
  return {
    vulnerability: finding.vulnerability,
    package: finding.package,
    reachability: finding.reachability,
    riskLevel: finding.priorityLevel.includes('CRITICAL') ? 'CRITICAL' :
               finding.priorityLevel.includes('HIGH') ? 'HIGH' :
               finding.priorityLevel.includes('MEDIUM') ? 'MEDIUM' : 'LOW',
    score: finding.priorityScore,
    reasoning: finding.recommendation
  };
}

/**
 * Legacy function - kept for backward compatibility
 */
export function generateRemediationSteps(_riskScore: any): any[] {
  console.warn('generateRemediationSteps is deprecated. Use classifyRisk instead.');
  return [];
}

/**
 * Legacy function - kept for backward compatibility
 */
export function createFindings(_riskScores: any[]): any[] {
  console.warn('createFindings is deprecated. Use classifyRisk instead.');
  return [];
}

/**
 * Legacy function - kept for backward compatibility
 */
export function prioritizeFindings(findings: Finding[]): Finding[] {
  console.warn('prioritizeFindings is deprecated. Findings from classifyRisk are already prioritized.');
  return findings;
}

// Made with Bob
