#!/usr/bin/env node

/**
 * SupplyShield CLI Entry Point
 * 
 * Main command-line interface for the SupplyShield security scanner.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { version } from '../../package.json';

const program = new Command();

program
  .name('supplyshield')
  .description('Supply chain security scanner with reachability-aware vulnerability analysis')
  .version(version, '-v, --version', 'Display version number');

program
  .command('scan')
  .description('Scan project dependencies for vulnerabilities with reachability analysis')
  .option('-p, --path <path>', 'Project path to scan', process.cwd())
  .option('-o, --output <path>', 'Output path for report', './supplyshield-report.html')
  .option('-f, --format <format>', 'Report format: html, json, or both', 'html')
  .option('--include-dev', 'Include dev dependencies in scan', false)
  .option('--skip-reachability', 'Skip reachability analysis', false)
  .option('--verbose', 'Verbose output', false)
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🛡️  SupplyShield Security Scanner\n'));
    console.log(chalk.gray(`Version: ${version}\n`));
    
    try {
      // Import modules dynamically
      const { buildDependencyTree, parsePackageJson } = await import('../parsers');
      const { scanVulnerabilities } = await import('../vulnerabilities');
      const { analyzeReachability } = await import('../reachability');
      const { classifyRisk } = await import('../risk');
      const { generateHTMLReport, writeHTMLReport } = await import('../report');
      
      console.log(chalk.gray(`Project path: ${options.path}`));
      console.log(chalk.gray(`Output: ${options.output}`));
      console.log(chalk.gray(`Format: ${options.format}`));
      console.log(chalk.gray(`Include dev dependencies: ${options.includeDev}`));
      console.log(chalk.gray(`Skip reachability: ${options.skipReachability}\n`));
      
      // Step 1: Build dependency tree
      console.log('📦 Building dependency tree...');
      const packages = await buildDependencyTree(options.path, options.includeDev);
      
      // Step 2: Scan for vulnerabilities
      console.log('🔍 Scanning for vulnerabilities...');
      const packageVulnerabilities = await scanVulnerabilities(packages);
      
      // Step 3: Analyze reachability (unless skipped)
      let reachabilityMap = new Map();
      if (!options.skipReachability) {
        reachabilityMap = await analyzeReachability(options.path, packages);
      } else {
        console.log('⏭️  Skipping reachability analysis\n');
        // Create default reachability for all packages
        for (const pkg of packages) {
          reachabilityMap.set(pkg.name, {
            packageName: pkg.name,
            isReachable: false,
            importedIn: [],
            importCount: 0,
            importType: 'static' as const,
            isProduction: !pkg.isDev,
            isDevelopment: pkg.isDev
          });
        }
      }
      
      // Step 4: Classify risk and prioritize findings
      console.log('⚖️  Classifying risk and prioritizing findings...');
      const findings = classifyRisk(packageVulnerabilities, reachabilityMap, packages);
      
      // Calculate total vulnerabilities
      const totalVulns = Array.from(packageVulnerabilities.values()).reduce((sum, vulns) => sum + vulns.length, 0);
      
      // Display summary
      console.log(chalk.blue.bold('\n📊 Scan Summary\n'));
      console.log(chalk.gray(`Total packages: ${packages.length}`));
      console.log(chalk.gray(`Total vulnerabilities: ${totalVulns}`));
      console.log(chalk.gray(`Total findings: ${findings.length}`));
      
      if (!options.skipReachability) {
        const reachableCount = Array.from(reachabilityMap.values()).filter(r => r.isReachable).length;
        console.log(chalk.gray(`Reachable packages: ${reachableCount}/${packages.length}`));
        
        const reachableFindings = findings.filter(f => f.reachability.isReachable);
        console.log(chalk.gray(`Reachable findings: ${reachableFindings.length}`));
      }
      
      // Count by priority level
      const criticalReachable = findings.filter(f => f.priorityLevel === 'CRITICAL_REACHABLE').length;
      const highReachable = findings.filter(f => f.priorityLevel === 'HIGH_REACHABLE').length;
      const mediumReachable = findings.filter(f => f.priorityLevel === 'MEDIUM_REACHABLE').length;
      const lowReachable = findings.filter(f => f.priorityLevel === 'LOW_REACHABLE').length;
      const unreachable = findings.filter(f => f.priorityLevel.includes('UNREACHABLE')).length;
      const devOnly = findings.filter(f => f.priorityLevel === 'DEV_ONLY').length;
      
      console.log('');
      if (criticalReachable > 0) console.log(chalk.red.bold(`  🔴 CRITICAL (Reachable): ${criticalReachable}`));
      if (highReachable > 0) console.log(chalk.red(`  🟠 HIGH (Reachable):     ${highReachable}`));
      if (mediumReachable > 0) console.log(chalk.yellow(`  🟡 MEDIUM (Reachable):   ${mediumReachable}`));
      if (lowReachable > 0) console.log(chalk.blue(`  🔵 LOW (Reachable):      ${lowReachable}`));
      if (unreachable > 0) console.log(chalk.gray(`  ⚪ Unreachable:          ${unreachable}`));
      if (devOnly > 0) console.log(chalk.gray(`  ⚫ Dev-only:             ${devOnly}`));
      
      // Display top 10 findings
      if (findings.length > 0) {
        console.log(chalk.blue.bold('\n🎯 Top Priority Findings (Top 10)\n'));
        
        const topFindings = findings.slice(0, 10);
        for (let i = 0; i < topFindings.length; i++) {
          const finding = topFindings[i]!;
          const num = `${i + 1}.`.padEnd(4);
          
          // Color based on priority level
          let badge = '';
          let color = chalk.gray;
          if (finding.priorityLevel === 'CRITICAL_REACHABLE') {
            badge = '🔴';
            color = chalk.red.bold;
          } else if (finding.priorityLevel === 'HIGH_REACHABLE') {
            badge = '🟠';
            color = chalk.red;
          } else if (finding.priorityLevel === 'MEDIUM_REACHABLE') {
            badge = '🟡';
            color = chalk.yellow;
          } else if (finding.priorityLevel === 'LOW_REACHABLE') {
            badge = '🔵';
            color = chalk.blue;
          } else if (finding.priorityLevel.includes('UNREACHABLE')) {
            badge = '⚪';
            color = chalk.gray;
          } else {
            badge = '⚫';
            color = chalk.gray;
          }
          
          console.log(color(`${num}${badge} ${finding.vulnerability.id} in ${finding.package.name}@${finding.package.version}`));
          console.log(color(`     Priority: ${finding.priorityLevel} (Score: ${finding.priorityScore})`));
          console.log(chalk.gray(`     ${finding.recommendation}`));
          console.log('');
        }
        
        if (findings.length > 10) {
          console.log(chalk.gray(`... and ${findings.length - 10} more findings\n`));
        }
      }
      
      // Step 5: Generate HTML report
      console.log('📄 Generating HTML report...');
      const packageJsonData = await parsePackageJson(options.path);
      
      const reportData = {
        metadata: {
          projectName: packageJsonData.name,
          projectVersion: packageJsonData.version,
          scanDate: new Date().toISOString(),
          supplyShieldVersion: version
        },
        summary: {
          totalPackages: packages.length,
          directDependencies: packages.filter(p => p.isDirect).length,
          transitiveDependencies: packages.filter(p => !p.isDirect).length,
          totalVulnerabilities: totalVulns,
          criticalFindings: findings.filter(f =>
            f.priorityLevel === 'CRITICAL_REACHABLE' || f.priorityLevel === 'CRITICAL_UNREACHABLE'
          ).length,
          highFindings: findings.filter(f =>
            f.priorityLevel === 'HIGH_REACHABLE' || f.priorityLevel === 'HIGH_UNREACHABLE'
          ).length,
          mediumFindings: findings.filter(f =>
            f.priorityLevel === 'MEDIUM_REACHABLE' || f.priorityLevel === 'MEDIUM_UNREACHABLE'
          ).length,
          lowFindings: findings.filter(f =>
            f.priorityLevel === 'LOW_REACHABLE' || f.priorityLevel === 'LOW_UNREACHABLE' || f.priorityLevel === 'DEV_ONLY'
          ).length,
          reachableVulnerabilities: findings.filter(f => f.reachability.isReachable).length,
          unreachableVulnerabilities: findings.filter(f => !f.reachability.isReachable).length
        },
        findings,
        generatedAt: new Date().toISOString()
      };
      
      const html = generateHTMLReport(reportData);
      await writeHTMLReport(html, options.output);
      
      console.log(chalk.green.bold('✓ Scan complete!\n'));
      console.log(chalk.cyan(`📊 HTML report saved to: ${options.output}\n`));
      
      // Exit with error code if critical or high reachable vulnerabilities
      if (criticalReachable > 0 || highReachable > 0) {
        console.log(chalk.red.bold('❌ Critical or high severity reachable vulnerabilities found!\n'));
        process.exit(1);
      }
      
    } catch (error) {
      console.error(chalk.red.bold('\n❌ Scan failed\n'));
      console.error(chalk.red((error as Error).message));
      if (options.verbose) {
        console.error(chalk.gray('\nStack trace:'));
        console.error(chalk.gray((error as Error).stack));
      }
      process.exit(1);
    }
  });

program
  .command('sbom')
  .description('Generate CycloneDX SBOM without vulnerability scanning')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('-o, --output <path>', 'Output path for SBOM', './sbom.json')
  .option('--include-dev', 'Include dev dependencies', false)
  .action(async (options) => {
    console.log(chalk.blue.bold('\n📋 Generating SBOM\n'));
    
    try {
      // Import modules dynamically to avoid circular dependencies
      const { buildDependencyTree, parsePackageJson } = await import('../parsers');
      const { generateSBOM, writeSBOM, validateSBOM } = await import('../sbom');
      
      console.log(chalk.gray(`Project path: ${options.path}`));
      console.log(chalk.gray(`Output: ${options.output}`));
      console.log(chalk.gray(`Include dev dependencies: ${options.includeDev}\n`));
      
      // Step 1: Parse package.json for project metadata
      console.log('📦 Parsing project metadata...');
      const packageJsonData = await parsePackageJson(options.path);
      
      // Step 2: Build dependency tree
      console.log('🔍 Building dependency tree...');
      const packages = await buildDependencyTree(options.path, options.includeDev);
      
      // Step 3: Generate SBOM
      console.log('🔨 Generating CycloneDX 1.5 SBOM...');
      const sbomJson = await generateSBOM(packages, {
        name: packageJsonData.name,
        version: packageJsonData.version,
        license: packageJsonData.license
      });
      
      // Step 4: Validate SBOM
      console.log('✅ Validating SBOM...');
      await validateSBOM(sbomJson);
      
      // Step 5: Write SBOM to file
      console.log('💾 Writing SBOM to file...');
      await writeSBOM(sbomJson, options.output);
      
      console.log(chalk.green.bold('\n✓ SBOM generation complete!\n'));
      console.log(chalk.gray(`Generated SBOM: ${options.output}`));
      console.log(chalk.gray(`Total components: ${packages.length}`));
    } catch (error) {
      console.error(chalk.red.bold('\n❌ SBOM generation failed\n'));
      console.error(chalk.red((error as Error).message));
      if (options.verbose) {
        console.error(chalk.gray('\nStack trace:'));
        console.error(chalk.gray((error as Error).stack));
      }
      process.exit(1);
    }
  });

program
  .command('check')
  .description('Check for vulnerabilities without reachability analysis')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('--include-dev', 'Include dev dependencies', false)
  .option('--verbose', 'Verbose output', false)
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🔍 Checking Vulnerabilities\n'));
    
    try {
      // Import modules dynamically
      const { buildDependencyTree } = await import('../parsers');
      const { scanVulnerabilities } = await import('../vulnerabilities');
      
      console.log(chalk.gray(`Project path: ${options.path}`));
      console.log(chalk.gray(`Include dev dependencies: ${options.includeDev}\n`));
      
      // Step 1: Build dependency tree
      console.log('📦 Building dependency tree...');
      const packages = await buildDependencyTree(options.path, options.includeDev);
      
      // Step 2: Scan for vulnerabilities
      const packageVulnerabilities = await scanVulnerabilities(packages);
      
      // Flatten vulnerabilities for display
      const allVulns: any[] = [];
      for (const vulns of packageVulnerabilities.values()) {
        allVulns.push(...vulns);
      }
      
      // Step 3: Display summary
      console.log(chalk.blue.bold('\n📊 Vulnerability Summary\n'));
      
      if (allVulns.length === 0) {
        console.log(chalk.green('✓ No vulnerabilities found!'));
        console.log(chalk.gray(`Scanned ${packages.length} packages\n`));
        return;
      }
      
      // Count by severity
      const critical = allVulns.filter(v => v.severity === 'CRITICAL').length;
      const high = allVulns.filter(v => v.severity === 'HIGH').length;
      const medium = allVulns.filter(v => v.severity === 'MEDIUM').length;
      const low = allVulns.filter(v => v.severity === 'LOW').length;
      const unknown = allVulns.filter(v => !v.severity).length;
      
      // Display counts
      console.log(chalk.gray('Total vulnerabilities found: ') + chalk.red.bold(allVulns.length));
      console.log('');
      
      if (critical > 0) {
        console.log(chalk.red(`  🔴 CRITICAL: ${critical}`));
      }
      if (high > 0) {
        console.log(chalk.red(`  🟠 HIGH:     ${high}`));
      }
      if (medium > 0) {
        console.log(chalk.yellow(`  🟡 MEDIUM:   ${medium}`));
      }
      if (low > 0) {
        console.log(chalk.blue(`  🔵 LOW:      ${low}`));
      }
      if (unknown > 0) {
        console.log(chalk.gray(`  ⚪ UNKNOWN:  ${unknown}`));
      }
      
      // Display critical and high vulnerabilities
      const criticalAndHigh = allVulns.filter(
        v => v.severity === 'CRITICAL' || v.severity === 'HIGH'
      );
      
      if (criticalAndHigh.length > 0) {
        console.log(chalk.red.bold('\n⚠️  Critical & High Severity Vulnerabilities:\n'));
        
        for (const vuln of criticalAndHigh) {
          const severityColor = vuln.severity === 'CRITICAL' ? chalk.red : chalk.red;
          const severityBadge = vuln.severity === 'CRITICAL' ? '🔴' : '🟠';
          
          console.log(`${severityBadge} ${severityColor.bold(vuln.id)} - ${vuln.severity}`);
          console.log(`   ${chalk.gray(vuln.summary)}`);
          
          if (vuln.fixedVersions && vuln.fixedVersions.length > 0) {
            console.log(`   ${chalk.green('Fix:')} Upgrade to ${vuln.fixedVersions.join(', ')}`);
          }
          
          if (options.verbose && vuln.references.length > 0) {
            console.log(`   ${chalk.gray('References:')} ${vuln.references[0]}`);
          }
          
          console.log('');
        }
      }
      
      // Exit with error code if critical or high vulnerabilities found
      if (critical > 0 || high > 0) {
        console.log(chalk.red.bold('❌ Critical or high severity vulnerabilities found!\n'));
        process.exit(1);
      } else {
        console.log(chalk.yellow.bold('⚠️  Medium or low severity vulnerabilities found.\n'));
      }
      
    } catch (error) {
      console.error(chalk.red.bold('\n❌ Vulnerability check failed\n'));
      console.error(chalk.red((error as Error).message));
      if (options.verbose) {
        console.error(chalk.gray('\nStack trace:'));
        console.error(chalk.gray((error as Error).stack));
      }
      process.exit(1);
    }
  });

// Handle unknown commands
program.on('command:*', () => {
  console.error(chalk.red('\n❌ Invalid command'));
  console.log(chalk.gray('Run "supplyshield --help" for available commands\n'));
  process.exit(1);
});

// Show help if no arguments provided
if (process.argv.length === 2) {
  console.log(chalk.blue.bold('🛡️  SupplyShield') + chalk.gray(` v${version}`));
  console.log(chalk.gray('\nSupply chain security scanner with reachability-aware vulnerability analysis\n'));
  program.help();
}

program.parse(process.argv);

