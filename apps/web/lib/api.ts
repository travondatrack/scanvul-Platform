const API_BASE = "";

export type ScanSummary = {
  id: string;
  status: string;
  riskLevel: string;
  riskPercent: number;
};

type UploadInitResponse = {
  uploadId: string;
  objectKey: string;
  uploadUrl: string;
  status: string;
};

export async function createScan(
  sourceType: string,
  sourceValue: string,
): Promise<ScanSummary> {
  const response = await fetch(`${API_BASE}/api/v1/scans`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sourceType, sourceValue }),
  });

  if (!response.ok) {
    throw new Error("Failed to create scan");
  }

  return response.json();
}

export async function getScan(scanId: string) {
  const response = await fetch(`${API_BASE}/api/v1/scans/${scanId}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch scan");
  }

  return response.json();
}

export async function listScans(limit = 10): Promise<{ items: ScanSummary[] }> {
  const response = await fetch(`${API_BASE}/api/v1/scans?limit=${limit}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Failed to list scans");
  }
  return response.json();
}

export async function initUpload(
  fileName: string,
  size: number,
): Promise<UploadInitResponse> {
  const response = await fetch(`${API_BASE}/api/v1/uploads/init`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fileName, size }),
  });

  if (!response.ok) {
    throw new Error("Failed to initialize upload");
  }

  return response.json();
}

export async function uploadArchive(
  uploadId: string,
  file: File,
): Promise<void> {
  const formData = new FormData();
  formData.append("archive", file);

  const response = await fetch(`${API_BASE}/api/v1/uploads/${uploadId}/data`, {
    method: "PUT",
    body: formData,
  });
  if (!response.ok) {
    throw new Error("Failed to upload archive");
  }
}

export async function completeUpload(uploadId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v1/uploads/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uploadId }),
  });
  if (!response.ok) {
    throw new Error("Failed to complete upload");
  }
}

export async function publishBadge(
  scanId: string,
): Promise<{ publicUrl: string }> {
  const response = await fetch(
    `${API_BASE}/api/v1/scans/${scanId}/badge/publish`,
    {
      method: "POST",
    },
  );
  if (!response.ok) {
    throw new Error("Failed to publish badge");
  }
  return response.json();
}
