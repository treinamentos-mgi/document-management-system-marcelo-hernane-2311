const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const multer = require('multer');

function createLocalFileRepository(options = {}) {
  const storageDirectory = path.resolve(options.storageDirectory || path.resolve(__dirname, '../../storage'));
  const maximumUploadBytes = Number(options.maximumUploadBytes) > 0
    ? Number(options.maximumUploadBytes)
    : 10 * 1024 * 1024;

  fs.mkdirSync(storageDirectory, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, callback) => callback(null, storageDirectory),
    filename: (req, file, callback) => callback(null, randomUUID()),
  });

  function getStoredPath(storedName) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(storedName)) {
      throw new Error('Nome de arquivo armazenado inválido.');
    }
    return path.join(storageDirectory, storedName);
  }

  return {
    createUploadMiddleware() {
      return multer({
        storage,
        limits: {
          fileSize: maximumUploadBytes,
          files: 1,
          fields: 0,
          parts: 2,
        },
      });
    },

    createReadStream(storedName) {
      return fs.createReadStream(getStoredPath(storedName));
    },

    removeFile(storedName) {
      return fs.promises.unlink(getStoredPath(storedName));
    },
  };
}

module.exports = { createLocalFileRepository };