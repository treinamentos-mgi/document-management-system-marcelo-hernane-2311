const { randomUUID } = require('node:crypto');

function createServiceError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function toPublicDocument(document) {
  const { storedName, ...publicDocument } = document;
  return publicDocument;
}

function createDocumentService({ documentRepository, fileRepository }) {
  return {
    async uploadDocument({ file, owner }) {
      if (!file) {
        throw createServiceError(400, 'FILE_REQUIRED', 'Envie um arquivo no campo "file".');
      }

      const originalName = file.originalname
        .replaceAll('\\', '/')
        .split('/')
        .pop()
        .slice(0, 255) || 'documento';
      const document = {
        id: randomUUID(),
        originalName,
        storedName: file.filename,
        mimeType: file.mimetype || 'application/octet-stream',
        size: file.size,
        uploadedAt: new Date().toISOString(),
        owner,
      };

      try {
        documentRepository.save(document);
      } catch (error) {
        try {
          await fileRepository.removeFile(document.storedName);
        } catch {}
        throw error;
      }
      return toPublicDocument(document);
    },

    listDocuments(owner) {
      return documentRepository.listByOwner(owner).map(toPublicDocument);
    },

    getDocumentForDownload(id, owner) {
      const document = documentRepository.findByIdAndOwner(id, owner);
      if (!document) {
        throw createServiceError(404, 'DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
      }

      return {
        document: toPublicDocument(document),
        stream: fileRepository.createReadStream(document.storedName),
      };
    },
  };
}

module.exports = { createDocumentService };