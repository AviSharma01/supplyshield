/**
 * Report Module
 *
 * Generates professional HTML reports with inline CSS for portability
 * Dark theme inspired by GitHub Security Advisories and Stripe Radar
 */

import { promises as fs } from 'fs';
import { dirname } from 'path';
import { Report, ReportSummary, Finding } from '../types';

/**
 * Escape HTML special characters to prevent XSS
 *
 * @param text - Text to escape
 * @returns Escaped text safe for HTML
 */
function escapeHtml(text: string): string {
  const ampRegex = /&/g;
  const ltRegex = /</g;
  const gtRegex = />/g;
  const quotRegex = /"/g;
  const aposRegex = /'/g;
  
  return text
    .replace(ampRegex, '&' + 'amp;')
    .replace(ltRegex, '&' + 'lt;')
    .replace(gtRegex, '&' + 'gt;')
    .replace(quotRegex, '&' + 'quot;')
    .replace(aposRegex, '&' + '#39;');
}

/**
 * Generate HTML report from findings
 * 
 * @param report - Complete report data
 * @returns HTML string with inline CSS
 */
export function generateHTMLReport(report: Report): string {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SupplyShield Security Report - ${escapeHtml(report.metadata.projectName)}</title>
  <style>
    ${getInlineCSS()}
  </style>
</head>
<body>
  <div class="container">
    ${generateHeader(report)}
    ${generateVerdictBanner(report.summary)}
    ${generateSummarySection(report.summary)}
    ${generateFindingsSection(report.findings)}
    ${generateFooter(report)}
  </div>
  <script>
    ${getInlineJavaScript()}
  </script>
</body>
</html>`;
  
  return html;
}

/**
 * Generate header section
 */
function generateHeader(report: Report): string {
  return `
    <header class="report-header">
      <div class="header-main">
        <h1><span class="shield-icon">🛡️</span> SupplyShield</h1>
        <div class="header-subtitle">Security Report</div>
      </div>
      <div class="header-meta">
        <div class="meta-item">
          <span class="meta-label">Project:</span>
          <span class="meta-value">${escapeHtml(report.metadata.projectName)} <span class="version">v${escapeHtml(report.metadata.projectVersion)}</span></span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Scan Date:</span>
          <span class="meta-value">${new Date(report.metadata.scanDate).toLocaleString('en-US', { 
            dateStyle: 'medium', 
            timeStyle: 'short' 
          })}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Powered by:</span>
          <span class="meta-value">IBM Bob</span>
        </div>
      </div>
    </header>
  `;
}

/**
 * Generate verdict banner
 */
function generateVerdictBanner(summary: ReportSummary): string {
  const reachableCount = summary.reachableVulnerabilities;
  const isSafe = reachableCount === 0;
  
  if (isSafe) {
    return `
      <div class="verdict-banner safe">
        <div class="verdict-icon">✓</div>
        <div class="verdict-content">
          <h2>No reachable vulnerabilities found — safe to ship</h2>
          <p>All detected vulnerabilities are unreachable or in dev dependencies</p>
        </div>
      </div>
    `;
  } else {
    return `
      <div class="verdict-banner warning">
        <div class="verdict-icon">⚠</div>
        <div class="verdict-content">
          <h2>${reachableCount} reachable ${reachableCount === 1 ? 'vulnerability' : 'vulnerabilities'} require${reachableCount === 1 ? 's' : ''} attention</h2>
          <p>These vulnerabilities are imported in your production code and should be addressed</p>
        </div>
      </div>
    `;
  }
}

/**
 * Generate summary statistics section
 */
function generateSummarySection(summary: ReportSummary): string {
  const devOnlyCount = summary.totalVulnerabilities - summary.reachableVulnerabilities - summary.unreachableVulnerabilities;
  
  return `
    <section class="summary-section">
      <h2 class="section-title">Summary Statistics</h2>
      <div class="summary-grid">
        <div class="summary-card">
          <div class="card-value">${summary.totalPackages}</div>
          <div class="card-label">Total Packages</div>
          <div class="card-sublabel">${summary.directDependencies} direct, ${summary.transitiveDependencies} transitive</div>
        </div>
        
        <div class="summary-card">
          <div class="card-value">${summary.totalVulnerabilities}</div>
          <div class="card-label">Total Vulnerabilities</div>
          <div class="card-sublabel">Across all dependencies</div>
        </div>
        
        <div class="summary-card ${summary.reachableVulnerabilities > 0 ? 'warning' : 'success'}">
          <div class="card-value">${summary.reachableVulnerabilities}</div>
          <div class="card-label">Reachable</div>
          <div class="card-sublabel">Imported in production code</div>
        </div>
        
        <div class="summary-card">
          <div class="card-value">${summary.unreachableVulnerabilities}</div>
          <div class="card-label">Unreachable</div>
          <div class="card-sublabel">Not imported in code</div>
        </div>
        
        <div class="summary-card">
          <div class="card-value">${devOnlyCount}</div>
          <div class="card-label">Dev-Only</div>
          <div class="card-sublabel">Development dependencies</div>
        </div>
        
        <div class="summary-card priority">
          <div class="priority-breakdown">
            <div class="priority-item critical">
              <span class="priority-count">${summary.criticalFindings}</span>
              <span class="priority-label">Critical</span>
            </div>
            <div class="priority-item high">
              <span class="priority-count">${summary.highFindings}</span>
              <span class="priority-label">High</span>
            </div>
            <div class="priority-item medium">
              <span class="priority-count">${summary.mediumFindings}</span>
              <span class="priority-label">Medium</span>
            </div>
            <div class="priority-item low">
              <span class="priority-count">${summary.lowFindings}</span>
              <span class="priority-label">Low</span>
            </div>
          </div>
          <div class="card-label">Priority Breakdown</div>
        </div>
      </div>
    </section>
  `;
}

/**
 * Generate findings section with grouped findings
 */
function generateFindingsSection(findings: Finding[]): string {
  if (findings.length === 0) {
    return `
      <section class="findings-section">
        <h2 class="section-title">Findings</h2>
        <div class="no-findings">
          <div class="no-findings-icon">🎉</div>
          <h3>No vulnerabilities found!</h3>
          <p>Your project dependencies are clean and secure.</p>
        </div>
      </section>
    `;
  }
  
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
    <section class="findings-section">
      <h2 class="section-title">Findings (${findings.length})</h2>
      ${generateFindingsGroup('Reachable Vulnerabilities', reachable, 'reachable', false)}
      ${generateFindingsGroup('Unreachable in Production', unreachable, 'unreachable', true)}
      ${generateFindingsGroup('Dev-Only Dependencies', devOnly, 'dev-only', true)}
    </section>
  `;
}

/**
 * Generate a group of findings
 */
function generateFindingsGroup(
  title: string,
  findings: Finding[],
  id: string,
  collapsed: boolean
): string {
  if (findings.length === 0) return '';
  
  return `
    <div class="findings-group ${collapsed ? 'collapsed' : ''}" id="${id}">
      <h3 class="group-header" onclick="toggleGroup('${id}')">
        <span class="toggle-icon">${collapsed ? '▶' : '▼'}</span>
        <span class="group-title">${title}</span>
        <span class="group-count">${findings.length}</span>
      </h3>
      <div class="group-content">
        ${findings.map(f => generateFindingCard(f)).join('')}
      </div>
    </div>
  `;
}

/**
 * Generate individual finding card
 */
function generateFindingCard(finding: Finding): string {
  const severity = finding.priorityLevel.split('_')[0]!.toLowerCase();
  const cardId = `finding-${finding.vulnerability.id.replace(/[^a-zA-Z0-9]/g, '-')}`;
  
  // Determine advisory URL
  const advisoryUrl = finding.vulnerability.id.startsWith('GHSA')
    ? `https://github.com/advisories/${finding.vulnerability.id}`
    : `https://osv.dev/vulnerability/${finding.vulnerability.id}`;
  
  return `
    <div class="finding-card ${severity}" id="${cardId}">
      <div class="finding-header">
        <span class="severity-badge ${severity}">${severity.toUpperCase()}</span>
        <a href="${advisoryUrl}" target="_blank" rel="noopener noreferrer" class="advisory-link">
          ${escapeHtml(finding.vulnerability.id)}
        </a>
        <span class="package-info">
          in <strong>${escapeHtml(finding.package.name)}</strong>@${escapeHtml(finding.package.version)}
        </span>
      </div>
      
      <div class="finding-summary">
        ${escapeHtml(finding.vulnerability.summary)}
      </div>
      
      <div class="finding-meta">
        <span class="meta-badge">Priority Score: ${finding.priorityScore}/100</span>
        ${finding.reachability.isReachable ? '<span class="meta-badge reachable">Reachable</span>' : '<span class="meta-badge">Unreachable</span>'}
        ${finding.package.isDev ? '<span class="meta-badge">Dev Dependency</span>' : ''}
      </div>
      
      <button class="expand-btn" onclick="toggleFinding('${cardId}')">
        <span class="expand-icon">▶</span> Show details
      </button>
      
      <div class="finding-details">
        <div class="detail-section">
          <h4>Full Advisory</h4>
          <p>${escapeHtml(finding.vulnerability.details)}</p>
        </div>
        
        ${finding.reachability.isReachable && finding.reachability.importedIn.length > 0 ? `
          <div class="detail-section">
            <h4>Imported In (${finding.reachability.importedIn.length} ${finding.reachability.importedIn.length === 1 ? 'file' : 'files'})</h4>
            <ul class="file-list">
              ${finding.reachability.importedIn.slice(0, 10).map(file => 
                `<li><code>${escapeHtml(file)}</code></li>`
              ).join('')}
              ${finding.reachability.importedIn.length > 10 ? `<li class="more-files">... and ${finding.reachability.importedIn.length - 10} more files</li>` : ''}
            </ul>
          </div>
        ` : ''}
        
        <div class="detail-section">
          <h4>Recommendation</h4>
          <p class="recommendation">${escapeHtml(finding.recommendation)}</p>
        </div>
        
        ${finding.vulnerability.fixedVersions && finding.vulnerability.fixedVersions.length > 0 ? `
          <div class="detail-section">
            <h4>Fixed Versions</h4>
            <p>Upgrade to: <code>${finding.vulnerability.fixedVersions.map(v => escapeHtml(v)).join(', ')}</code></p>
          </div>
        ` : ''}
        
        ${finding.vulnerability.references.length > 0 ? `
          <div class="detail-section">
            <h4>References</h4>
            <ul class="reference-list">
              ${finding.vulnerability.references.slice(0, 5).map(ref => 
                `<li><a href="${escapeHtml(ref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ref)}</a></li>`
              ).join('')}
              ${finding.vulnerability.references.length > 5 ? `<li class="more-refs">... and ${finding.vulnerability.references.length - 5} more references</li>` : ''}
            </ul>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Generate footer
 */
function generateFooter(report: Report): string {
  return `
    <footer class="report-footer">
      <div class="footer-disclaimer">
        <strong>⚠️ Disclaimer:</strong> This report is generated by SupplyShield for engineering triage purposes. 
        It is not legal or security advice. Please review all findings with your security team before making 
        remediation decisions.
      </div>
      <div class="footer-meta">
        Generated by SupplyShield v${escapeHtml(report.metadata.supplyShieldVersion)} 
        on ${new Date(report.generatedAt).toLocaleString('en-US', { 
          dateStyle: 'medium', 
          timeStyle: 'short' 
        })}
      </div>
    </footer>
  `;
}

/**
 * Get inline CSS for the report
 */
function getInlineCSS(): string {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.6;
      color: #c9d1d9;
      background: #0d1117;
      padding: 20px;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: #0d1117;
    }
    
    /* Header */
    .report-header {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 32px;
      margin-bottom: 24px;
    }
    
    .header-main {
      margin-bottom: 24px;
    }
    
    .header-main h1 {
      font-size: 2.5em;
      font-weight: 600;
      color: #c9d1d9;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .shield-icon {
      font-size: 1.2em;
    }
    
    .header-subtitle {
      font-size: 1.2em;
      color: #8b949e;
      font-weight: 300;
    }
    
    .header-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      padding-top: 24px;
      border-top: 1px solid #30363d;
    }
    
    .meta-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    .meta-label {
      font-size: 0.85em;
      color: #8b949e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .meta-value {
      font-size: 1em;
      color: #c9d1d9;
      font-weight: 500;
    }
    
    .version {
      color: #8b949e;
      font-weight: 400;
    }
    
    /* Verdict Banner */
    .verdict-banner {
      display: flex;
      align-items: center;
      gap: 24px;
      padding: 32px;
      border-radius: 8px;
      margin-bottom: 24px;
      border: 2px solid;
    }
    
    .verdict-banner.safe {
      background: rgba(63, 185, 80, 0.1);
      border-color: #3fb950;
    }
    
    .verdict-banner.warning {
      background: rgba(248, 81, 73, 0.1);
      border-color: #f85149;
    }
    
    .verdict-icon {
      font-size: 3em;
      line-height: 1;
    }
    
    .verdict-banner.safe .verdict-icon {
      color: #3fb950;
    }
    
    .verdict-banner.warning .verdict-icon {
      color: #f85149;
    }
    
    .verdict-content h2 {
      font-size: 1.5em;
      font-weight: 600;
      margin-bottom: 8px;
      color: #c9d1d9;
    }
    
    .verdict-content p {
      font-size: 1em;
      color: #8b949e;
    }
    
    /* Section Titles */
    .section-title {
      font-size: 1.8em;
      font-weight: 600;
      color: #c9d1d9;
      margin: 40px 0 24px 0;
      padding-bottom: 12px;
      border-bottom: 2px solid #30363d;
    }
    
    /* Summary Grid */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    
    .summary-card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 24px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .summary-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    
    .summary-card.warning {
      border-color: #f85149;
      background: rgba(248, 81, 73, 0.05);
    }
    
    .summary-card.success {
      border-color: #3fb950;
      background: rgba(63, 185, 80, 0.05);
    }
    
    .card-value {
      font-size: 2.5em;
      font-weight: 700;
      color: #c9d1d9;
      margin-bottom: 8px;
      line-height: 1;
    }
    
    .summary-card.warning .card-value {
      color: #f85149;
    }
    
    .summary-card.success .card-value {
      color: #3fb950;
    }
    
    .card-label {
      font-size: 1em;
      font-weight: 600;
      color: #c9d1d9;
      margin-bottom: 4px;
    }
    
    .card-sublabel {
      font-size: 0.85em;
      color: #8b949e;
    }
    
    /* Priority Breakdown Card */
    .summary-card.priority {
      grid-column: span 2;
    }
    
    .priority-breakdown {
      display: flex;
      gap: 24px;
      margin-bottom: 12px;
    }
    
    .priority-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    
    .priority-count {
      font-size: 2em;
      font-weight: 700;
      line-height: 1;
    }
    
    .priority-item.critical .priority-count {
      color: #f85149;
    }
    
    .priority-item.high .priority-count {
      color: #d29922;
    }
    
    .priority-item.medium .priority-count {
      color: #d4a72c;
    }
    
    .priority-item.low .priority-count {
      color: #8b949e;
    }
    
    .priority-label {
      font-size: 0.85em;
      color: #8b949e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    /* Findings Groups */
    .findings-group {
      margin-bottom: 24px;
    }
    
    .group-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.2s;
      font-size: 1.3em;
      font-weight: 600;
      color: #c9d1d9;
    }
    
    .group-header:hover {
      background: #1c2128;
    }
    
    .toggle-icon {
      font-size: 0.8em;
      color: #8b949e;
      transition: transform 0.2s;
    }
    
    .group-title {
      flex: 1;
    }
    
    .group-count {
      background: #30363d;
      color: #c9d1d9;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.8em;
      font-weight: 600;
    }
    
    .group-content {
      padding: 16px 0;
    }
    
    .findings-group.collapsed .group-content {
      display: none;
    }
    
    .findings-group.collapsed .toggle-icon {
      transform: rotate(0deg);
    }
    
    /* Finding Cards */
    .finding-card {
      background: #161b22;
      border: 1px solid #30363d;
      border-left: 4px solid;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;
      transition: box-shadow 0.2s;
    }
    
    .finding-card:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }
    
    .finding-card.critical {
      border-left-color: #f85149;
    }
    
    .finding-card.high {
      border-left-color: #d29922;
    }
    
    .finding-card.medium {
      border-left-color: #d4a72c;
    }
    
    .finding-card.low {
      border-left-color: #8b949e;
    }
    
    .finding-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    
    .severity-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 0.75em;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .severity-badge.critical {
      background: #f85149;
      color: #ffffff;
    }
    
    .severity-badge.high {
      background: #d29922;
      color: #ffffff;
    }
    
    .severity-badge.medium {
      background: #d4a72c;
      color: #000000;
    }
    
    .severity-badge.low {
      background: #8b949e;
      color: #ffffff;
    }
    
    .advisory-link {
      color: #58a6ff;
      text-decoration: none;
      font-weight: 600;
      font-family: 'Courier New', monospace;
      font-size: 0.95em;
    }
    
    .advisory-link:hover {
      text-decoration: underline;
    }
    
    .package-info {
      color: #8b949e;
      font-size: 0.95em;
    }
    
    .package-info strong {
      color: #c9d1d9;
    }
    
    .finding-summary {
      color: #c9d1d9;
      margin-bottom: 12px;
      line-height: 1.6;
    }
    
    .finding-meta {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    
    .meta-badge {
      background: #30363d;
      color: #8b949e;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 0.8em;
    }
    
    .meta-badge.reachable {
      background: rgba(248, 81, 73, 0.2);
      color: #f85149;
      font-weight: 600;
    }
    
    .expand-btn {
      background: #21262d;
      border: 1px solid #30363d;
      color: #c9d1d9;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9em;
      font-weight: 500;
      transition: background 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .expand-btn:hover {
      background: #30363d;
    }
    
    .expand-icon {
      font-size: 0.8em;
      transition: transform 0.2s;
    }
    
    .finding-card.expanded .expand-icon {
      transform: rotate(90deg);
    }
    
    .finding-details {
      display: none;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #30363d;
    }
    
    .finding-card.expanded .finding-details {
      display: block;
    }
    
    .detail-section {
      margin-bottom: 20px;
    }
    
    .detail-section:last-child {
      margin-bottom: 0;
    }
    
    .detail-section h4 {
      color: #c9d1d9;
      font-size: 1em;
      font-weight: 600;
      margin-bottom: 8px;
    }
    
    .detail-section p {
      color: #8b949e;
      line-height: 1.6;
    }
    
    .recommendation {
      color: #c9d1d9;
      background: #21262d;
      padding: 12px;
      border-radius: 6px;
      border-left: 3px solid #58a6ff;
    }
    
    .file-list, .reference-list {
      list-style: none;
      padding: 0;
    }
    
    .file-list li, .reference-list li {
      padding: 6px 0;
      color: #8b949e;
    }
    
    .file-list code {
      background: #21262d;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
      color: #c9d1d9;
    }
    
    .reference-list a {
      color: #58a6ff;
      text-decoration: none;
      word-break: break-all;
    }
    
    .reference-list a:hover {
      text-decoration: underline;
    }
    
    .more-files, .more-refs {
      color: #8b949e;
      font-style: italic;
    }
    
    /* No Findings */
    .no-findings {
      text-align: center;
      padding: 60px 20px;
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
    }
    
    .no-findings-icon {
      font-size: 4em;
      margin-bottom: 16px;
    }
    
    .no-findings h3 {
      color: #3fb950;
      font-size: 1.5em;
      margin-bottom: 8px;
    }
    
    .no-findings p {
      color: #8b949e;
    }
    
    /* Footer */
    .report-footer {
      margin-top: 60px;
      padding-top: 24px;
      border-top: 2px solid #30363d;
    }
    
    .footer-disclaimer {
      background: rgba(210, 153, 34, 0.1);
      border: 1px solid #d29922;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
      color: #c9d1d9;
      line-height: 1.6;
    }
    
    .footer-disclaimer strong {
      color: #d29922;
    }
    
    .footer-meta {
      text-align: center;
      color: #8b949e;
      font-size: 0.9em;
    }
    
    /* Responsive */
    @media (max-width: 768px) {
      body {
        padding: 12px;
      }
      
      .report-header {
        padding: 20px;
      }
      
      .header-main h1 {
        font-size: 1.8em;
      }
      
      .verdict-banner {
        flex-direction: column;
        text-align: center;
        padding: 24px;
      }
      
      .summary-grid {
        grid-template-columns: 1fr;
      }
      
      .summary-card.priority {
        grid-column: span 1;
      }
      
      .priority-breakdown {
        flex-wrap: wrap;
        justify-content: center;
      }
      
      .finding-header {
        flex-direction: column;
        align-items: flex-start;
      }
    }
  `.trim();
}

/**
 * Get inline JavaScript for interactivity
 */
function getInlineJavaScript(): string {
  return `
    function toggleGroup(groupId) {
      const group = document.getElementById(groupId);
      const isCollapsed = group.classList.contains('collapsed');
      
      if (isCollapsed) {
        group.classList.remove('collapsed');
      } else {
        group.classList.add('collapsed');
      }
    }
    
    function toggleFinding(findingId) {
      const card = document.getElementById(findingId);
      const isExpanded = card.classList.contains('expanded');
      const btn = card.querySelector('.expand-btn');
      const icon = btn.querySelector('.expand-icon');
      
      if (isExpanded) {
        card.classList.remove('expanded');
        btn.innerHTML = '<span class="expand-icon">▶</span> Show details';
      } else {
        card.classList.add('expanded');
        btn.innerHTML = '<span class="expand-icon">▼</span> Hide details';
      }
    }
  `.trim();
}

/**
 * Write HTML report to file
 *
 * @param html - HTML content
 * @param outputPath - Path to write the report
 */
export async function writeHTMLReport(html: string, outputPath: string): Promise<void> {
  try {
    // Ensure directory exists
    const dir = dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });
    
    // Write file
    await fs.writeFile(outputPath, html, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to write HTML report: ${(error as Error).message}`);
  }
}

/**
 * Generate JSON report
 * 
 * @param report - Complete report data
 * @returns JSON string
 */
export function generateJSONReport(report: Report): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Write JSON report to file
 *
 * @param json - JSON content
 * @param outputPath - Path to write the report
 */
export async function writeJSONReport(json: string, outputPath: string): Promise<void> {
  try {
    // Ensure directory exists
    const dir = dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });
    
    // Write file
    await fs.writeFile(outputPath, json, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to write JSON report: ${(error as Error).message}`);
  }
}

// Made with Bob
