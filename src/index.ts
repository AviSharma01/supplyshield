/**
 * SupplyShield Main Entry Point
 *
 * Orchestrates the complete security scanning workflow
 */

import { ScanOptions, Report, ReportMetadata, ReportSummary } from './types';
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
  const packageJsonData = await parsers.parsePackageJson(options.projectPath);
  const sbomData = await sbom.generateSBOM(
    packages,
    {
      name: packageJsonData.name,
      version: packageJsonData.version,
      license: packageJsonData.license
    }
  );
  
  // Step 3: Query vulnerabilities
  console.log('Step 3: Querying vulnerabilities...');
  const packageVulnerabilities = await vulnerabilities.scanVulnerabilities(packages);
  
  // Step 4: Analyze reachability (if not skipped)
  console.log('Step 4: Analyzing reachability...');
  let reachabilityMap = new Map();
  if (!options.skipReachability) {
    reachabilityMap = await reachability.analyzeReachability(
      options.projectPath,
      packages
    );
  } else {
    // Create default reachability for all packages when skipped
    for (const pkg of packages) {
      reachabilityMap.set(pkg.name, {
        packageName: pkg.name,
        isReachable: false,
        importedIn: [],
        importCount: 0,
        importType: 'static',
        isProduction: !pkg.isDev,
        isDevelopment: pkg.isDev
      });
    }
  }
  
  // Step 5: Classify risk and create prioritized findings
  console.log('Step 5: Classifying risk and prioritizing findings...');
  const prioritizedFindings = risk.classifyRisk(
    packageVulnerabilities,
    reachabilityMap,
    packages
  );
  
  // Step 6: Generate report
  console.log('Step 6: Generating report...');
  const metadata: ReportMetadata = {
    projectName: packageJsonData.name,
    projectVersion: packageJsonData.version,
    scanDate: new Date().toISOString(),
    supplyShieldVersion: version
  };
  
  // Calculate total vulnerabilities from the map
  const totalVulns = Array.from(packageVulnerabilities.values()).reduce((sum, vulns) => sum + vulns.length, 0);
  
  const summary: ReportSummary = {
    totalPackages: packages.length,
    directDependencies: packages.filter(p => p.isDirect).length,
    transitiveDependencies: packages.filter(p => !p.isDirect).length,
    totalVulnerabilities: totalVulns,
    criticalFindings: prioritizedFindings.filter(f =>
      f.priorityLevel === 'CRITICAL_REACHABLE' || f.priorityLevel === 'CRITICAL_UNREACHABLE'
    ).length,
    highFindings: prioritizedFindings.filter(f =>
      f.priorityLevel === 'HIGH_REACHABLE' || f.priorityLevel === 'HIGH_UNREACHABLE'
    ).length,
    mediumFindings: prioritizedFindings.filter(f =>
      f.priorityLevel === 'MEDIUM_REACHABLE' || f.priorityLevel === 'MEDIUM_UNREACHABLE'
    ).length,
    lowFindings: prioritizedFindings.filter(f =>
      f.priorityLevel === 'LOW_REACHABLE' || f.priorityLevel === 'LOW_UNREACHABLE' || f.priorityLevel === 'DEV_ONLY'
    ).length,
    reachableVulnerabilities: prioritizedFindings.filter(f => f.reachability.isReachable).length,
    unreachableVulnerabilities: prioritizedFindings.filter(f => !f.reachability.isReachable).length
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
