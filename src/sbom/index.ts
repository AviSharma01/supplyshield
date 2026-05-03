/**
 * SBOM Module
 *
 * Generates CycloneDX 1.5 Software Bill of Materials
 */

import * as fs from 'fs/promises';
import { PackageURL } from 'packageurl-js';
import * as CycloneDX from '@cyclonedx/cyclonedx-library';
import { version as supplyShieldVersion } from '../../package.json';
import { Package } from '../types';

/**
 * Project metadata for SBOM generation
 */
export interface ProjectMetadata {
  name: string;
  version: string;
  license?: string;
}

/**
 * Convert npm integrity hash (base64) to hex format
 *
 * @param integrity - npm integrity string (e.g., "sha512-base64string")
 * @returns Hex-encoded hash or undefined if invalid
 */
function convertIntegrityToHex(integrity: string | undefined): string | undefined {
  if (!integrity) return undefined;
  
  try {
    // npm integrity format: "sha512-base64string"
    const parts = integrity.split('-');
    if (parts.length !== 2 || parts[0] !== 'sha512') {
      return undefined;
    }
    
    const base64Hash = parts[1];
    if (!base64Hash) {
      return undefined;
    }
    const buffer = Buffer.from(base64Hash, 'base64');
    return buffer.toString('hex');
  } catch (error) {
    console.warn(`Failed to convert integrity hash: ${integrity}`, error);
    return undefined;
  }
}

/**
 * Create a PackageURL (purl) for an npm package
 *
 * @param name - Package name (may include scope like @scope/name)
 * @param version - Package version
 * @returns PackageURL instance
 */
function createPackageUrl(name: string, version: string): PackageURL {
  // Handle scoped packages: @scope/name -> namespace=scope, name=name
  let namespace: string | undefined;
  let packageName = name;
  
  if (name.startsWith('@')) {
    const parts = name.substring(1).split('/');
    if (parts.length === 2 && parts[0] && parts[1]) {
      namespace = parts[0];
      packageName = parts[1];
    }
  }
  
  return new PackageURL('npm', namespace, packageName, version, undefined, undefined);
}

/**
 * Convert a Package to a CycloneDX Component
 *
 * @param pkg - Package to convert
 * @returns CycloneDX Component
 */
function packageToComponent(pkg: Package): CycloneDX.Models.Component {
  const component = new CycloneDX.Models.Component(
    CycloneDX.Enums.ComponentType.Library,
    pkg.name,
    {
      version: pkg.version,
      purl: createPackageUrl(pkg.name, pkg.version),
      description: pkg.description
    }
  );
  
  // Add license if available
  if (pkg.license) {
    try {
      const licenseFactory = new CycloneDX.Factories.LicenseFactory();
      const license = licenseFactory.makeFromString(pkg.license);
      component.licenses.add(license);
    } catch (error) {
      console.warn(`Failed to parse license for ${pkg.name}: ${pkg.license}`, error);
    }
  }
  
  // Add hash if integrity is available
  if (pkg.integrity) {
    const hexHash = convertIntegrityToHex(pkg.integrity);
    if (hexHash) {
      component.hashes.set(CycloneDX.Enums.HashAlgorithm['SHA-512'], hexHash);
    }
  }
  
  return component;
}

/**
 * Generate CycloneDX 1.5 SBOM from package list
 *
 * @param packages - List of packages to include in SBOM
 * @param projectMetadata - Project metadata (name, version, license)
 * @returns CycloneDX SBOM as JSON string
 */
export async function generateSBOM(
  packages: Package[],
  projectMetadata: ProjectMetadata
): Promise<string> {
  console.log(`Generating SBOM for ${projectMetadata.name}@${projectMetadata.version} with ${packages.length} packages`);
  
  // Create the BOM with version 1
  const bom = new CycloneDX.Models.Bom({
    version: 1
  });
  
  // Create metadata
  const metadata = new CycloneDX.Models.Metadata();
  
  // Set timestamp
  metadata.timestamp = new Date();
  
  // Create root component (the project itself)
  const rootComponent = new CycloneDX.Models.Component(
    CycloneDX.Enums.ComponentType.Application,
    projectMetadata.name,
    {
      version: projectMetadata.version
    }
  );
  
  // Add project license if available
  if (projectMetadata.license) {
    try {
      const licenseFactory = new CycloneDX.Factories.LicenseFactory();
      const license = licenseFactory.makeFromString(projectMetadata.license);
      rootComponent.licenses.add(license);
    } catch (error) {
      console.warn(`Failed to parse project license: ${projectMetadata.license}`, error);
    }
  }
  
  metadata.component = rootComponent;
  
  // Add SupplyShield as the generator tool
  const tool = new CycloneDX.Models.Tool({
    vendor: 'SupplyShield',
    name: 'supplyshield',
    version: supplyShieldVersion
  });
  metadata.tools.add(tool);
  
  // Set metadata on BOM
  bom.metadata = metadata;
  
  // Convert all packages to components and add to BOM
  for (const pkg of packages) {
    try {
      const component = packageToComponent(pkg);
      bom.components.add(component);
    } catch (error) {
      console.warn(`Failed to convert package ${pkg.name}@${pkg.version} to component:`, error);
    }
  }
  
  // Serialize to JSON using CycloneDX 1.5 spec
  const serializer = new CycloneDX.Serialize.JsonSerializer(
    new CycloneDX.Serialize.JSON.Normalize.Factory(CycloneDX.Spec.Spec1dot5)
  );
  
  const jsonString = serializer.serialize(bom, {
    sortLists: true,  // For reproducible output
    space: 2          // Pretty print with 2-space indentation
  });
  
  console.log(`✓ Generated SBOM with ${bom.components.size} components`);
  
  return jsonString;
}

/**
 * Write SBOM to file
 *
 * @param sbomJson - SBOM as JSON string
 * @param outputPath - Path to write SBOM file
 */
export async function writeSBOM(sbomJson: string, outputPath: string): Promise<void> {
  try {
    await fs.writeFile(outputPath, sbomJson, 'utf-8');
    console.log(`✓ SBOM written to ${outputPath}`);
  } catch (error) {
    throw new Error(`Failed to write SBOM to ${outputPath}: ${(error as Error).message}`);
  }
}

/**
 * Validate SBOM against CycloneDX 1.5 schema
 *
 * @param sbomJson - SBOM JSON string to validate
 * @returns True if valid, throws error if invalid
 */
export async function validateSBOM(sbomJson: string): Promise<boolean> {
  try {
    const validator = new CycloneDX.Validation.JsonStrictValidator(CycloneDX.Spec.Version.v1dot5);
    const validationError = await validator.validate(sbomJson);
    
    if (validationError) {
      console.error('SBOM validation failed:', validationError);
      throw new Error(`SBOM validation failed: ${validationError}`);
    }
    
    console.log('✓ SBOM validated successfully against CycloneDX 1.5 schema');
    return true;
  } catch (error) {
    if (error instanceof CycloneDX.Validation.MissingOptionalDependencyError) {
      console.warn('⚠️  Validation skipped: optional dependencies not installed (ajv, ajv-formats)');
      console.warn('   Install them with: npm install ajv ajv-formats ajv-formats-draft2019');
      return true; // Don't fail if validation dependencies are missing
    }
    throw error;
  }
}

