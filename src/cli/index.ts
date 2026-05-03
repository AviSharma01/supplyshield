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
      const { buildDependencyTree } = await import('../parsers');
      const { scanVulnerabilities } = await import('../vulnerabilities');
      const { analyzeReachability } = await import('../reachability');
      
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
      const vulnerabilities = await scanVulnerabilities(packages);
      
      // Step 3: Analyze reachability (unless skipped)
      let reachabilityMap = new Map();
      if (!options.skipReachability) {
        reachabilityMap = await analyzeReachability(options.path, packages);
      } else {
        console.log('⏭️  Skipping reachability analysis\n');
      }
      
      // Display summary
      console.log(chalk.blue.bold('\n📊 Scan Summary\n'));
      console.log(chalk.gray(`Total packages: ${packages.length}`));
      console.log(chalk.gray(`Total vulnerabilities: ${vulnerabilities.length}`));
      
      if (!options.skipReachability) {
        const reachableCount = Array.from(reachabilityMap.values()).filter(r => r.isReachable).length;
        console.log(chalk.gray(`Reachable packages: ${reachableCount}/${packages.length}`));
        
        // Show reachability breakdown
        const reachableVulnPackages = Array.from(reachabilityMap.values())
          .filter(r => r.isReachable && vulnerabilities.some(v => v.id.includes(r.packageName)));
        console.log(chalk.gray(`Reachable vulnerable packages: ${reachableVulnPackages.length}`));
      }
      
      // Count by severity
      const critical = vulnerabilities.filter(v => v.severity === 'CRITICAL').length;
      const high = vulnerabilities.filter(v => v.severity === 'HIGH').length;
      const medium = vulnerabilities.filter(v => v.severity === 'MEDIUM').length;
      const low = vulnerabilities.filter(v => v.severity === 'LOW').length;
      
      console.log('');
      if (critical > 0) console.log(chalk.red(`  🔴 CRITICAL: ${critical}`));
      if (high > 0) console.log(chalk.red(`  🟠 HIGH:     ${high}`));
      if (medium > 0) console.log(chalk.yellow(`  🟡 MEDIUM:   ${medium}`));
      if (low > 0) console.log(chalk.blue(`  🔵 LOW:      ${low}`));
      
      console.log(chalk.green.bold('\n✓ Scan complete!\n'));
      
      // Exit with error code if critical or high vulnerabilities
      if (critical > 0 || high > 0) {
        console.log(chalk.red.bold('❌ Critical or high severity vulnerabilities found!\n'));
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
      const vulnerabilities = await scanVulnerabilities(packages);
      
      // Step 3: Display summary
      console.log(chalk.blue.bold('\n📊 Vulnerability Summary\n'));
      
      if (vulnerabilities.length === 0) {
        console.log(chalk.green('✓ No vulnerabilities found!'));
        console.log(chalk.gray(`Scanned ${packages.length} packages\n`));
        return;
      }
      
      // Count by severity
      const critical = vulnerabilities.filter(v => v.severity === 'CRITICAL').length;
      const high = vulnerabilities.filter(v => v.severity === 'HIGH').length;
      const medium = vulnerabilities.filter(v => v.severity === 'MEDIUM').length;
      const low = vulnerabilities.filter(v => v.severity === 'LOW').length;
      const unknown = vulnerabilities.filter(v => !v.severity).length;
      
      // Display counts
      console.log(chalk.gray('Total vulnerabilities found: ') + chalk.red.bold(vulnerabilities.length));
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
      const criticalAndHigh = vulnerabilities.filter(
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

