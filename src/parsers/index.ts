/**
 * Parsers Module
 * 
 * Extracts dependency information from package.json and package-lock.json
 */

import { Package } from '../types';

/**
 * Parse package.json to extract dependency information
 * 
 * @param projectPath - Path to the project directory
 * @returns Array of direct dependencies
 */
export async function parsePackageJson(projectPath: string): Promise<Package[]> {
  // TODO: Implement package.json parsing
  console.log(`Parsing package.json at ${projectPath}`);
  return [];
}

/**
 * Parse package-lock.json to extract full dependency tree
 * 
 * @param projectPath - Path to the project directory
 * @returns Array of all dependencies (direct and transitive)
 */
export async function parsePackageLock(projectPath: string): Promise<Package[]> {
  // TODO: Implement package-lock.json parsing
  console.log(`Parsing package-lock.json at ${projectPath}`);
  return [];
}

/**
 * Build complete dependency tree with paths
 * 
 * @param projectPath - Path to the project directory
 * @param includeDev - Whether to include dev dependencies
 * @returns Complete dependency tree
 */
export async function buildDependencyTree(
  projectPath: string,
  includeDev: boolean = false
): Promise<Package[]> {
  // TODO: Implement dependency tree building
  console.log(`Building dependency tree for ${projectPath} (includeDev: ${includeDev})`);
  return [];
}

