/**
 * Test script for reachability module
 * 
 * Run with: npx tsx test-reachability.ts [project-path]
 */

import { buildDependencyTree } from './src/parsers';
import { analyzeReachability } from './src/reachability';

async function testReachability(projectPath: string) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 Testing Reachability Module');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    // Step 1: Build dependency tree (production only for cleaner results)
    console.log('📦 Building dependency tree (production only)...\n');
    const packages = await buildDependencyTree(projectPath, false);
    
    console.log(`   Total packages: ${packages.length}`);
    console.log(`   Direct dependencies: ${packages.filter(p => p.isDirect).length}`);
    console.log(`   Transitive dependencies: ${packages.filter(p => !p.isDirect).length}\n`);
    
    // Step 2: Analyze reachability
    const reachabilityMap = await analyzeReachability(projectPath, packages);
    
    // Step 3: Analyze results
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 Reachability Analysis Results\n');
    
    const reachablePackages = Array.from(reachabilityMap.values()).filter(r => r.isReachable);
    const unreachablePackages = Array.from(reachabilityMap.values()).filter(r => !r.isReachable);
    
    console.log(`   Total packages analyzed: ${reachabilityMap.size}`);
    console.log(`   Reachable packages: ${reachablePackages.length}`);
    console.log(`   Unreachable packages: ${unreachablePackages.length}`);
    console.log(`   Reachability rate: ${((reachablePackages.length / reachabilityMap.size) * 100).toFixed(1)}%\n`);
    
    // Import type breakdown
    const importTypeBreakdown = new Map<string, number>();
    for (const result of reachablePackages) {
      importTypeBreakdown.set(result.importType, (importTypeBreakdown.get(result.importType) || 0) + 1);
    }
    
    console.log('   Import type breakdown:');
    for (const [type, count] of importTypeBreakdown.entries()) {
      console.log(`     ${type}: ${count}`);
    }
    
    // Step 4: Show reachable packages
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📋 Reachable Packages (sorted by import count):\n');
    
    const sortedReachable = reachablePackages.sort((a, b) => b.importCount - a.importCount);
    
    for (const result of sortedReachable) {
      console.log(`┌─────────────────────────────────────────────────────────────────────────────┐`);
      console.log(`│ ${result.packageName}`.padEnd(78) + '│');
      console.log(`│ ├─ Import count: ${result.importCount}`.padEnd(78) + '│');
      console.log(`│ ├─ Import type: ${result.importType}`.padEnd(78) + '│');
      console.log(`│ ├─ Imported in ${result.importedIn.length} file(s)`.padEnd(78) + '│');
      
      // Show first few files
      const filesToShow = result.importedIn.slice(0, 3);
      for (let i = 0; i < filesToShow.length; i++) {
        const file = filesToShow[i];
        const relativePath = file.replace(projectPath, '').replace(/^\//, '');
        const prefix = i === filesToShow.length - 1 && result.importedIn.length <= 3 ? '└─' : '├─';
        const displayPath = relativePath.length > 60 ? '...' + relativePath.slice(-57) : relativePath;
        console.log(`│ │  ${prefix} ${displayPath}`.padEnd(78) + '│');
      }
      
      if (result.importedIn.length > 3) {
        console.log(`│ │  └─ ... and ${result.importedIn.length - 3} more file(s)`.padEnd(78) + '│');
      }
      
      console.log(`└─────────────────────────────────────────────────────────────────────────────┘`);
    }
    
    // Step 5: Show sample unreachable packages
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📋 Sample Unreachable Packages (first 10):\n');
    
    const sampleUnreachable = unreachablePackages.slice(0, 10);
    for (const result of sampleUnreachable) {
      console.log(`   • ${result.packageName}`);
    }
    
    if (unreachablePackages.length > 10) {
      console.log(`   ... and ${unreachablePackages.length - 10} more`);
    }
    
    // Step 6: Direct dependencies analysis
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 Direct Dependencies Analysis:\n');
    
    const directPackages = packages.filter(p => p.isDirect && p.name !== packages[0].name);
    const reachableDirectCount = directPackages.filter(p => {
      const result = reachabilityMap.get(p.name);
      return result?.isReachable;
    }).length;
    
    console.log(`   Total direct dependencies: ${directPackages.length}`);
    console.log(`   Reachable direct dependencies: ${reachableDirectCount}`);
    console.log(`   Unreachable direct dependencies: ${directPackages.length - reachableDirectCount}`);
    console.log(`   Direct dependency reachability: ${((reachableDirectCount / directPackages.length) * 100).toFixed(1)}%`);
    
    // Step 7: Transitive dependencies analysis
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 Transitive Dependencies Analysis:\n');
    
    const transitivePackages = packages.filter(p => !p.isDirect);
    const reachableTransitiveCount = transitivePackages.filter(p => {
      const result = reachabilityMap.get(p.name);
      return result?.isReachable;
    }).length;
    
    console.log(`   Total transitive dependencies: ${transitivePackages.length}`);
    console.log(`   Reachable transitive dependencies: ${reachableTransitiveCount}`);
    console.log(`   Unreachable transitive dependencies: ${transitivePackages.length - reachableTransitiveCount}`);
    console.log(`   Transitive dependency reachability: ${((reachableTransitiveCount / transitivePackages.length) * 100).toFixed(1)}%`);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Reachability test completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('\n❌ Error during reachability analysis:');
    console.error(error);
    process.exit(1);
  }
}

// Get project path from command line or use ~/Desktop/express
const projectPath = process.argv[2] || `${process.env.HOME}/Desktop/express`;
console.log(`Testing with project: ${projectPath}\n`);
testReachability(projectPath);

// Made with Bob
