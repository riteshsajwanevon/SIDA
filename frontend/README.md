# SIDA Frontend

React.js frontend for the SIDA AutoCAD DXF/DWG Building Plan Validator.

## Prerequisites

- Node.js 18+ and npm
- SIDA backend running on `http://localhost:8000`

## Setup & Run

```bash
cd /home/ritesh/SIDA/frontend
npm install
npm start
```

The app opens at **http://localhost:3000**.

## Environment

Edit `.env` to point to a different backend:

```
REACT_APP_API_URL=http://localhost:8000
```

## Screens

### Screen 1 — Upload
- Drag & drop or click to select a `.dxf` or `.dwg` file
- File is uploaded to `POST /upload`
- After processing, dropdowns appear for **Building Area Type** and **Location**
- Click **Run Validation** → calls `POST /validate`

### Screen 2 — Results
- **File Analysis Summary** header with filename, file type, processing info
- **4 summary cards**: Total Checks, Passed, Failed, Compliance Rate
- **Parameters table** matching the SIDA report format:
  - `#` | Parameters | Required/Permissible | Provided | Compliance Check
  - Color-coded rows (green = compliant, red = non-compliant)
  - Tab filter: All / Passed / Failed
- **Non-Compliance Details** section listing all failed checks
- **Print Report** button for browser printing

## Build for Production

```bash
npm run build
```

Outputs to `build/` — serve with any static file server.
