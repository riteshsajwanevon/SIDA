import { useState, useRef, useCallback, useEffect } from 'react';
import { getUploadStatus, uploadFile, validateJob } from '../api/sidaApi';
import './UploadScreen.css';

const ACCEPTED_EXTENSIONS = ['.dxf', '.dwg'];
const POLL_INTERVAL_MS = 700;
const MAX_PROCESSING_POLLS = 180;

const AREA_TYPE_OPTIONS = [
  { label: 'Industrial Unit',          value: 'Industrial Unit' },
  { label: 'Cottage',                  value: 'Cottage' },
  { label: 'Micro',                    value: 'Micro' },
  { label: 'Household',                value: 'Household' },
  { label: 'Industrial Flatted Units', value: 'Industrial Flatted Units' },
  { label: 'IT Unit',                  value: 'IT Unit' },
];

const LOCATION_OPTIONS = [
  { label: 'Urban', value: 'Urban' },
  { label: 'Rural', value: 'Rural' },
];

function formatFileSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / 1024).toFixed(1) + ' KB';
}

// ─────────────────────────────────────────────────────────────────────────────
// ValidationPanel is defined OUTSIDE UploadScreen so React never recreates
// the component type on re-render — this prevents the dropdown "reset" flicker.
// ─────────────────────────────────────────────────────────────────────────────
function ValidationPanel({ jobId, areaType, location, onAreaTypeChange, onLocationChange, onValidate }) {
  return (
    <div className="options-card card animate-in">
      <div className="card-header">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/>
        </svg>
        Validation Parameters
      </div>

      <div className="success-banner">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
        </svg>
        File processed. Select parameters and run — or change and re-run without re-uploading.
      </div>

      <div className="job-id-display">
        <span className="job-id-label">Job ID</span>
        <code className="job-id-value">{jobId}</code>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="area-type">
          Building Area Type <span className="form-required">*</span>
        </label>
        <div className="select-wrap">
          <select
            id="area-type"
            className="form-select"
            value={areaType}
            onChange={(e) => onAreaTypeChange(e.target.value)}
          >
            <option value="" disabled>Select area type…</option>
            {AREA_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <svg className="select-arrow" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M6 8L1 3h10L6 8z"/>
          </svg>
        </div>
        <p className="form-hint">Cottage / Micro / Household all match the same rule set.</p>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="location">
          Location Type <span className="form-required">*</span>
        </label>
        <div className="select-wrap">
          <select
            id="location"
            className="form-select"
            value={location}
            onChange={(e) => onLocationChange(e.target.value)}
          >
            <option value="" disabled>Select location…</option>
            {LOCATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <svg className="select-arrow" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M6 8L1 3h10L6 8z"/>
          </svg>
        </div>
        <p className="form-hint">Urban or Rural jurisdiction for rule selection.</p>
      </div>

      <button
        className="btn btn-primary btn-full btn-validate"
        onClick={onValidate}
        disabled={!areaType || !location}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M10.97 4.97a.75.75 0 0 1 1.071 1.05l-3.992 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.235.235 0 0 1 .02-.022z"/>
        </svg>
        Run Validation
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────
function UploadScreen({ onValidationComplete, onJobReady, activeJob }) {
  const [dragOver, setDragOver]             = useState(false);
  const [selectedFile, setSelectedFile]     = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // 'idle' | 'uploading' | 'processing' | 'selecting' | 'validating' | 'error'
  const [step, setStep]         = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const [jobId, setJobId]                       = useState(null);
  const [selectedAreaType, setSelectedAreaType] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');

  const fileInputRef = useRef(null);

  // When the user clicks "Re-evaluate Same File" on the result screen,
  // App.js switches to 'upload' while keeping activeJob intact.
  // This effect restores the selecting panel using the preserved job.
  useEffect(() => {
    if (activeJob?.jobId && activeJob?.csvReady && step === 'idle') {
      setJobId(activeJob.jobId);
      setStep('selecting');
    }
  }, []); // run once on mount — activeJob is stable from parent

  const validateFileType = (file) => {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    return ACCEPTED_EXTENSIONS.includes(ext);
  };

  const handleFileSelect = useCallback((file) => {
    if (!file) return;
    if (!validateFileType(file)) {
      setErrorMsg('Only .dxf and .dwg files are supported.');
      setStep('error');
      return;
    }
    setSelectedFile(file);
    setStep('idle');
    setErrorMsg('');
    setJobId(null);
    setSelectedAreaType('');
    setSelectedLocation('');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files[0]);
  }, [handleFileSelect]);

  const handleDragOver  = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = ()  => setDragOver(false);

  const handleInputChange = (e) => {
    handleFileSelect(e.target.files[0]);
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setStep('uploading');
    setUploadProgress(0);
    setErrorMsg('');

    try {
      const data = await uploadFile(selectedFile, setUploadProgress);

      if (data.status === 'pending_conversion') {
        setErrorMsg('DWG conversion is not yet supported. Please upload a DXF file.');
        setStep('error');
        return;
      }

      setJobId(data.job_id);
      let pollStatus = data.status;

      if (pollStatus === 'processing' || pollStatus === 'queued') {
        setStep('processing');
        for (let i = 0; i < MAX_PROCESSING_POLLS; i++) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
          const s = await getUploadStatus(data.job_id);
          pollStatus = s.status;
          if (pollStatus === 'failed') throw new Error(s.message || 'DXF processing failed.');
          if (pollStatus === 'converted') break;
        }
        if (pollStatus !== 'converted') {
          throw new Error('Processing is taking too long. Please try again.');
        }
      }

      onJobReady?.(data.job_id, selectedFile.name);
      setSelectedAreaType('');
      setSelectedLocation('');
      setStep('selecting');
    } catch (err) {
      setErrorMsg(
        err.response?.data?.detail?.message ||
        err.response?.data?.message ||
        err.message ||
        'Upload failed. Please try again.'
      );
      setStep('error');
    }
  };

  const handleValidate = async () => {
    if (!jobId || !selectedAreaType || !selectedLocation) return;
    setStep('validating');
    setErrorMsg('');

    try {
      const result = await validateJob(jobId, selectedAreaType, selectedLocation);
      onValidationComplete({
        ...result,
        fileName: selectedFile?.name || activeJob?.fileName || 'drawing',
        areaType: selectedAreaType,
        location: selectedLocation,
      });
    } catch (err) {
      // On validation error, go back to selecting so user can change params
      setStep('selecting');
      setErrorMsg(
        err.response?.data?.detail?.message ||
        err.response?.data?.message ||
        err.message ||
        'Validation failed. Please try again.'
      );
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setStep('idle');
    setErrorMsg('');
    setJobId(null);
    setUploadProgress(0);
    setSelectedAreaType('');
    setSelectedLocation('');
  };

  const isLoading = step === 'uploading' || step === 'processing' || step === 'validating';
  const fileExt   = selectedFile ? selectedFile.name.split('.').pop().toUpperCase() : '';

  return (
    <div className="upload-screen">
      <div className="page-header">
        <h1 className="page-title">File Analysis</h1>
        <p className="page-desc">
          Upload your AutoCAD drawing file to validate it against SIDA building regulations.
        </p>
      </div>

      <div className="upload-layout">
        {/* ── Left: Upload card ── */}
        <div className="upload-card card">
          <div className="card-header">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd"/>
            </svg>
            Upload Drawing File
          </div>

          {/* Drop zone */}
          <div
            className={`drop-zone ${dragOver ? 'drag-over' : ''} ${selectedFile ? 'has-file' : ''} ${isLoading ? 'disabled' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !isLoading && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && fileInputRef.current?.click()}
            aria-label="Upload file drop zone"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".dxf,.dwg"
              onChange={handleInputChange}
              style={{ display: 'none' }}
              aria-label="File input"
            />

            {selectedFile ? (
              <div className="file-preview">
                <div className={`file-icon file-icon--${fileExt.toLowerCase()}`}>{fileExt}</div>
                <div className="file-info">
                  <span className="file-name">{selectedFile.name}</span>
                  <span className="file-size">{formatFileSize(selectedFile.size)}</span>
                </div>
                {!isLoading && (
                  <button
                    className="file-remove"
                    onClick={(e) => { e.stopPropagation(); handleReset(); }}
                    aria-label="Remove file"
                  >✕</button>
                )}
              </div>
            ) : (
              <div className="drop-placeholder">
                <div className="drop-icon">
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <circle cx="24" cy="24" r="23" stroke="#c5cae9" strokeWidth="2"/>
                    <path d="M24 14v14M17 21l7-7 7 7" stroke="#3949ab" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 34h16" stroke="#3949ab" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <p className="drop-text">Drag & drop your file here</p>
                <p className="drop-subtext">or click to browse</p>
                <div className="drop-formats">
                  <span className="format-badge">DXF</span>
                  <span className="format-badge">DWG</span>
                </div>
              </div>
            )}
          </div>

          {/* Upload progress */}
          {step === 'uploading' && (
            <div className="progress-wrap">
              <div className="progress-label">
                <span>Uploading…</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          {/* Processing */}
          {step === 'processing' && (
            <div className="progress-wrap">
              <div className="progress-label">
                <span><span className="spinner spinner--dark" /> Parsing DXF file…</span>
                <span>Please wait</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill progress-fill--indeterminate" />
              </div>
            </div>
          )}

          {/* Upload button */}
          {selectedFile && !['selecting', 'validating', 'processing'].includes(step) && (
            <button
              className="btn btn-primary btn-full"
              onClick={handleUpload}
              disabled={isLoading}
            >
              {step === 'uploading' ? (
                <><span className="spinner" /> Uploading…</>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                    <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/>
                  </svg>
                  Upload & Process
                </>
              )}
            </button>
          )}

          {/* Validation error shown inline below the upload card */}
          {step === 'selecting' && errorMsg && (
            <div className="alert alert-error" role="alert" style={{ marginTop: 12 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
              </svg>
              {errorMsg}
            </div>
          )}

          {/* Upload / file error */}
          {step === 'error' && (
            <div className="alert alert-error" role="alert">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
              </svg>
              {errorMsg}
            </div>
          )}
        </div>

        {/* ── Right: Validation parameters panel ── */}
        {(step === 'selecting' || step === 'validating') && (
          <ValidationPanel
            jobId={jobId}
            areaType={selectedAreaType}
            location={selectedLocation}
            onAreaTypeChange={setSelectedAreaType}
            onLocationChange={setSelectedLocation}
            onValidate={handleValidate}
          />
        )}
      </div>

      {/* ── How it works ── */}
      <div className="info-section">
        <h2 className="info-title">How it works</h2>
        <div className="info-steps">
          {[
            { num: '1', title: 'Upload File',          desc: 'Upload your AutoCAD DXF file. The system parses all entities and extracts geometry data.' },
            { num: '2', title: 'Configure Parameters', desc: 'Select building area type and location. Change and re-run without re-uploading.' },
            { num: '3', title: 'View Results',         desc: 'Get a detailed compliance report with PASS/FAIL status for each building regulation check.' },
          ].map((s) => (
            <div key={s.num} className="info-step">
              <div className="info-step-num">{s.num}</div>
              <div>
                <h3 className="info-step-title">{s.title}</h3>
                <p className="info-step-desc">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default UploadScreen;
