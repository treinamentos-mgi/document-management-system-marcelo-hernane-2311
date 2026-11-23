const path = require('node:path');
const express = require('express');
const { createDocumentController } = require('./controllers/documentController');
const { createDocumentRepository } = require('./repositories/documentRepository');
const { createLocalFileRepository } = require('./repositories/localFileRepository');
const { createDocumentRoutes } = require('./routes/documentRoutes');
const { createDocumentService } = require('./services/documentService');

function createApp(options = {}) {
  const storageDirectory = options.storageDirectory
    || process.env.STORAGE_DIR
    || path.resolve(__dirname, '../storage');
  const maximumUploadBytes = options.maximumUploadBytes
    || Number(process.env.MAX_UPLOAD_BYTES)
    || 10 * 1024 * 1024;

  const documentRepository = createDocumentRepository();
  const fileRepository = createLocalFileRepository({
    storageDirectory,
    maximumUploadBytes,
  });
  const documentService = createDocumentService({ documentRepository, fileRepository });
  const documentController = createDocumentController(documentService);
  const upload = fileRepository.createUploadMiddleware();

  const app = express();
  app.use(express.json());
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.use(createDocumentRoutes(documentController, upload));
  app.use((req, res) => {
    res.status(404).json({
      error: { code: 'ROUTE_NOT_FOUND', message: 'Rota não encontrada.' },
    });
  });
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);

    const isMulterError = error.name === 'MulterError';
    const statusCode = error.statusCode
      || (isMulterError && error.code === 'LIMIT_FILE_SIZE' ? 413 : null)
      || (isMulterError ? 400 : 500);
    const code = isMulterError
      ? (error.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'INVALID_UPLOAD')
      : (error.code || 'INTERNAL_ERROR');
    const message = statusCode === 500
      ? 'Erro interno do servidor.'
      : (isMulterError && error.code === 'LIMIT_FILE_SIZE'
        ? 'Arquivo excede o limite de tamanho permitido.'
        : (isMulterError ? 'Envio de arquivo inválido.' : error.message));

    res.status(statusCode).json({
      error: {
        code,
        message,
      },
    });
  });

  return app;
}

const app = createApp();
app.createApp = createApp;

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`DMS backend ouvindo na porta ${port}`));
}

module.exports = app;
