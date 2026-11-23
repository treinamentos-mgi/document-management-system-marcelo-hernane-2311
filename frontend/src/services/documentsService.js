async function request(path, userId, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...options.headers,
      'X-User-Id': userId,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message || 'Não foi possível concluir a solicitação.');
  }

  return response;
}

export async function getDocuments(userId) {
  const response = await request('/documents', userId);
  const payload = await response.json();
  return payload.documents;
}

export async function uploadDocument(userId, file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await request('/upload', userId, {
    method: 'POST',
    body: formData,
  });
  const payload = await response.json();
  return payload.document;
}

export async function downloadDocument(userId, documentId) {
  const response = await request(`/documents/${encodeURIComponent(documentId)}/download`, userId);
  return response.blob();
}