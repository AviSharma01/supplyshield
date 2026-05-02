/**
 * SupplyShield Main Entry Point
 *
 * Orchestrates the complete security scanning workflow
 */

import { ScanOptions, Report, ReportMetadata, ReportSummary, ReachabilityResult } from './types';
import { version } from '../package.json';
import * as parsers from './parsers';
import * as sbom from './sbom';
import * as vulnerabilities from './vulnerabilities';
import * as reachability from './reachability';
import * as risk from './risk';
import * as report from './report';

/**
 * Main scan function that orchestrates the entire workflow
 * 
 * @param options - Scan configuration options
 * @returns Complete security report
 */
export async function scan(options: ScanOptions): Promise<Report> {
  console.log('Starting SupplyShield scan...');
  
  // Step 1: Parse dependencies
  console.log('Step 1: Parsing dependencies...');
  const packages = await parsers.buildDependencyTree(
    options.projectPath,
    options.includeDev
  );
  
  // Step 2: Generate SBOM
  console.log('Step 2: Generating SBOM...');
  // TODO: Extract project name and version from package.json
  const sbomData = await sbom.generateSBOM(
    packages,
    'project-name',
    '1.0.0'
  );
  
  // Step 3: Query vulnerabilities
  console.log('Step 3: Querying vulnerabilities...');
  const vulnMap = await vulnerabilities.batchQueryOSV(packages);
  
  // Step 4: Analyze reachability (if not skipped)
  console.log('Step 4: Analyzing reachability...');
  let reachabilityMap = new Map();
  if (!options.skipReachability) {
    reachabilityMap = await reachability.analyzeReachability(
      options.projectPath,
      packages
    );
  }
  
  // Step 5: Calculate risk scores
  console.log('Step 5: Calculating risk scores...');
  const riskScores = [];
  
  // Create default reachability result for when analysis is skipped
  const defaultReachability: ReachabilityResult = {
    packageName: '',
    isImported: false,
    importLocations: [],
    isProduction: false,
    isDevelopment: false
  };
  
  for (const pkg of packages) {
    const vulns = vulnMap.get(pkg.name) || [];
    const reach = reachabilityMap.get(pkg.name) || {
      ...defaultReachability,
      packageName: pkg.name
    };
    
    for (const vuln of vulns) {
      const score = risk.calculateRiskScore(vuln, pkg, reach);
      riskScores.push(score);
    }
  }
  
  // Step 6: Create and prioritize findings
  console.log('Step 6: Creating findings...');
  const findings = risk.createFindings(riskScores);
  const prioritizedFindings = risk.prioritizeFindings(findings);
  
  // Step 7: Generate report
  console.log('Step 7: Generating report...');
  // TODO: Extract project name and version from package.json
  const metadata: ReportMetadata = {
    projectName: 'project-name',
    projectVersion: '1.0.0',
    scanDate: new Date().toISOString(),
    supplyShieldVersion: version
  };
  
  const summary: ReportSummary = {
    totalPackages: packages.length,
    directDependencies: packages.filter(p => p.isDirect).length,
    transitiveDependencies: packages.filter(p => !p.isDirect).length,
    totalVulnerabilities: riskScores.length,
    criticalFindings: prioritizedFindings.filter(f => f.riskScore.riskLevel === 'CRITICAL').length,
    highFindings: prioritizedFindings.filter(f => f.riskScore.riskLevel === 'HIGH').length,
    mediumFindings: prioritizedFindings.filter(f => f.riskScore.riskLevel === 'MEDIUM').length,
    lowFindings: prioritizedFindings.filter(f => f.riskScore.riskLevel === 'LOW').length,
    reachableVulnerabilities: prioritizedFindings.filter(f => f.riskScore.reachability.isImported).length,
    unreachableVulnerabilities: prioritizedFindings.filter(f => !f.riskScore.reachability.isImported).length
  };
  
  const finalReport: Report = {
    metadata,
    summary,
    findings: prioritizedFindings,
    sbom: sbomData,
    generatedAt: new Date().toISOString()
  };
  
  console.log('Scan complete!');
  return finalReport;
}

/**
 * Generate and save report in specified format(s)
 * 
 * @param reportData - Complete report data
 * @param outputPath - Path to save the report
 * @param format - Report format (html, json, or both)
 */
export async function saveReport(
  reportData: Report,
  outputPath: string,
  format: 'html' | 'json' | 'both' = 'html'
): Promise<void> {
  if (format === 'html' || format === 'both') {
    const html = report.generateHTMLReport(reportData);
    const htmlPath = outputPath.endsWith('.html') ? outputPath : `${outputPath}.html`;
    await report.writeHTMLReport(html, htmlPath);
    console.log(`HTML report saved to ${htmlPath}`);
  }
  
  if (format === 'json' || format === 'both') {
    const json = report.generateJSONReport(reportData);
    const jsonPath = outputPath.replace('.html', '.json');
    await report.writeJSONReport(json, jsonPath);
    console.log(`JSON report saved to ${jsonPath}`);
  }
}

// Export all modules for direct access if needed
export { parsers, sbom, vulnerabilities, reachability, risk, report };
export * from './types';
