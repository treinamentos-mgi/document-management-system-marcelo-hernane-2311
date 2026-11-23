function createDocumentController(documentService) {
  function requireOwner(req, res, next) {
    const owner = req.get('X-User-Id')?.trim();
    if (!owner || owner.length > 128) {
      return res.status(400).json({
        error: { code: 'INVALID_USER', message: 'Informe um identificador de usuário válido.' },
      });
    }

    req.owner = owner;
    return next();
  }

  function upload(req, res, next) {
    try {
      const document = documentService.uploadDocument({ file: req.file, owner: req.owner });
      return res.status(201).json({ document });
    } catch (error) {
      return next(error);
    }
  }

  function list(req, res, next) {
    try {
      return res.json({ documents: documentService.listDocuments(req.owner) });
    } catch (error) {
      return next(error);
    }
  }

  function download(req, res, next) {
    let result;
    try {
      result = documentService.getDocumentForDownload(req.params.id, req.owner);
    } catch (error) {
      return next(error);
    }

    const { document, stream } = result;
    stream.once('error', (error) => {
      if (res.headersSent) {
        res.destroy(error);
        return;
      }

      if (error.code === 'ENOENT') {
        error.statusCode = 404;
        error.code = 'FILE_NOT_FOUND';
        error.message = 'Arquivo não encontrado no armazenamento local.';
      }
      next(error);
    });

    res.attachment(document.originalName);
    stream.pipe(res);
  }

  return { requireOwner, upload, list, download };
}

module.exports = { createDocumentController };