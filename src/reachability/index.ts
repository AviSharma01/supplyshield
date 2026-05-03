/**
 * Reachability Module
 * 
 * Analyzes source code to determine if vulnerable packages are actually imported
 */

import * as fs from 'fs/promises';
import { glob } from 'glob';
import * as parser from '@babel/parser';
import { Package, ReachabilityResult, ImportLocation } from '../types';

/**
 * Extract package name from import path
 * Handles scoped packages, subpaths, and filters out relative/builtin imports
 * 
 * @param importPath - The import path string
 * @returns Package name or null if should be skipped
 */
function extractPackageName(importPath: string): string | null {
  // Skip relative imports
  if (importPath.startsWith('.') || importPath.startsWith('/')) {
    return null;
  }
  
  // Skip node: builtins
  if (importPath.startsWith('node:')) {
    return null;
  }
  
  // Handle scoped packages: @scope/pkg/subpath → @scope/pkg
  if (importPath.startsWith('@')) {
    const parts = importPath.split('/');
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
    return null;
  }
  
  // Handle regular packages: pkg/subpath → pkg
  const firstPart = importPath.split('/')[0];
  return firstPart || null;
}

/**
 * Find all source files in the project
 * 
 * @param projectPath - Path to the project directory
 * @returns Array of absolute file paths
 */
async function findSourceFiles(projectPath: string): Promise<string[]> {
  const patterns = [
    'src/**/*.{js,ts,jsx,tsx,mjs,cjs}',
    'lib/**/*.{js,ts,jsx,tsx,mjs,cjs}',
    'app/**/*.{js,ts,jsx,tsx,mjs,cjs}',
    'pages/**/*.{js,ts,jsx,tsx,mjs,cjs}',
    'routes/**/*.{js,ts,jsx,tsx,mjs,cjs}',
    'api/**/*.{js,ts,jsx,tsx,mjs,cjs}',
    '*.{js,ts,jsx,tsx,mjs,cjs}' // Root level files
  ];
  
  const ignore = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/test/**',
    '**/tests/**',
    '**/__tests__/**',
    '**/*.test.*',
    '**/*.spec.*'
  ];
  
  const allFiles: string[] = [];
  
  for (const pattern of patterns) {
    try {
      const files = await glob(pattern, {
        cwd: projectPath,
        absolute: true,
        ignore,
        nodir: true
      });
      allFiles.push(...files);
    } catch (error) {
      // Pattern might not match anything, continue
      console.warn(`Warning: Pattern ${pattern} failed:`, (error as Error).message);
    }
  }
  
  // Remove duplicates
  return Array.from(new Set(allFiles));
}

/**
 * Parse a file and extract all import statements
 * 
 * @param filePath - Path to the file to parse
 * @returns Array of import locations with package names
 */
async function extractImportsFromFile(filePath: string): Promise<ImportLocation[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Parse with Babel configured for TypeScript + JSX + dynamic imports
    const ast = parser.parse(content, {
      sourceType: 'unambiguous', // Auto-detect module vs script
      plugins: [
        'typescript',
        'jsx',
        'dynamicImport',
        'exportDefaultFrom',
        'exportNamespaceFrom'
      ],
      errorRecovery: true // Try to continue parsing on errors
    });
    
    const imports: ImportLocation[] = [];
    
    // Helper to add import
    const addImport = (importPath: string, line: number, type: ImportLocation['importType'], statement: string) => {
      const packageName = extractPackageName(importPath);
      if (packageName) {
        imports.push({
          file: filePath,
          line,
          importStatement: statement,
          importType: type
        });
      }
    };
    
    // Traverse AST to find imports
    const traverse = (node: any, depth = 0) => {
      if (!node || typeof node !== 'object' || depth > 100) return;
      
      // ES6 static imports: import x from 'pkg'
      if (node.type === 'ImportDeclaration' && node.source?.value) {
        addImport(
          node.source.value,
          node.loc?.start?.line || 0,
          'static',
          `import ... from '${node.source.value}'`
        );
      }
      
      // ES6 dynamic imports: import('pkg')
      else if (node.type === 'Import' && node.parent?.type === 'CallExpression') {
        const arg = node.parent.arguments?.[0];
        if (arg?.type === 'StringLiteral' && arg.value) {
          addImport(
            arg.value,
            node.loc?.start?.line || 0,
            'dynamic',
            `import('${arg.value}')`
          );
        }
      }
      
      // CallExpression for dynamic imports and require
      else if (node.type === 'CallExpression') {
        // Dynamic import: import('pkg')
        if (node.callee?.type === 'Import') {
          const arg = node.arguments?.[0];
          if (arg?.type === 'StringLiteral' && arg.value) {
            addImport(
              arg.value,
              node.loc?.start?.line || 0,
              'dynamic',
              `import('${arg.value}')`
            );
          }
        }
        // CommonJS require: require('pkg')
        else if (node.callee?.type === 'Identifier' && node.callee.name === 'require') {
          const arg = node.arguments?.[0];
          if (arg?.type === 'StringLiteral' && arg.value) {
            addImport(
              arg.value,
              node.loc?.start?.line || 0,
              'require',
              `require('${arg.value}')`
            );
          }
        }
      }
      
      // Re-exports: export * from 'pkg' or export { x } from 'pkg'
      else if (
        (node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') &&
        node.source?.value
      ) {
        addImport(
          node.source.value,
          node.loc?.start?.line || 0,
          'reexport',
          `export ... from '${node.source.value}'`
        );
      }
      
      // Recursively traverse child nodes
      for (const key in node) {
        if (key === 'parent' || key === 'loc' || key === 'range') continue;
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach(c => {
            if (c && typeof c === 'object') {
              c.parent = node;
              traverse(c, depth + 1);
            }
          });
        } else if (child && typeof child === 'object') {
          child.parent = node;
          traverse(child, depth + 1);
        }
      }
    };
    
    traverse(ast);
    return imports;
    
  } catch (error) {
    console.warn(`Warning: Failed to parse ${filePath}:`, (error as Error).message);
    return [];
  }
}

/**
 * Analyze all packages for reachability
 * 
 * @param projectPath - Path to the project directory
 * @param packages - List of packages to analyze
 * @returns Map of package names to reachability results
 */
export async function analyzeReachability(
  projectPath: string,
  packages: Package[]
): Promise<Map<string, ReachabilityResult>> {
  console.log(`\n🔍 Analyzing reachability for ${packages.length} packages...`);
  
  // Find all source files
  const sourceFiles = await findSourceFiles(projectPath);
  console.log(`   Found ${sourceFiles.length} source files to analyze`);
  
  if (sourceFiles.length === 0) {
    console.warn('   Warning: No source files found. Reachability analysis skipped.');
    const results = new Map<string, ReachabilityResult>();
    for (const pkg of packages) {
      results.set(pkg.name, {
        packageName: pkg.name,
        isReachable: false,
        importedIn: [],
        importCount: 0,
        importType: 'static',
        isProduction: !pkg.isDev,
        isDevelopment: pkg.isDev
      });
    }
    return results;
  }
  
  // Extract imports from all files
  const allImports: Map<string, ImportLocation[]> = new Map();
  
  for (const file of sourceFiles) {
    const imports = await extractImportsFromFile(file);
    for (const imp of imports) {
      const packageName = extractPackageName(imp.importStatement.match(/'([^']+)'|"([^"]+)"/)?.[1] || '');
      if (packageName) {
        if (!allImports.has(packageName)) {
          allImports.set(packageName, []);
        }
        allImports.get(packageName)!.push(imp);
      }
    }
  }
  
  console.log(`   Found imports for ${allImports.size} unique packages`);
  
  // Build results map
  const results = new Map<string, ReachabilityResult>();
  
  for (const pkg of packages) {
    const imports = allImports.get(pkg.name) || [];
    const isReachable = imports.length > 0;
    
    // Determine import type
    let importType: ReachabilityResult['importType'] = 'static';
    if (imports.length > 0) {
      const types = new Set(imports.map(i => i.importType));
      if (types.size > 1) {
        importType = 'mixed';
      } else if (types.has('dynamic')) {
        importType = 'dynamic';
      } else if (types.has('require')) {
        importType = 'require';
      } else {
        importType = 'static';
      }
    }
    
    // Get unique file paths
    const importedIn = Array.from(new Set(imports.map(i => i.file)));
    
    results.set(pkg.name, {
      packageName: pkg.name,
      isReachable,
      importedIn,
      importCount: imports.length,
      importType,
      isProduction: !pkg.isDev,
      isDevelopment: pkg.isDev
    });
  }
  
  const reachableCount = Array.from(results.values()).filter(r => r.isReachable).length;
  console.log(`   ✓ ${reachableCount} packages are reachable (${packages.length - reachableCount} unreachable)\n`);
  
  return results;
}

/**
 * Scan source code for imports of a specific package
 * 
 * @param projectPath - Path to the project directory
 * @param packageName - Name of the package to search for
 * @returns Reachability result with import locations
 */
export async function scanForImports(
  projectPath: string,
  packageName: string
): Promise<ReachabilityResult> {
  const sourceFiles = await findSourceFiles(projectPath);
  const imports: ImportLocation[] = [];
  
  for (const file of sourceFiles) {
    const fileImports = await extractImportsFromFile(file);
    for (const imp of fileImports) {
      const impPackageName = extractPackageName(imp.importStatement.match(/'([^']+)'|"([^"]+)"/)?.[1] || '');
      if (impPackageName === packageName) {
        imports.push(imp);
      }
    }
  }
  
  const isReachable = imports.length > 0;
  let importType: ReachabilityResult['importType'] = 'static';
  
  if (imports.length > 0) {
    const types = new Set(imports.map(i => i.importType));
    if (types.size > 1) {
      importType = 'mixed';
    } else if (types.has('dynamic')) {
      importType = 'dynamic';
    } else if (types.has('require')) {
      importType = 'require';
    }
  }
  
  const importedIn = Array.from(new Set(imports.map(i => i.file)));
  
  return {
    packageName,
    isReachable,
    importedIn,
    importCount: imports.length,
    importType,
    isProduction: false,
    isDevelopment: false
  };
}

/**
 * Find all import statements in a file
 * 
 * @param filePath - Path to the file to analyze
 * @returns Array of import locations
 */
export async function findImportsInFile(filePath: string): Promise<ImportLocation[]> {
  return extractImportsFromFile(filePath);
}

/**
 * Determine if an import is in production or development code
 * 
 * @param filePath - Path to the file containing the import
 * @param projectPath - Root path of the project
 * @returns Object indicating production/development status
 */
export function classifyImportContext(
  filePath: string,
  projectPath: string
): { isProduction: boolean; isDevelopment: boolean } {
  const relativePath = filePath.replace(projectPath, '');
  
  // Common patterns for dev-only code
  const devPatterns = [
    /test/i,
    /spec/i,
    /__tests__/,
    /\.test\./,
    /\.spec\./,
    /dev/i,
    /mock/i,
    /fixture/i
  ];
  
  const isDevelopment = devPatterns.some(pattern => pattern.test(relativePath));
  const isProduction = !isDevelopment;
  
  return { isProduction, isDevelopment };
}

/**
 * Trace dependency path to determine if package is reachable
 * 
 * @param packageName - Name of the package
 * @param dependencyTree - Complete dependency tree
 * @returns Array of dependency paths leading to the package
 */
export function traceDependencyPaths(
  packageName: string,
  _dependencyTree: Package[]
): string[][] {
  // TODO: Implement dependency path tracing
  console.log(`Tracing dependency paths for ${packageName}`);
  return [];
}

// Made with Bob
