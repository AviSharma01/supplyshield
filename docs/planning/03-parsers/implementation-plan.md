# Parsers Module Implementation Plan

## Overview
Implement npm dependency parsers to extract structured dependency information from `package.json` and `package-lock.json` files for SBOM generation, vulnerability scanning, and reachability analysis.

## Architecture

### Output Format
- **FLAT array** of Package objects (not nested tree)
- Each Package contains full dependency path from root
- Flags for direct/transitive and prod/dev classification

### Package Interface Updates
Add to existing Package interface in `src/types/index.ts`:
```typescript
export interface Package {
  name: string;
  version: string;
  isDev: boolean;
  isDirect: boolean;
  path: string[];           // e.g., ["supplyshield", "axios", "follow-redirects"]
  license?: string;
  description?: string;
  resolved?: string;        // NEW: npm registry URL
  integrity?: string;       // NEW: SHA-512 hash
}
```

## Implementation Strategy

### 1. Type Definitions (Internal)
Create internal types for package-lock.json structure:

```typescript
interface PackageLockV3 {
  name: string;
  version: string;
  lockfileVersion: 2 | 3;
  requires?: boolean;
  packages: {
    [key: string]: PackageLockEntry;
  };
}

interface PackageLockEntry {
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
```

### 2. parsePackageJson Function
**Purpose**: Extract project metadata and direct dependencies

**Input**: `projectPath` (string)

**Output**: 
```typescript
{
  projectName: string;
  projectVersion: string;
  projectLicense?: string;
  dependencies: { [key: string]: string };
  devDependencies: { [key: string]: string };
}
```

**Logic**:
1. Read `package.json` from `projectPath`
2. Extract name, version, license
3. Extract dependencies and devDependencies objects
4. Handle missing fields gracefully (return empty objects)
5. Validate JSON structure

### 3. parsePackageLock Function
**Purpose**: Parse lockfile and build flat dependency array

**Input**: `projectPath` (string), `packageJsonData` (from step 2)

**Output**: `Package[]` (flat array)

**Algorithm**:

```
1. Read package-lock.json
2. Validate lockfileVersion (2 or 3 only)
3. Get root package entry (key: "")
4. Initialize:
   - result: Package[] = []
   - visited: Set<string> = new Set()
   - directDeps = Set(Object.keys(packageJsonData.dependencies))
   - directDevDeps = Set(Object.keys(packageJsonData.devDependencies))

5. Walk dependency tree:
   walkDependencies(
     packages: lockfile.packages,
     currentPath: string[],
     isDevSubtree: boolean
   ) {
     for each package in packages:
       - Skip if already visited (circular dependency)
       - Extract: name, version, resolved, integrity, license
       - Determine isDirect: name in directDeps or directDevDeps
       - Determine isDev: isDevSubtree OR (isDirect AND name in directDevDeps)
       - Build path: [...currentPath, name]
       - Add to result array
       - Mark as visited
       - Recursively walk dependencies if present
   }

6. Start walks:
   - walkDependencies(packages, [projectName], false)  // prod deps
   - walkDependencies(packages, [projectName], true)   // dev deps

7. Return deduplicated result array
```

### 4. Dependency Path Resolution

**Challenge**: In lockfile v3, packages are stored flat with keys like:
- `""` (root)
- `"node_modules/axios"`
- `"node_modules/axios/node_modules/follow-redirects"`

**Solution**: Parse package keys to build dependency paths:
```typescript
function parsePackageKey(key: string): string[] {
  // "node_modules/axios/node_modules/follow-redirects"
  // -> ["axios", "follow-redirects"]
  return key.split('node_modules/').filter(Boolean);
}
```

### 5. Edge Cases to Handle

#### Missing License
```typescript
license: entry.license || 'UNKNOWN'
```

#### Packages in Both Prod and Dev
- If package appears in both dependency trees, create TWO entries:
  - One with `isDev: false` (prod path)
  - One with `isDev: true` (dev path)
- Different paths distinguish them

#### Optional Dependencies
- Include in tree but note they may not be installed
- Track with `optional: true` flag (add to Package interface if needed)

#### Peer Dependencies
- NOT part of dependency tree (not installed by npm)
- Skip during tree walk
- Could log as informational

#### Circular Dependencies
- Use `visited` Set with composite key: `${name}@${version}:${path.join('>')}`
- Skip if already visited on same path
- Rare in practice due to npm's flat structure

### 6. buildDependencyTree Orchestrator

**Purpose**: Main entry point that coordinates parsing

**Input**: `projectPath` (string), `includeDev` (boolean)

**Output**: `Package[]`

**Logic**:
```typescript
1. Call parsePackageJson(projectPath)
2. Call parsePackageLock(projectPath, packageJsonData)
3. If !includeDev:
   - Filter out packages where isDev === true
4. Return filtered array
```

## Testing Strategy

### Test Data
- Use provided local project path with real package-lock.json
- Should have mix of:
  - Direct and transitive dependencies
  - Prod and dev dependencies
  - Various license types
  - Nested dependency chains

### Validation
1. Print parsed tree to console
2. Verify counts:
   - Total packages
   - Direct vs transitive
   - Prod vs dev
3. Spot-check dependency paths
4. Verify all packages have required fields

### Test Output Format
```
📦 Parsed Dependency Tree
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Project: <name> v<version>
Total Packages: <count>
Direct Dependencies: <count> (prod: <count>, dev: <count>)
Transitive Dependencies: <count>

Sample Packages:
┌─────────────────────────────────────────────────────────────────────────────┐
│ axios@1.16.0                                                                │
│ ├─ Type: Direct, Production                                                 │
│ ├─ License: MIT                                                             │
│ ├─ Path: supplyshield → axios                                               │
│ └─ Integrity: sha512-...                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ follow-redirects@1.16.0                                                     │
│ ├─ Type: Transitive, Production                                             │
│ ├─ License: MIT                                                             │
│ ├─ Path: supplyshield → axios → follow-redirects                            │
│ └─ Integrity: sha512-...                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Error Handling

### File Not Found
```typescript
if (!fs.existsSync(packageJsonPath)) {
  throw new Error(`package.json not found at ${projectPath}`);
}
```

### Invalid JSON
```typescript
try {
  const data = JSON.parse(content);
} catch (error) {
  throw new Error(`Invalid JSON in package.json: ${error.message}`);
}
```

### Unsupported Lockfile Version
```typescript
if (lockfile.lockfileVersion < 2) {
  throw new Error('Lockfile version 1 is not supported. Please upgrade to npm 7+');
}
```

### Missing Required Fields
```typescript
if (!entry.version) {
  console.warn(`Package ${name} missing version, skipping`);
  continue;
}
```

## Implementation Order

1. ✅ Update Package interface with `resolved` and `integrity`
2. ✅ Create internal type definitions
3. ✅ Implement `parsePackageJson`
4. ✅ Implement `parsePackageLock` core logic
5. ✅ Implement dependency tree walker
6. ✅ Add direct/transitive detection
7. ✅ Add prod/dev detection
8. ✅ Handle edge cases
9. ✅ Implement `buildDependencyTree` orchestrator
10. ✅ Add error handling
11. ✅ Test with real project
12. ✅ Refine based on test results

## Success Criteria

- [ ] Parses package.json correctly
- [ ] Parses package-lock.json v2 and v3
- [ ] Returns flat array of Package objects
- [ ] Correctly identifies direct vs transitive
- [ ] Correctly identifies prod vs dev
- [ ] Builds accurate dependency paths
- [ ] Handles missing licenses gracefully
- [ ] Handles circular dependencies
- [ ] Comprehensive error handling
- [ ] Successfully parses real-world project

## Next Steps

After plan approval:
1. Switch to Code mode
2. Implement changes following this plan
3. Test with provided project path
4. Iterate based on test results