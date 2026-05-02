# Parsers Module Architecture

## High-Level Flow

```mermaid
graph TD
    A[User calls buildDependencyTree] --> B[parsePackageJson]
    B --> C[Read package.json]
    C --> D[Extract metadata & deps]
    D --> E[parsePackageLock]
    E --> F[Read package-lock.json]
    F --> G[Validate lockfile version]
    G --> H[Walk dependency tree]
    H --> I[Build flat Package array]
    I --> J[Filter by includeDev flag]
    J --> K[Return Package array]
```

## Data Flow

```mermaid
graph LR
    A[package.json] -->|parsePackageJson| B[Project Metadata]
    C[package-lock.json] -->|parsePackageLock| D[Raw Lockfile Data]
    B --> E[Tree Walker]
    D --> E
    E -->|walkDependencies| F[Flat Package Array]
    F -->|filter| G[Final Package Array]
```

## Package-lock.json Structure (v3)

```
{
  "name": "supplyshield",
  "version": "0.1.0",
  "lockfileVersion": 3,
  "packages": {
    "": {                                    // Root package
      "name": "supplyshield",
      "version": "0.1.0",
      "dependencies": { ... },
      "devDependencies": { ... }
    },
    "node_modules/axios": {                  // Direct dependency
      "version": "1.16.0",
      "resolved": "https://...",
      "integrity": "sha512-...",
      "license": "MIT",
      "dependencies": {
        "follow-redirects": "^1.16.0"
      }
    },
    "node_modules/follow-redirects": {       // Transitive dependency
      "version": "1.16.0",
      "resolved": "https://...",
      "integrity": "sha512-...",
      "license": "MIT"
    }
  }
}
```

## Tree Walking Algorithm

```mermaid
graph TD
    A[Start: Root Package] --> B{Has dependencies?}
    B -->|Yes| C[For each dependency]
    B -->|No| D[Return]
    C --> E{Already visited?}
    E -->|Yes| F[Skip - Circular]
    E -->|No| G[Create Package object]
    G --> H[Set isDirect flag]
    H --> I[Set isDev flag]
    I --> J[Build dependency path]
    J --> K[Add to result array]
    K --> L[Mark as visited]
    L --> M{Has sub-dependencies?}
    M -->|Yes| N[Recurse into sub-deps]
    M -->|No| C
    N --> C
    F --> C
    C --> D
```

## Package Object Construction

```
Input: Lockfile Entry
├─ name: "axios"
├─ version: "1.16.0"
├─ resolved: "https://registry.npmjs.org/axios/-/axios-1.16.0.tgz"
├─ integrity: "sha512-..."
├─ license: "MIT"
└─ dependencies: { "follow-redirects": "^1.16.0" }

Context:
├─ currentPath: ["supplyshield"]
├─ isDevSubtree: false
├─ directDeps: Set(["axios", "chalk", ...])
└─ directDevDeps: Set(["typescript", "tsx", ...])

Output: Package Object
{
  name: "axios",
  version: "1.16.0",
  isDev: false,                              // Not in dev subtree
  isDirect: true,                            // In directDeps set
  path: ["supplyshield", "axios"],           // Built from currentPath
  license: "MIT",
  resolved: "https://registry.npmjs.org/axios/-/axios-1.16.0.tgz",
  integrity: "sha512-..."
}
```

## Direct vs Transitive Detection

```mermaid
graph TD
    A[Package: axios] --> B{In package.json dependencies?}
    B -->|Yes| C[isDirect = true]
    B -->|No| D{In package.json devDependencies?}
    D -->|Yes| C
    D -->|No| E[isDirect = false]
    C --> F[Package is DIRECT]
    E --> G[Package is TRANSITIVE]
```

## Prod vs Dev Detection

```mermaid
graph TD
    A[Package: typescript] --> B{In dev subtree?}
    B -->|Yes| C[isDev = true]
    B -->|No| D{isDirect AND in devDependencies?}
    D -->|Yes| C
    D -->|No| E[isDev = false]
    C --> F[Package is DEV]
    E --> G[Package is PROD]
```

## Edge Case: Package in Both Trees

```
Scenario: "chalk" appears in both prod and dev dependency chains

Tree Walk 1 (Production):
supplyshield → axios → chalk
Result: Package { name: "chalk", isDev: false, path: ["supplyshield", "axios", "chalk"] }

Tree Walk 2 (Development):
supplyshield → typescript → chalk
Result: Package { name: "chalk", isDev: true, path: ["supplyshield", "typescript", "chalk"] }

Final Array: TWO separate Package objects with different paths
```

## Circular Dependency Detection

```mermaid
graph TD
    A[Visit package A] --> B[Add to visited Set]
    B --> C[Process dependencies]
    C --> D{Dependency B already visited?}
    D -->|Yes| E[Skip - Circular detected]
    D -->|No| F[Visit package B]
    F --> G[Add B to visited Set]
    G --> H{B depends on A?}
    H -->|Yes| I[Skip - Circular detected]
    H -->|No| J[Continue processing]
    E --> K[Log warning]
    I --> K
```

## Error Handling Flow

```mermaid
graph TD
    A[Read file] --> B{File exists?}
    B -->|No| C[Throw: File not found]
    B -->|Yes| D{Valid JSON?}
    D -->|No| E[Throw: Invalid JSON]
    D -->|Yes| F{Lockfile version >= 2?}
    F -->|No| G[Throw: Unsupported version]
    F -->|Yes| H{Has packages field?}
    H -->|No| I[Throw: Invalid structure]
    H -->|Yes| J[Process successfully]
```

## Output Format Example

```typescript
[
  {
    name: "supplyshield",
    version: "0.1.0",
    isDev: false,
    isDirect: true,
    path: ["supplyshield"],
    license: "MIT",
    resolved: undefined,
    integrity: undefined
  },
  {
    name: "axios",
    version: "1.16.0",
    isDev: false,
    isDirect: true,
    path: ["supplyshield", "axios"],
    license: "MIT",
    resolved: "https://registry.npmjs.org/axios/-/axios-1.16.0.tgz",
    integrity: "sha512-6hp5CwvTPlN2A31g5dxnwAX0orzM7pmCRDLnZSX772mv8WDqICwFjowHuPs04Mc8deIld1+ejhtaMn5vp6b+1w=="
  },
  {
    name: "follow-redirects",
    version: "1.16.0",
    isDev: false,
    isDirect: false,
    path: ["supplyshield", "axios", "follow-redirects"],
    license: "MIT",
    resolved: "https://registry.npmjs.org/follow-redirects/-/follow-redirects-1.16.0.tgz",
    integrity: "sha512-..."
  },
  {
    name: "typescript",
    version: "5.4.5",
    isDev: true,
    isDirect: true,
    path: ["supplyshield", "typescript"],
    license: "Apache-2.0",
    resolved: "https://registry.npmjs.org/typescript/-/typescript-5.4.5.tgz",
    integrity: "sha512-..."
  }
]
```

## Performance Considerations

- **Memory**: Flat array is memory-efficient vs nested tree
- **Lookup**: Use Set for O(1) direct dependency checks
- **Deduplication**: Track visited packages to avoid processing duplicates
- **Lazy Loading**: Only parse files when needed
- **Streaming**: For very large lockfiles, consider streaming JSON parser

## Integration Points

```mermaid
graph LR
    A[Parsers Module] --> B[SBOM Generator]
    A --> C[Vulnerability Scanner]
    A --> D[Reachability Analyzer]
    A --> E[Risk Calculator]
    
    B --> F[Uses: name, version, license]
    C --> G[Uses: name, version, isDirect]
    D --> H[Uses: name, path, isDev]
    E --> I[Uses: all fields]