/**
 * Parsers Module
 * 
 * Extracts dependency information from package.json and package-lock.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { Package } from '../types';

/**
 * Internal type definitions for package-lock.json structure
 */
interface PackageLockV3 {
  name: string;
  version: string;
  lockfileVersion: number;
  requires?: boolean;
  packages: {
    [key: string]: PackageLockEntry;
  };
}

interface PackageLockEntry {
  name?: string;
  version?: string;
  resolved?: string;
  integrity?: string;
  license?: string;
  dependencies?: { [key: string]: string };
  devDependencies?: { [key: string]: string };
  optionalDependencies?: { [key: string]: string };
  peerDependencies?: { [key: string]: string };
  dev?: boolean;
  optional?: boolean;
}

interface PackageJsonData {
  name: string;
  version: string;
  license?: string;
  dependencies?: { [key: string]: string };
  devDependencies?: { [key: string]: string };
}

/**
 * Parse package.json to extract dependency information
 * 
 * @param projectPath - Path to the project directory
 * @returns Project metadata and direct dependencies
 */
export async function parsePackageJson(projectPath: string): Promise<PackageJsonData> {
  const packageJsonPath = path.join(projectPath, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`package.json not found at ${projectPath}`);
  }
  
  try {
    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    const data = JSON.parse(content);
    
    return {
      name: data.name || 'unknown',
      version: data.version || '0.0.0',
      license: data.license,
      dependencies: data.dependencies || {},
      devDependencies: data.devDependencies || {}
    };
  } catch (error) {
    throw new Error(`Failed to parse package.json: ${(error as Error).message}`);
  }
}

/**
 * Parse package-lock.json to extract full dependency tree
 * 
 * @param projectPath - Path to the project directory
 * @param packageJsonData - Data from package.json for context
 * @returns Array of all dependencies (direct and transitive)
 */
export async function parsePackageLock(
  projectPath: string,
  packageJsonData: PackageJsonData
): Promise<Package[]> {
  const lockfilePath = path.join(projectPath, 'package-lock.json');
  
  if (!fs.existsSync(lockfilePath)) {
    throw new Error(`package-lock.json not found at ${projectPath}`);
  }
  
  let lockfile: PackageLockV3;
  try {
    const content = fs.readFileSync(lockfilePath, 'utf-8');
    lockfile = JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse package-lock.json: ${(error as Error).message}`);
  }
  
  // Validate lockfile version
  if (lockfile.lockfileVersion < 2) {
    throw new Error(
      'Lockfile version 1 is not supported. Please upgrade to npm 7+ (lockfile version 2 or 3)'
    );
  }
  
  if (!lockfile.packages) {
    throw new Error('Invalid package-lock.json structure: missing packages field');
  }
  
  // Build sets of direct dependencies for quick lookup
  const directDeps = new Set(Object.keys(packageJsonData.dependencies || {}));
  const directDevDeps = new Set(Object.keys(packageJsonData.devDependencies || {}));
  
  const result: Package[] = [];
  
  // Add root package
  const rootEntry = lockfile.packages[''];
  if (rootEntry) {
    result.push({
      name: packageJsonData.name,
      version: packageJsonData.version,
      isDev: false,
      isDirect: true,
      path: [packageJsonData.name],
      license: packageJsonData.license || rootEntry.license,
      resolved: undefined,
      integrity: undefined
    });
  }
  
  // In lockfile v3, all packages are flat at the top level
  // Process all packages in the lockfile
  for (const [pkgKey, entry] of Object.entries(lockfile.packages)) {
    // Skip root package (already added)
    if (pkgKey === '') continue;
    
    // Skip if no version (invalid entry)
    if (!entry.version) {
      console.warn(`Package ${pkgKey} missing version, skipping`);
      continue;
    }
    
    // Extract package name from key
    const nameParts = pkgKey.split('node_modules/').filter(Boolean);
    const packageName = nameParts[nameParts.length - 1];
    
    // Skip if package name couldn't be extracted
    if (!packageName) {
      console.warn(`Could not extract package name from key: ${pkgKey}`);
      continue;
    }
    
    // Determine if this is a direct dependency
    const isDirect = directDeps.has(packageName) || directDevDeps.has(packageName);
    
    // Determine if this is a dev dependency
    const isDev = directDevDeps.has(packageName) && isDirect;
    
    // For now, use simple path (we'll enhance this later if needed)
    const pkgPath = [packageJsonData.name, packageName];
    
    // Create Package object
    const pkg: Package = {
      name: packageName,
      version: entry.version,
      isDev,
      isDirect,
      path: pkgPath,
      license: entry.license || 'UNKNOWN',
      resolved: entry.resolved,
      integrity: entry.integrity
    };
    
    result.push(pkg);
  }
  
  return result;
}

/**
 * Build complete dependency tree with paths
 * 
 * @param projectPath - Path to the project directory
 * @param includeDev - Whether to include dev dependencies
 * @returns Complete dependency tree as flat array
 */
export async function buildDependencyTree(
  projectPath: string,
  includeDev: boolean = false
): Promise<Package[]> {
  console.log(`Building dependency tree for ${projectPath} (includeDev: ${includeDev})`);
  
  // Step 1: Parse package.json
  const packageJsonData = await parsePackageJson(projectPath);
  console.log(`Project: ${packageJsonData.name}@${packageJsonData.version}`);
  
  // Step 2: Parse package-lock.json
  const allPackages = await parsePackageLock(projectPath, packageJsonData);
  
  // Step 3: Filter by includeDev flag
  const filteredPackages = includeDev 
    ? allPackages 
    : allPackages.filter(pkg => !pkg.isDev);
  
  console.log(`Total packages: ${filteredPackages.length}`);
  console.log(`Direct dependencies: ${filteredPackages.filter(p => p.isDirect).length}`);
  console.log(`Transitive dependencies: ${filteredPackages.filter(p => !p.isDirect).length}`);
  
  if (includeDev) {
    console.log(`Production packages: ${filteredPackages.filter(p => !p.isDev).length}`);
    console.log(`Development packages: ${filteredPackages.filter(p => p.isDev).length}`);
  }
  
  return filteredPackages;
}

// Made with Bob
