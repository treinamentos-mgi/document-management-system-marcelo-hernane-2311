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

  return {
    createUploadMiddleware() {
      return multer({ storage, limits: { fileSize: maximumUploadBytes } });
    },

    createReadStream(storedName) {
      if (path.basename(storedName) !== storedName) {
        throw new Error('Nome de arquivo armazenado inválido.');
      }
      return fs.createReadStream(path.join(storageDirectory, storedName));
    },
  };
}

module.exports = { createLocalFileRepository };