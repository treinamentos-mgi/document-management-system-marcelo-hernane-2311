const express = require('express');

function createDocumentRoutes(controller, upload, authenticateRequest) {
  const router = express.Router();

  if (authenticateRequest) router.use(authenticateRequest);
  router.post('/upload', controller.requireOwner, upload.single('file'), controller.upload);
  router.get('/documents', controller.requireOwner, controller.list);
  router.get('/documents/:id/download', controller.requireOwner, controller.download);

  return router;
}

module.exports = { createDocumentRoutes };