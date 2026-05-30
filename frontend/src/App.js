import { useState } from 'react';
import UploadScreen from './screens/UploadScreen';
import ResultScreen from './screens/ResultScreen';
import './App.css';

function App() {
  const [screen, setScreen] = useState('upload'); // 'upload' | 'result'
  const [validationData, setValidationData] = useState(null);

  // { jobId, fileName, csvReady } — survives screen transitions
  const [activeJob, setActiveJob] = useState(null);

  const handleValidationComplete = (data) => {
    setValidationData(data);
    setScreen('result');
  };

  const handleJobReady = (jobId, fileName) => {
    setActiveJob({ jobId, fileName, csvReady: true });
  };

  // Full reset — clears everything, goes back to a blank upload screen
  const handleReset = () => {
    setValidationData(null);
    setActiveJob(null);
    setScreen('upload');
  };

  // Re-evaluate — keeps the active job, goes back to upload screen in selecting mode
  const handleRevalidate = () => {
    setScreen('upload');
    // activeJob is preserved so UploadScreen can restore the selecting panel
  };

  const handleDownloadCsv = () => {
    if (!activeJob?.jobId) return;
    const base = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    window.open(`${base}/upload/csv/${activeJob.jobId}`, '_blank');
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="header-brand">
            <div className="header-logo">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect width="28" height="28" rx="6" fill="white" fillOpacity="0.15"/>
                <path d="M6 22L14 6L22 22H6Z" stroke="white" strokeWidth="2" strokeLinejoin="round" fill="none"/>
                <path d="M9 17H19" stroke="white" strokeWidth="1.5"/>
              </svg>
            </div>
            <div>
              <span className="header-title">SIDA</span>
              <span className="header-subtitle">Building Plan Validator</span>
            </div>
          </div>

          <nav className="header-nav">
            {activeJob?.csvReady && (
              <button className="nav-btn nav-btn--csv" onClick={handleDownloadCsv} title="Download extracted CSV">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                  <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                </svg>
                Download CSV
              </button>
            )}

            {validationData && (
              <button
                className={`nav-btn ${screen === 'result' ? 'active' : ''}`}
                onClick={() => setScreen('result')}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
                  <path d="M10.97 4.97a.75.75 0 0 1 1.071 1.05l-3.992 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.235.235 0 0 1 .02-.022z"/>
                </svg>
                Results
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="app-main">
        {screen === 'upload' && (
          <UploadScreen
            onValidationComplete={handleValidationComplete}
            onJobReady={handleJobReady}
            activeJob={activeJob}
          />
        )}
        {screen === 'result' && validationData && (
          <ResultScreen
            data={validationData}
            onBack={handleReset}
            onRevalidate={handleRevalidate}
          />
        )}
      </main>

      <footer className="app-footer">
        <span>© 2026 SIDA — AutoCAD DXF Validation System</span>
      </footer>
    </div>
  );
}

export default App;
