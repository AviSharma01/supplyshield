# HTML Report Module Implementation Plan

## Overview
Enhance the SupplyShield HTML report module to generate professional, single-file HTML reports with a modern dark theme inspired by GitHub Security Advisories and Stripe Radar.

## Current State Analysis

### Existing Implementation
- Basic HTML structure in [`src/report/index.ts`](../../src/report/index.ts)
- Simple light-themed CSS (Bootstrap-like)
- Basic summary cards and findings list
- Placeholder `writeHTMLReport()` function (not implemented)
- No interactivity or collapsible sections
- No verdict banner
- No grouped findings by reachability status

### Gaps Identified
1. ❌ Generic Bootstrap aesthetic (needs dark theme overhaul)
2. ❌ No verdict banner with conditional status
3. ❌ Missing collapsible sections for findings groups
4. ❌ No individual finding card expand/collapse
5. ❌ File writing not implemented
6. ❌ Not integrated into CLI scan command
7. ❌ No clickable GHSA/CVE links
8. ❌ Missing "Powered by IBM Bob" attribution

## Design Specifications

### Visual Design
- **Color Palette**:
  - Background: `#0d1117` (dark navy)
  - Primary text: `#c9d1d9` (light gray)
  - Secondary text: `#8b949e` (medium gray)
  - Critical: `#f85149` (red)
  - High: `#d29922` (orange)
  - Medium: `#d4a72c` (yellow)
  - Low/Unreachable: `#8b949e` (gray)
  - Success: `#3fb950` (green)
  - Card background: `#161b22` (slightly lighter than bg)
  - Border: `#30363d` (subtle gray)

- **Typography**:
  - Font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
  - No web fonts (for portability)
  - Generous whitespace and padding

- **Layout**:
  - Max width: 1200px
  - Centered container
  - Responsive grid for summary cards
  - Clear visual hierarchy

### Report Structure

```
┌─────────────────────────────────────────────────────────┐
│ 1. HEADER                                               │
│    - SupplyShield logo/name                            │
│    - Project name + version                            │
│    - Scan timestamp                                    │
│    - "Powered by IBM Bob"                              │
├─────────────────────────────────────────────────────────┤
│ 2. VERDICT BANNER                                       │
│    - Red: "X reachable vulnerabilities require attention"│
│    - Green: "No reachable vulnerabilities — safe to ship"│
├─────────────────────────────────────────────────────────┤
│ 3. SUMMARY STATISTICS GRID (6 cards)                   │
│    ┌──────┐ ┌──────┐ ┌──────┐                         │
│    │Total │ │Total │ │Reach │                         │
│    │Pkgs  │ │Vulns │ │able  │                         │
│    └──────┘ └──────┘ └──────┘                         │
│    ┌──────┐ ┌──────┐ ┌──────┐                         │
│    │Unrch │ │Dev   │ │Prior │                         │
│    │able  │ │Only  │ │ity   │                         │
│    └──────┘ └──────┘ └──────┘                         │
├─────────────────────────────────────────────────────────┤
│ 4. FINDINGS SECTIONS                                    │
│                                                         │
│    ▼ REACHABLE VULNERABILITIES (expanded by default)   │
│    ┌─────────────────────────────────────────────────┐ │
│    │ 🔴 CRITICAL │ GHSA-xxxx │ package@version       │ │
│    │ Summary text...                                 │ │
│    │ ▶ Show details (collapsible)                    │ │
│    │   - Full advisory                               │ │
│    │   - File paths where imported                   │ │
│    │   - Recommendation                              │ │
│    └─────────────────────────────────────────────────┘ │
│                                                         │
│    ▶ UNREACHABLE IN PRODUCTION (collapsed)             │
│    ▶ DEV-ONLY DEPENDENCIES (collapsed)                 │
├─────────────────────────────────────────────────────────┤
│ 5. FOOTER                                               │
│    - Disclaimer text                                   │
│    - Generation timestamp                              │
└─────────────────────────────────────────────────────────┘
```

## Implementation Tasks

### Task 1: CSS Redesign
**File**: [`src/report/index.ts`](../../src/report/index.ts) - `getInlineCSS()`

**Changes**:
- Replace entire CSS with dark theme
- Add styles for verdict banner (red/green variants)
- Create 6-card grid layout for summary
- Style collapsible section headers
- Add hover states and transitions
- Style individual finding cards with expand/collapse
- Add severity badge styles
- Ensure responsive design

**Key CSS Classes**:
```css
.verdict-banner { /* Red or green banner */ }
.verdict-banner.safe { /* Green variant */ }
.verdict-banner.warning { /* Red variant */ }
.summary-grid { /* 3x2 grid */ }
.summary-card { /* Individual stat card */ }
.findings-section { /* Collapsible section */ }
.findings-section.collapsed { /* Collapsed state */ }
.finding-card { /* Individual finding */ }
.finding-card.expanded { /* Expanded state */ }
.severity-badge { /* CRITICAL/HIGH/MEDIUM/LOW */ }
.advisory-link { /* Clickable GHSA/CVE */ }
```

### Task 2: Verdict Banner Implementation
**File**: [`src/report/index.ts`](../../src/report/index.ts) - New function `generateVerdictBanner()`

**Logic**:
```typescript
function generateVerdictBanner(summary: ReportSummary): string {
  const reachableCount = summary.reachableVulnerabilities;
  const isSafe = reachableCount === 0;
  
  if (isSafe) {
    return `
      <div class="verdict-banner safe">
        <div class="verdict-icon">✓</div>
        <div class="verdict-text">
          <h2>No reachable vulnerabilities found — safe to ship</h2>
          <p>All detected vulnerabilities are unreachable or in dev dependencies</p>
        </div>
      </div>
    `;
  } else {
    return `
      <div class="verdict-banner warning">
        <div class="verdict-icon">⚠</div>
        <div class="verdict-text">
          <h2>${reachableCount} reachable ${reachableCount === 1 ? 'vulnerability' : 'vulnerabilities'} require attention</h2>
          <p>These vulnerabilities are imported in your production code</p>
        </div>
      </div>
    `;
  }
}
```

### Task 3: Enhanced Summary Grid
**File**: [`src/report/index.ts`](../../src/report/index.ts) - Update `generateSummaryHTML()`

**6 Cards**:
1. Total Packages
2. Total Vulnerabilities
3. Reachable Findings
4. Unreachable Findings
5. Dev-Only Findings
6. Priority Breakdown (Critical/High/Medium/Low counts)

**Implementation**:
```typescript
function generateSummaryHTML(summary: ReportSummary): string {
  return `
    <div class="summary-grid">
      <div class="summary-card">
        <div class="card-value">${summary.totalPackages}</div>
        <div class="card-label">Total Packages</div>
      </div>
      <div class="summary-card">
        <div class="card-value">${summary.totalVulnerabilities}</div>
        <div class="card-label">Total Vulnerabilities</div>
      </div>
      <div class="summary-card ${summary.reachableVulnerabilities > 0 ? 'warning' : ''}">
        <div class="card-value">${summary.reachableVulnerabilities}</div>
        <div class="card-label">Reachable</div>
      </div>
      <div class="summary-card">
        <div class="card-value">${summary.unreachableVulnerabilities}</div>
        <div class="card-label">Unreachable</div>
      </div>
      <div class="summary-card">
        <div class="card-value">${/* dev-only count */}</div>
        <div class="card-label">Dev-Only</div>
      </div>
      <div class="summary-card priority">
        <div class="priority-breakdown">
          <span class="critical">${summary.criticalFindings}</span>
          <span class="high">${summary.highFindings}</span>
          <span class="medium">${summary.mediumFindings}</span>
          <span class="low">${summary.lowFindings}</span>
        </div>
        <div class="card-label">Priority Breakdown</div>
      </div>
    </div>
  `;
}
```

### Task 4: Grouped Findings Sections
**File**: [`src/report/index.ts`](../../src/report/index.ts) - Rewrite `generateFindingsHTML()`

**Groups**:
1. **Reachable** (expanded by default) - Priority: CRITICAL_REACHABLE, HIGH_REACHABLE, MEDIUM_REACHABLE, LOW_REACHABLE
2. **Unreachable in Production** (collapsed) - Priority: *_UNREACHABLE
3. **Dev-Only** (collapsed) - Priority: DEV_ONLY

**Implementation**:
```typescript
function generateFindingsHTML(findings: Finding[]): string {
  // Group findings
  const reachable = findings.filter(f => 
    f.priorityLevel.includes('REACHABLE') && !f.priorityLevel.includes('UNREACHABLE')
  );
  const unreachable = findings.filter(f => 
    f.priorityLevel.includes('UNREACHABLE')
  );
  const devOnly = findings.filter(f => 
    f.priorityLevel === 'DEV_ONLY'
  );
  
  return `
    ${generateFindingsSection('Reachable Vulnerabilities', reachable, 'reachable', false)}
    ${generateFindingsSection('Unreachable in Production', unreachable, 'unreachable', true)}
    ${generateFindingsSection('Dev-Only Dependencies', devOnly, 'dev-only', true)}
  `;
}

function generateFindingsSection(
  title: string,
  findings: Finding[],
  id: string,
  collapsed: boolean
): string {
  if (findings.length === 0) return '';
  
  return `
    <div class="findings-section ${collapsed ? 'collapsed' : ''}" id="${id}">
      <h3 class="section-header" onclick="toggleSection('${id}')">
        <span class="toggle-icon">${collapsed ? '▶' : '▼'}</span>
        ${title} (${findings.length})
      </h3>
      <div class="section-content">
        ${findings.map(f => generateFindingCard(f)).join('')}
      </div>
    </div>
  `;
}
```

### Task 5: Individual Finding Cards
**File**: [`src/report/index.ts`](../../src/report/index.ts) - New function `generateFindingCard()`

**Features**:
- Severity badge with color
- Package name and version
- GHSA/CVE ID as clickable link
- Summary (always visible)
- Collapsible details section containing:
  - Full advisory text
  - File paths where imported
  - Recommendation
  - References

**Implementation**:
```typescript
function generateFindingCard(finding: Finding): string {
  const severity = finding.priorityLevel.split('_')[0]!.toLowerCase();
  const cardId = `finding-${finding.vulnerability.id}`;
  
  // Determine advisory URL
  const advisoryUrl = finding.vulnerability.id.startsWith('GHSA')
    ? `https://github.com/advisories/${finding.vulnerability.id}`
    : `https://osv.dev/vulnerability/${finding.vulnerability.id}`;
  
  return `
    <div class="finding-card ${severity}" id="${cardId}">
      <div class="finding-header">
        <span class="severity-badge ${severity}">${severity.toUpperCase()}</span>
        <a href="${advisoryUrl}" target="_blank" class="advisory-link">
          ${escapeHtml(finding.vulnerability.id)}
        </a>
        <span class="package-info">
          in ${escapeHtml(finding.package.name)}@${escapeHtml(finding.package.version)}
        </span>
      </div>
      
      <div class="finding-summary">
        ${escapeHtml(finding.vulnerability.summary)}
      </div>
      
      <button class="expand-btn" onclick="toggleFinding('${cardId}')">
        <span class="expand-icon">▶</span> Show details
      </button>
      
      <div class="finding-details" style="display: none;">
        <div class="detail-section">
          <h4>Full Advisory</h4>
          <p>${escapeHtml(finding.vulnerability.details)}</p>
        </div>
        
        ${finding.reachability.isReachable && finding.reachability.importedIn.length > 0 ? `
          <div class="detail-section">
            <h4>Imported In</h4>
            <ul class="file-list">
              ${finding.reachability.importedIn.map(file => 
                `<li><code>${escapeHtml(file)}</code></li>`
              ).join('')}
            </ul>
          </div>
        ` : ''}
        
        <div class="detail-section">
          <h4>Recommendation</h4>
          <p>${escapeHtml(finding.recommendation)}</p>
        </div>
        
        ${finding.vulnerability.references.length > 0 ? `
          <div class="detail-section">
            <h4>References</h4>
            <ul class="reference-list">
              ${finding.vulnerability.references.slice(0, 3).map(ref => 
                `<li><a href="${escapeHtml(ref)}" target="_blank">${escapeHtml(ref)}</a></li>`
              ).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}
```

### Task 6: Interactive JavaScript
**File**: [`src/report/index.ts`](../../src/report/index.ts) - New function `getInlineJavaScript()`

**Functions**:
1. `toggleSection(id)` - Expand/collapse findings sections
2. `toggleFinding(id)` - Expand/collapse individual finding details

**Implementation**:
```typescript
function getInlineJavaScript(): string {
  return `
    function toggleSection(sectionId) {
      const section = document.getElementById(sectionId);
      const isCollapsed = section.classList.contains('collapsed');
      
      if (isCollapsed) {
        section.classList.remove('collapsed');
        section.querySelector('.toggle-icon').textContent = '▼';
      } else {
        section.classList.add('collapsed');
        section.querySelector('.toggle-icon').textContent = '▶';
      }
    }
    
    function toggleFinding(findingId) {
      const card = document.getElementById(findingId);
      const details = card.querySelector('.finding-details');
      const btn = card.querySelector('.expand-btn');
      const icon = btn.querySelector('.expand-icon');
      
      if (details.style.display === 'none') {
        details.style.display = 'block';
        icon.textContent = '▼';
        btn.innerHTML = '<span class="expand-icon">▼</span> Hide details';
        card.classList.add('expanded');
      } else {
        details.style.display = 'none';
        icon.textContent = '▶';
        btn.innerHTML = '<span class="expand-icon">▶</span> Show details';
        card.classList.remove('expanded');
      }
    }
  `;
}
```

### Task 7: File Writing Implementation
**File**: [`src/report/index.ts`](../../src/report/index.ts) - Implement `writeHTMLReport()`

**Implementation**:
```typescript
import { promises as fs } from 'fs';
import { dirname } from 'path';

export async function writeHTMLReport(html: string, outputPath: string): Promise<void> {
  try {
    // Ensure directory exists
    const dir = dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });
    
    // Write file
    await fs.writeFile(outputPath, html, 'utf-8');
    
    console.log(`✓ HTML report written to ${outputPath}`);
  } catch (error) {
    throw new Error(`Failed to write HTML report: ${(error as Error).message}`);
  }
}
```

### Task 8: CLI Integration
**File**: [`src/cli/index.ts`](../../src/cli/index.ts) - Update `scan` command

**Changes**:
1. Import report generation functions
2. Generate HTML report after scan completes
3. Write to default path `./supplyshield-report.html`
4. Display success message with file path

**Implementation** (add after line 153):
```typescript
// Generate and save HTML report
console.log('📄 Generating HTML report...');
const { generateHTMLReport, writeHTMLReport } = await import('../report');

const reportData = {
  metadata: {
    projectName: packageJsonData.name,
    projectVersion: packageJsonData.version,
    scanDate: new Date().toISOString(),
    supplyShieldVersion: version
  },
  summary: {
    totalPackages: packages.length,
    directDependencies: packages.filter(p => p.isDirect).length,
    transitiveDependencies: packages.filter(p => !p.isDirect).length,
    totalVulnerabilities: totalVulns,
    criticalFindings: findings.filter(f => 
      f.priorityLevel === 'CRITICAL_REACHABLE' || f.priorityLevel === 'CRITICAL_UNREACHABLE'
    ).length,
    highFindings: findings.filter(f => 
      f.priorityLevel === 'HIGH_REACHABLE' || f.priorityLevel === 'HIGH_UNREACHABLE'
    ).length,
    mediumFindings: findings.filter(f => 
      f.priorityLevel === 'MEDIUM_REACHABLE' || f.priorityLevel === 'MEDIUM_UNREACHABLE'
    ).length,
    lowFindings: findings.filter(f => 
      f.priorityLevel === 'LOW_REACHABLE' || f.priorityLevel === 'LOW_UNREACHABLE' || f.priorityLevel === 'DEV_ONLY'
    ).length,
    reachableVulnerabilities: findings.filter(f => f.reachability.isReachable).length,
    unreachableVulnerabilities: findings.filter(f => !f.reachability.isReachable).length
  },
  findings,
  generatedAt: new Date().toISOString()
};

const html = generateHTMLReport(reportData);
await writeHTMLReport(html, options.output);

console.log(chalk.green(`\n✓ HTML report saved to ${options.output}\n`));
```

### Task 9: Header Enhancement
**File**: [`src/report/index.ts`](../../src/report/index.ts) - Update header in `generateHTMLReport()`

**Add**:
- "Powered by IBM Bob" attribution
- Better visual hierarchy
- Scan timestamp formatting

**Implementation**:
```typescript
<header class="report-header">
  <div class="header-main">
    <h1>🛡️ SupplyShield</h1>
    <div class="header-subtitle">Security Report</div>
  </div>
  <div class="header-meta">
    <div class="meta-item">
      <span class="meta-label">Project:</span>
      <span class="meta-value">${escapeHtml(report.metadata.projectName)} v${escapeHtml(report.metadata.projectVersion)}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Scan Date:</span>
      <span class="meta-value">${new Date(report.metadata.scanDate).toLocaleString()}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Powered by:</span>
      <span class="meta-value">IBM Bob</span>
    </div>
  </div>
</header>
```

### Task 10: Footer Enhancement
**File**: [`src/report/index.ts`](../../src/report/index.ts) - Update footer

**Implementation**:
```typescript
<footer class="report-footer">
  <div class="footer-disclaimer">
    <strong>⚠️ Disclaimer:</strong> This report is generated by SupplyShield for engineering triage purposes. 
    It is not legal or security advice. Please review all findings with your security team before making 
    remediation decisions.
  </div>
  <div class="footer-meta">
    Generated by SupplyShield v${escapeHtml(report.metadata.supplyShieldVersion)} 
    on ${new Date(report.generatedAt).toLocaleString()}
  </div>
</footer>
```

## Testing Strategy

### Test Data
Create mock report data simulating express package scan:
```typescript
const mockReport: Report = {
  metadata: {
    projectName: 'express-demo',
    projectVersion: '1.0.0',
    scanDate: new Date().toISOString(),
    supplyShieldVersion: '0.1.0'
  },
  summary: {
    totalPackages: 57,
    directDependencies: 1,
    transitiveDependencies: 56,
    totalVulnerabilities: 12,
    criticalFindings: 2,
    highFindings: 3,
    mediumFindings: 4,
    lowFindings: 3,
    reachableVulnerabilities: 5,
    unreachableVulnerabilities: 7
  },
  findings: [
    // Mix of CRITICAL_REACHABLE, HIGH_REACHABLE, MEDIUM_UNREACHABLE, DEV_ONLY
  ],
  generatedAt: new Date().toISOString()
};
```

### Verification Checklist
- [ ] Single HTML file (no external dependencies)
- [ ] Dark theme matches specification
- [ ] Verdict banner shows correct status
- [ ] All 6 summary cards display correctly
- [ ] Findings grouped correctly (Reachable/Unreachable/Dev-only)
- [ ] Sections collapse/expand smoothly
- [ ] Individual findings expand/collapse
- [ ] GHSA/CVE links open in new tab
- [ ] File paths display correctly
- [ ] Responsive on mobile/tablet
- [ ] Professional appearance (CTO-ready)
- [ ] Opens in any browser without errors

## File Changes Summary

### Modified Files
1. **[`src/report/index.ts`](../../src/report/index.ts)**
   - Complete CSS redesign (dark theme)
   - New `generateVerdictBanner()` function
   - Enhanced `generateSummaryHTML()` with 6 cards
   - Rewritten `generateFindingsHTML()` with grouping
   - New `generateFindingCard()` function
   - New `getInlineJavaScript()` function
   - Implemented `writeHTMLReport()` with fs.promises
   - Updated header and footer

2. **[`src/cli/index.ts`](../../src/cli/index.ts)**
   - Add report generation after scan completes
   - Display report file path in success message

### New Files
- None (all changes in existing files)

## Success Criteria

✅ **Visual Design**
- Dark navy background (#0d1117)
- Professional, modern aesthetic
- NOT generic Bootstrap
- Matches GitHub Security/Stripe Radar quality

✅ **Functionality**
- Single self-contained HTML file
- Verdict banner with conditional status
- 6-card summary grid
- Grouped findings (Reachable/Unreachable/Dev-only)
- Collapsible sections
- Expandable finding cards
- Clickable GHSA/CVE links
- Opens in any browser

✅ **Integration**
- Automatically generated during scan
- Default output: `./supplyshield-report.html`
- Success message in CLI

✅ **Quality**
- Professional enough to send to CTO
- Clear visual hierarchy
- Generous whitespace
- Responsive design
- No external dependencies

## Next Steps

After plan approval:
1. Switch to Code mode
2. Implement CSS redesign
3. Implement verdict banner
4. Implement enhanced summary grid
5. Implement grouped findings sections
6. Add interactive JavaScript
7. Implement file writing
8. Integrate with CLI
9. Test with mock data
10. Verify single-file portability