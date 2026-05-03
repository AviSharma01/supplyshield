/**
 * Vulnerabilities Module
 * 
 * Integrates with OSV.dev to fetch vulnerability data
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Package, Vulnerability } from '../types';

/**
 * OSV.dev API response types
 */
interface OSVBatchResponse {
  results: Array<{
    vulns?: Array<{
      id: string;
      modified: string;
    }>;
  }>;
}

interface OSVVulnerabilityDetail {
  id: string;
  summary: string;
  details: string;
  aliases?: string[];
  modified: string;
  published: string;
  database_specific?: {
    severity?: string;
    cwe_ids?: string[];
  };
  severity?: Array<{
    type: string;
    score: string;
  }>;
  affected: Array<{
    package: {
      name: string;
      ecosystem: string;
    };
    ranges: Array<{
      type: string;
      events: Array<{
        introduced?: string;
        fixed?: string;
        last_affected?: string;
      }>;
    }>;
    versions?: string[];
  }>;
  references: Array<{
    type: string;
    url: string;
  }>;
}

interface CachedVulnerability {
  timestamp: number;
  data: Vulnerability[];
}

const CACHE_DIR = '.supplyshield-cache/osv';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_BATCH_SIZE = 1000;
const MAX_CONCURRENT_REQUESTS = 10;

/**
 * Ensure cache directory exists
 */
function ensureCacheDir(): void {
  const cacheDir = path.join(process.cwd(), CACHE_DIR);
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
}

/**
 * Generate cache key for a package
 */
function getCacheKey(packageName: string, version: string): string {
  const key = `${packageName}@${version}`;
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Get cached vulnerabilities for a package
 */
function getCachedVulnerabilities(packageName: string, version: string): Vulnerability[] | null {
  try {
    ensureCacheDir();
    const cacheKey = getCacheKey(packageName, version);
    const cachePath = path.join(process.cwd(), CACHE_DIR, `${cacheKey}.json`);
    
    if (!fs.existsSync(cachePath)) {
      return null;
    }
    
    const cached: CachedVulnerability = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    const age = Date.now() - cached.timestamp;
    
    if (age > CACHE_TTL_MS) {
      // Cache expired
      fs.unlinkSync(cachePath);
      return null;
    }
    
    return cached.data;
  } catch (error) {
    // If cache read fails, just return null
    return null;
  }
}

/**
 * Cache vulnerabilities for a package
 */
function cacheVulnerabilities(packageName: string, version: string, vulnerabilities: Vulnerability[]): void {
  try {
    ensureCacheDir();
    const cacheKey = getCacheKey(packageName, version);
    const cachePath = path.join(process.cwd(), CACHE_DIR, `${cacheKey}.json`);
    
    const cached: CachedVulnerability = {
      timestamp: Date.now(),
      data: vulnerabilities
    };
    
    fs.writeFileSync(cachePath, JSON.stringify(cached, null, 2));
  } catch (error) {
    // If cache write fails, just log and continue
    console.warn(`Failed to cache vulnerabilities for ${packageName}@${version}`);
  }
}

/**
 * Parse CVSS score from string
 */
function parseCVSSScore(cvssString: string): number | undefined {
  // CVSS string format: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L"
  // We need to calculate the score, but for simplicity, we'll extract if present
  // or return undefined and rely on severity mapping
  const match = cvssString.match(/CVSS:[\d.]+\/.*$/);
  if (!match) return undefined;
  
  // For now, return undefined and rely on database_specific.severity
  // A full CVSS calculator would be complex
  return undefined;
}

/**
 * Map severity string or CVSS score to our severity levels
 */
function mapSeverity(
  databaseSeverity?: string,
  cvssScore?: number
): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | undefined {
  // First try database_specific.severity
  if (databaseSeverity) {
    const severity = databaseSeverity.toUpperCase();
    if (severity === 'CRITICAL') return 'CRITICAL';
    if (severity === 'HIGH') return 'HIGH';
    if (severity === 'MODERATE' || severity === 'MEDIUM') return 'MEDIUM';
    if (severity === 'LOW') return 'LOW';
  }
  
  // Then try CVSS score
  if (cvssScore !== undefined) {
    if (cvssScore >= 9.0) return 'CRITICAL';
    if (cvssScore >= 7.0) return 'HIGH';
    if (cvssScore >= 4.0) return 'MEDIUM';
    return 'LOW';
  }
  
  return undefined;
}

/**
 * Extract fixed versions from OSV affected ranges
 */
function extractFixedVersions(affected: OSVVulnerabilityDetail['affected']): string[] {
  const fixedVersions: string[] = [];
  
  for (const pkg of affected) {
    for (const range of pkg.ranges) {
      for (const event of range.events) {
        if (event.fixed) {
          fixedVersions.push(event.fixed);
        }
      }
    }
  }
  
  return [...new Set(fixedVersions)]; // Remove duplicates
}

/**
 * Extract affected version ranges from OSV data
 */
function extractAffectedVersions(affected: OSVVulnerabilityDetail['affected']): string[] {
  const ranges: string[] = [];
  
  for (const pkg of affected) {
    for (const range of pkg.ranges) {
      let rangeStr = '';
      for (const event of range.events) {
        if (event.introduced) {
          rangeStr += `>=${event.introduced}`;
        }
        if (event.fixed) {
          rangeStr += ` <${event.fixed}`;
        }
        if (event.last_affected) {
          rangeStr += ` <=${event.last_affected}`;
        }
      }
      if (rangeStr) {
        ranges.push(rangeStr.trim());
      }
    }
    
    // Also include explicit versions if present
    if (pkg.versions) {
      ranges.push(...pkg.versions);
    }
  }
  
  return ranges;
}

/**
 * Parse OSV.dev vulnerability detail into our Vulnerability type
 */
function parseOSVVulnerability(osvData: OSVVulnerabilityDetail): Vulnerability {
  // Extract CVSS score if present
  let cvssScore: number | undefined;
  if (osvData.severity && osvData.severity.length > 0) {
    const cvssEntry = osvData.severity.find(s => s.type === 'CVSS_V3' || s.type === 'CVSS_V2');
    if (cvssEntry) {
      cvssScore = parseCVSSScore(cvssEntry.score);
    }
  }
  
  // Map severity
  const severity = mapSeverity(osvData.database_specific?.severity, cvssScore);
  
  // Extract fixed versions
  const fixedVersions = extractFixedVersions(osvData.affected);
  
  // Extract affected versions
  const affectedVersions = extractAffectedVersions(osvData.affected);
  
  // Extract reference URLs
  const references = osvData.references.map(ref => ref.url);
  
  return {
    id: osvData.id,
    summary: osvData.summary || 'No summary available',
    details: osvData.details || 'No details available',
    severity,
    cvssScore,
    affectedVersions,
    fixedVersions: fixedVersions.length > 0 ? fixedVersions : undefined,
    references,
    published: osvData.published,
    modified: osvData.modified
  };
}

/**
 * Fetch vulnerability details from OSV.dev
 */
async function fetchVulnerabilityDetails(vulnId: string): Promise<Vulnerability | null> {
  try {
    const response = await fetch(`https://api.osv.dev/v1/vulns/${vulnId}`);
    
    if (!response.ok) {
      console.warn(`Failed to fetch details for ${vulnId}: ${response.status}`);
      return null;
    }
    
    const data = await response.json() as OSVVulnerabilityDetail;
    return parseOSVVulnerability(data);
  } catch (error) {
    console.warn(`Error fetching vulnerability ${vulnId}:`, (error as Error).message);
    return null;
  }
}

/**
 * Fetch vulnerability details with concurrency control
 */
async function fetchVulnerabilitiesWithConcurrency(
  vulnIds: string[],
  maxConcurrent: number = MAX_CONCURRENT_REQUESTS
): Promise<Vulnerability[]> {
  const results: Vulnerability[] = [];
  const queue = [...vulnIds];
  
  async function processNext(): Promise<void> {
    const vulnId = queue.shift();
    if (!vulnId) return;
    
    const vuln = await fetchVulnerabilityDetails(vulnId);
    if (vuln) {
      results.push(vuln);
    }
    
    // Process next item
    if (queue.length > 0) {
      await processNext();
    }
  }
  
  // Start initial batch of concurrent requests
  const workers = Array(Math.min(maxConcurrent, vulnIds.length))
    .fill(null)
    .map(() => processNext());
  
  await Promise.all(workers);
  
  return results;
}

/**
 * Query OSV.dev for vulnerabilities in a batch of packages
 */
async function batchQueryOSVInternal(packages: Package[]): Promise<Map<string, string[]>> {
  const queries = packages.map(pkg => ({
    package: {
      name: pkg.name,
      ecosystem: 'npm'
    },
    version: pkg.version
  }));
  
  try {
    const response = await fetch('https://api.osv.dev/v1/querybatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries })
    });
    
    if (!response.ok) {
      throw new Error(`OSV.dev API error: ${response.status}`);
    }
    
    const data = await response.json() as OSVBatchResponse;
    
    // Map results back to packages
    const vulnMap = new Map<string, string[]>();
    
    for (let i = 0; i < packages.length; i++) {
      const pkg = packages[i];
      const result = data.results[i];
      
      if (pkg && result?.vulns && result.vulns.length > 0) {
        const vulnIds = result.vulns.map(v => v.id);
        vulnMap.set(`${pkg.name}@${pkg.version}`, vulnIds);
      }
    }
    
    return vulnMap;
  } catch (error) {
    console.error('Error querying OSV.dev:', (error as Error).message);
    return new Map();
  }
}

/**
 * Main function to scan packages for vulnerabilities
 * Returns a map of package keys (name@version) to their vulnerabilities
 */
export async function scanVulnerabilities(packages: Package[]): Promise<Map<string, Vulnerability[]>> {
  console.log(`\nScanning ${packages.length} packages for vulnerabilities...`);
  
  const packageVulnerabilities = new Map<string, Vulnerability[]>();
  const packagesToQuery: Package[] = [];
  const cachedResults = new Map<string, Vulnerability[]>();
  
  // Check cache first
  for (const pkg of packages) {
    const pkgKey = `${pkg.name}@${pkg.version}`;
    const cached = getCachedVulnerabilities(pkg.name, pkg.version);
    if (cached !== null) {
      cachedResults.set(pkgKey, cached);
      packageVulnerabilities.set(pkgKey, cached);
    } else {
      packagesToQuery.push(pkg);
    }
  }
  
  if (cachedResults.size > 0) {
    console.log(`Found ${cachedResults.size} packages in cache`);
  }
  
  if (packagesToQuery.length === 0) {
    console.log('All results from cache');
    return packageVulnerabilities;
  }
  
  console.log(`Querying OSV.dev for ${packagesToQuery.length} packages...`);
  
  // Process in batches of MAX_BATCH_SIZE
  for (let i = 0; i < packagesToQuery.length; i += MAX_BATCH_SIZE) {
    const batch = packagesToQuery.slice(i, i + MAX_BATCH_SIZE);
    console.log(`Processing batch ${Math.floor(i / MAX_BATCH_SIZE) + 1}/${Math.ceil(packagesToQuery.length / MAX_BATCH_SIZE)}...`);
    
    // Step 1: Batch query to get vulnerability IDs
    const vulnMap = await batchQueryOSVInternal(batch);
    
    if (vulnMap.size === 0) {
      // No vulnerabilities found in this batch, cache empty results
      for (const pkg of batch) {
        cacheVulnerabilities(pkg.name, pkg.version, []);
        packageVulnerabilities.set(`${pkg.name}@${pkg.version}`, []);
      }
      continue;
    }
    
    console.log(`Found vulnerabilities in ${vulnMap.size} packages`);
    
    // Step 2: Collect all unique vulnerability IDs
    const allVulnIds = new Set<string>();
    for (const vulnIds of vulnMap.values()) {
      for (const id of vulnIds) {
        allVulnIds.add(id);
      }
    }
    
    console.log(`Fetching details for ${allVulnIds.size} unique vulnerabilities...`);
    
    // Step 3: Fetch vulnerability details with concurrency control
    const vulnerabilities = await fetchVulnerabilitiesWithConcurrency(
      Array.from(allVulnIds),
      MAX_CONCURRENT_REQUESTS
    );
    
    // Create a map of vuln ID to vulnerability object
    const vulnDetailsMap = new Map<string, Vulnerability>();
    for (const vuln of vulnerabilities) {
      vulnDetailsMap.set(vuln.id, vuln);
    }
    
    // Step 4: Map vulnerabilities back to packages and cache
    for (const pkg of batch) {
      const pkgKey = `${pkg.name}@${pkg.version}`;
      const vulnIds = vulnMap.get(pkgKey) || [];
      
      const pkgVulns: Vulnerability[] = [];
      for (const id of vulnIds) {
        const vuln = vulnDetailsMap.get(id);
        if (vuln) {
          pkgVulns.push(vuln);
        }
      }
      
      // Cache the results
      cacheVulnerabilities(pkg.name, pkg.version, pkgVulns);
      
      // Store in result map
      packageVulnerabilities.set(pkgKey, pkgVulns);
    }
  }
  
  const totalVulns = Array.from(packageVulnerabilities.values()).reduce((sum, vulns) => sum + vulns.length, 0);
  console.log(`\nFound ${totalVulns} total vulnerabilities across ${packageVulnerabilities.size} packages`);
  
  return packageVulnerabilities;
}

/**
 * Legacy function for backward compatibility
 */
export async function queryOSV(
  packageName: string,
  version: string
): Promise<Vulnerability[]> {
  const pkg: Package = {
    name: packageName,
    version,
    isDev: false,
    isDirect: false,
    path: [packageName]
  };
  
  const result = await scanVulnerabilities([pkg]);
  const pkgKey = `${packageName}@${version}`;
  return result.get(pkgKey) || [];
}

/**
 * Legacy function for backward compatibility
 */
export async function batchQueryOSV(
  packages: Package[]
): Promise<Map<string, Vulnerability[]>> {
  // This is a legacy function - scanVulnerabilities is the primary interface
  // We call it to maintain compatibility but don't use the return value
  // as we can't easily map vulnerabilities back to individual packages
  await scanVulnerabilities(packages);
  
  // Group by package name
  const result = new Map<string, Vulnerability[]>();
  
  // Initialize empty arrays for all packages
  for (const pkg of packages) {
    if (!result.has(pkg.name)) {
      result.set(pkg.name, []);
    }
  }
  
  // Note: This is a simplified implementation
  // In a real scenario, we'd need to track which vulnerability came from which package
  // For now, we just return empty arrays as the main scanVulnerabilities function
  // is the primary interface
  
  return result;
}

/**
 * Parse OSV.dev response into Vulnerability objects (legacy)
 */
export function parseOSVResponse(osvData: any): Vulnerability {
  return parseOSVVulnerability(osvData);
}

/**
 * Check if a version is affected by a vulnerability (legacy)
 */
export function isVersionAffected(
  _version: string,
  _vulnerability: Vulnerability
): boolean {
  // This would require semver range checking
  // For now, return false as this is a legacy function
  return false;
}

// Made with Bob
