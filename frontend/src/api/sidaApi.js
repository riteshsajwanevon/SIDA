import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 300000, // 5 minutes — large DXF files can take a while to parse
});

/**
 * POST /upload
 * Uploads a DXF or DWG file.
 * @param {File} file
 * @param {function} onProgress - (percent: number) => void
 * @returns {Promise<UploadResponse>}
 */
export async function uploadFile(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (event.total && onProgress) {
        onProgress(Math.round((event.loaded * 100) / event.total));
      }
    },
  });

  return response.data;
}

/**
 * GET /upload/status/{jobId}
 * Checks background DXF processing state.
 * @param {string} jobId
 * @returns {Promise<JobStatusResponse>}
 */
export async function getUploadStatus(jobId) {
  const response = await api.get(`/upload/status/${jobId}`);
  return response.data;
}

/**
 * POST /validate
 * Validates a processed job against building rules.
 * @param {string} jobId
 * @param {string} areaType
 * @param {string} location
 * @returns {Promise<ValidationResponse>}
 */
export async function validateJob(jobId, areaType, location) {
  const response = await api.post('/validate', {
    job_id: jobId,
    area_type: areaType,
    location: location,
  });

  return response.data;
}

/**
 * GET /health
 * @returns {Promise<{status: string}>}
 */
export async function checkHealth() {
  const response = await api.get('/health');
  return response.data;
}
