import { useState } from 'react';
import './ResultScreen.css';

function parseCheckString(str) {
  /**
   * Parse a check string like:
   *   "FAR : In Map = 1.20, Allowed ≤ 1.60"
   *   "Front Setback : Allowed ≥ 3.00 m, In Map = 4.00 m"
   * Returns { label, required, provided, compliant }
   */
  const parts = str.split(':');
  const label = parts[0]?.trim() || str;
  const rest = parts.slice(1).join(':').trim();

  let required = '—';
  let provided = '—';

  // Extract "In Map = X" → provided
  const inMapMatch = rest.match(/In Map\s*=\s*([^,]+)/i);
  if (inMapMatch) provided = inMapMatch[1].trim();

  // Extract "Allowed [≤≥] X" → required
  const allowedMatch = rest.match(/Allowed\s*[≤≥<>]=?\s*([^,]+)/i);
  if (allowedMatch) required = allowedMatch[1].trim();

  return { label, required, provided };
}

function buildTableRows(report) {
  /**
   * Merge fetched_details with passed/failed checks into unified rows.
   * Each row: { label, required, provided, compliant, isCalculated }
   */
  const rows = [];

  // Map check strings by label for quick lookup
  const passMap = {};
  const failMap = {};

  (report.passed_checks || []).forEach((s) => {
    const { label, required, provided } = parseCheckString(s);
    passMap[label.toLowerCase()] = { required, provided, compliant: true };
  });

  (report.failed_checks || []).forEach((s) => {
    const { label, required, provided } = parseCheckString(s);
    failMap[label.toLowerCase()] = { required, provided, compliant: false };
  });

  // Build rows from fetched_details
  (report.fetched_details || []).forEach((detail) => {
    const key = detail.label.toLowerCase();
    const checkData = passMap[key] || failMap[key];

    const valueStr = detail.unit
      ? `${detail.value} ${detail.unit}`
      : String(detail.value);

    if (checkData) {
      rows.push({
        label: detail.label,
        required: checkData.required !== '—' ? checkData.required : '—',
        provided: valueStr,
        compliant: checkData.compliant,
        isCalculated: false,
      });
    } else {
      rows.push({
        label: detail.label,
        required: '—',
        provided: valueStr,
        compliant: null, // no check for this metric
        isCalculated: true,
      });
    }
  });

  // Add any checks not already covered by fetched_details
  const coveredLabels = new Set(rows.map((r) => r.label.toLowerCase()));

  [...Object.entries(passMap), ...Object.entries(failMap)].forEach(([key, data]) => {
    if (!coveredLabels.has(key)) {
      rows.push({
        label: key.replace(/\b\w/g, (c) => c.toUpperCase()),
        required: data.required,
        provided: data.provided,
        compliant: data.compliant,
        isCalculated: false,
      });
    }
  });

  return rows;
}

/* ── Sub-components ── */
function ComplianceBadge({ compliant }) {
  if (compliant === null) {
    return (
      <span className="badge badge-calculated" title="Calculated value">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 16h-2v-2h2v2zm-4 0h-2v-2h2v2zm-4 0H7v-2h2v2zm8-4h-2v-2h2v2zm-4 0h-2v-2h2v2zm-4 0H7v-2h2v2zm8-4H7V5h10v6z"/>
        </svg>
        Calculated
      </span>
    );
  }
  if (compliant) {
    return (
      <span className="badge badge-compliant">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor">
          <path d="M9.5 2.5L4.5 8 1.5 5"/>
          <path d="M9.5 2.5L4.5 8 1.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
        Compliant
      </span>
    );
  }
  return (
    <span className="badge badge-non-compliant">
      <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor">
        <path d="M2 2l7 7M9 2L2 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      </svg>
      Non-Compliant
    </span>
  );
}

function SummaryCard({ label, value, icon, color }) {
  return (
    <div className={`summary-card summary-card--${color}`}>
      <div className="summary-icon">{icon}</div>
      <div className="summary-value">{value}</div>
      <div className="summary-label">{label}</div>
    </div>
  );
}

/* ── Main component ── */
function ResultScreen({ data, onBack, onRevalidate }) {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'pass' | 'fail'

  const { report, validation_status, fileName, areaType, location } = data;
  const isPass = validation_status === 'PASS';
  const passCount = (report.passed_checks || []).length;
  const failCount = (report.failed_checks || []).length;
  const totalChecks = passCount + failCount;

  const allRows = buildTableRows(report);

  const filteredRows = allRows.filter((row) => {
    if (activeTab === 'pass') return row.compliant === true;
    if (activeTab === 'fail') return row.compliant === false;
    return true;
  });

  return (
    <div className="result-screen">
      {/* ── Top bar ── */}
      <div className="result-topbar">
        <button className="back-btn" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/>
          </svg>
          New Analysis
        </button>

        <div className={`overall-badge ${isPass ? 'overall-badge--pass' : 'overall-badge--fail'}`}>
          {isPass ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <path d="M16 9A7 7 0 1 1 2 9a7 7 0 0 1 14 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.235.235 0 0 1 .02-.022z"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <path d="M16 9A7 7 0 1 1 2 9a7 7 0 0 1 14 0zM5.354 4.646a.5.5 0 1 0-.708.708L8.293 9l-3.647 3.646a.5.5 0 0 0 .708.708L9 9.707l3.646 3.647a.5.5 0 0 0 .708-.708L9.707 9l3.647-3.646a.5.5 0 0 0-.708-.708L9 8.293 5.354 4.646z"/>
            </svg>
          )}
          {isPass ? 'COMPLIANT' : 'NON-COMPLIANT'}
        </div>
      </div>

      {/* ── File Analysis Summary header ── */}
      <div className="result-header card">
        <div className="result-header-top">
          <div className="result-header-icon">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
              <polyline points="14 2 14 8 20 8" stroke="white" strokeWidth="1.5" fill="none"/>
            </svg>
          </div>
          <div>
            <h1 className="result-main-title">File Analysis Summary</h1>
            <div className="result-meta">
              <div className="meta-item">
                <span className="meta-label">Filename:</span>
                <span className="meta-value">{report.file_name || fileName}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">File Type:</span>
                <span className="meta-value">
                  <span className="file-type-dot" />
                  {fileName?.toLowerCase().endsWith('.dwg') ? 'DWG (AutoCAD Drawing)' : 'DXF (AutoCAD Drawing)'}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Processing:</span>
                <span className="meta-value">Building classified as {areaType} ({location})</span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="summary-cards">
          <SummaryCard
            label="Total Checks"
            value={totalChecks}
            color="neutral"
            icon={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/>
              </svg>
            }
          />
          <SummaryCard
            label="Passed"
            value={passCount}
            color="pass"
            icon={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
            }
          />
          <SummaryCard
            label="Failed"
            value={failCount}
            color="fail"
            icon={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
              </svg>
            }
          />
          <SummaryCard
            label="Compliance Rate"
            value={totalChecks > 0 ? `${Math.round((passCount / totalChecks) * 100)}%` : '—'}
            color={isPass ? 'pass' : 'fail'}
            icon={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
              </svg>
            }
          />
        </div>
      </div>

      {/* ── Extracted Parameters Table ── */}
      <div className="result-table-card card">
        <div className="table-card-header">
          <div className="table-card-title">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <path d="M9 1a.5.5 0 0 1 .5.5v.793l.646-.647a.5.5 0 0 1 .708.708L9.5 3.207V4h.793l.854-.854a.5.5 0 0 1 .707.707L11 4.707V5h.5a.5.5 0 0 1 0 1H11v.293l.854.853a.5.5 0 0 1-.707.708L10.5 7.5H9.5l-.854.854a.5.5 0 0 1-.707-.708L8.5 7H7.5l-.854.854a.5.5 0 0 1-.707-.708L6.5 6.5H6v-.293l-.854-.854a.5.5 0 0 1 .707-.707L6.5 5H7v-.793l-.854-.854a.5.5 0 0 1 .707-.707L7.5 3.207V2.5l-.646-.646a.5.5 0 0 1 .708-.708l.646.647V1.5A.5.5 0 0 1 9 1z"/>
            </svg>
            Extracted Parameters with SIDA Validation
          </div>

          {/* Tab filter */}
          <div className="tab-filter" role="tablist">
            {[
              { key: 'all', label: 'All Parameters' },
              { key: 'pass', label: `Passed (${passCount})` },
              { key: 'fail', label: `Failed (${failCount})` },
            ].map((tab) => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={activeTab === tab.key}
                className={`tab-btn ${activeTab === tab.key ? 'active' : ''} ${tab.key === 'fail' && failCount > 0 ? 'tab-btn--fail' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="table-wrap">
          <table className="params-table" aria-label="SIDA Validation Parameters">
            <thead>
              <tr>
                <th className="col-num">#</th>
                <th className="col-param">Parameters</th>
                <th className="col-required">Required / Permissible</th>
                <th className="col-provided">Provided</th>
                <th className="col-status">Compliance Check</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-row">
                    No parameters to display for this filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`
                      param-row
                      ${row.compliant === true ? 'row--pass' : ''}
                      ${row.compliant === false ? 'row--fail' : ''}
                    `}
                  >
                    <td className="col-num">{idx + 1}</td>
                    <td className="col-param">
                      <div className="param-label">
                        {row.compliant === false && (
                          <span className="param-fail-dot" title="Non-compliant" />
                        )}
                        {row.label}
                      </div>
                    </td>
                    <td className="col-required">
                      <span className={row.required === '—' ? 'value-dash' : 'value-required'}>
                        {row.required}
                      </span>
                    </td>
                    <td className="col-provided">
                      <span className="value-provided">{row.provided}</span>
                    </td>
                    <td className="col-status">
                      <ComplianceBadge compliant={row.compliant} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Failed checks detail (if any) ── */}
      {failCount > 0 && (
        <div className="failures-card card">
          <div className="card-header failures-header">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <path d="M8.982 1.566a1.13 1.13 0 0 1 2.036 0l1.67 2.811 2.811 1.67a1.13 1.13 0 0 1 0 2.036l-2.811 1.67-1.67 2.811a1.13 1.13 0 0 1-2.036 0l-1.67-2.811-2.811-1.67a1.13 1.13 0 0 1 0-2.036l2.811-1.67 1.67-2.811z"/>
            </svg>
            Non-Compliance Details ({failCount})
          </div>
          <ul className="failures-list">
            {(report.failed_checks || []).map((check, i) => (
              <li key={i} className="failure-item">
                <span className="failure-bullet">✕</span>
                <span>{check}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="result-actions">
        <button className="btn btn-outline" onClick={onBack}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
            <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
            <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/>
          </svg>
          Analyse Another File
        </button>

        {onRevalidate && (
          <button className="btn btn-secondary" onClick={onRevalidate}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
              <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
            </svg>
            Re-evaluate Same File
          </button>
        )}

        <button className="btn btn-primary" onClick={() => window.print()}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
            <path d="M2.5 8a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z"/>
            <path d="M5 1a2 2 0 0 0-2 2v2H2a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1v1a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-1h1a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1V3a2 2 0 0 0-2-2H5zM4 3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2H4V3zm1 5a2 2 0 0 0-2 2v1H2a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v-1a2 2 0 0 0-2-2H5zm7 2v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1z"/>
          </svg>
          Print Report
        </button>
      </div>
    </div>
  );
}

export default ResultScreen;
