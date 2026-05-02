# Parsers Module - Implementation Plan Summary

## Goal
Parse npm project dependency files (`package.json` and `package-lock.json`) into a structured, flat dependency array for SBOM generation, vulnerability scanning, and reachability analysis.

## Key Decisions

### 1. Output Format: FLAT Array ✅
- Returns `Package[]` - a flat array, NOT a nested tree
- Each Package contains its full dependency path from root
- Easier for downstream modules to consume and process

### 2. Package Interface Extensions ✅
Adding two new fields to existing Package interface:
- `resolved?: string` - npm registry URL
- `integrity?: string` - SHA-512 hash for verification

### 3. Lockfile Support ✅
- Support lockfile versions 2 and 3 only
- Skip version 1 (too old, npm < 7)
- Throw clear error for unsupported versions

### 4. Dependency Classification ✅
Each package tagged with:
- `isDirect`: true if listed in package.json dependencies/devDependencies
- `isDev`: true if in dev dependency subtree OR direct dev dependency
- `path`: full chain from root (e.g., `["supplyshield", "axios", "follow-redirects"]`)

## Implementation Approach

### Phase 1: Type Definitions
1. Update Package interface with `resolved` and `integrity`
2. Create internal types for package-lock.json structure

### Phase 2: Core Parsing Functions
3. `parsePackageJson()` - Extract project metadata and direct deps
4. `parsePackageLock()` - Parse lockfile and build flat array

### Phase 3: Tree Walking Logic
5. Implement dependency tree walker with path tracking
6. Add direct/transitive detection logic
7. Add prod/dev classification logic

### Phase 4: Edge Cases & Error Handling
8. Handle missing licenses, circular deps, optional deps
9. Handle packages appearing in both prod and dev trees
10. Comprehensive error handling and validation

### Phase 5: Integration & Testing
11. Implement `buildDependencyTree()` orchestrator
12. Test with real-world project (path to be provided)

## Edge Cases Handled

1. **Missing License**: Default to `'UNKNOWN'`
2. **Packages in Both Trees**: Create separate entries with different paths
3. **Circular Dependencies**: Track visited packages, skip duplicates
4. **Optional Dependencies**: Include in tree (may not be installed)
5. **Peer Dependencies**: Skip (not part of install tree)

## Testing Strategy

- Use real project with package-lock.json (path to be provided)
- Validate output structure and counts
- Print sample packages to console for verification
- Verify dependency paths are accurate

## Success Criteria

- ✅ Parses package.json correctly
- ✅ Parses package-lock.json v2 and v3
- ✅ Returns flat array of Package objects
- ✅ Correctly identifies direct vs transitive
- ✅ Correctly identifies prod vs dev
- ✅ Builds accurate dependency paths
- ✅ Handles all edge cases gracefully
- ✅ Comprehensive error handling
- ✅ Successfully parses real-world project

## Files to Modify

1. `src/types/index.ts` - Add `resolved` and `integrity` to Package interface
2. `src/parsers/index.ts` - Implement all parsing logic

## Next Steps

**Awaiting approval to proceed with implementation.**

Once approved, I will:
1. Switch to Code mode
2. Implement the parsers module following this plan
3. Request the test project path from you
4. Test and validate the implementation
5. Iterate based on test results

## Questions?

Please review the following documents:
- [`implementation-plan.md`](./implementation-plan.md) - Detailed implementation guide
- [`architecture-diagram.md`](./architecture-diagram.md) - Visual architecture and data flow

If you have any questions or want changes to the approach, please let me know before I start coding.