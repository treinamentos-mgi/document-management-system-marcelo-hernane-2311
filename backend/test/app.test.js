const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const app = require('../src/app');
const { createLocalFileRepository } = require('../src/repositories/localFileRepository');
const { createDocumentService } = require('../src/services/documentService');

const servers = [];
const temporaryDirectories = [];

async function startTestServer(options = {}) {
  const storageDirectory = options.storageDirectory
    || await fs.mkdtemp(path.join(os.tmpdir(), 'dms-test-'));
  temporaryDirectories.push(storageDirectory);
  const testApp = app.createApp({ storageDirectory, ...options });
  const server = testApp.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise((resolve) => server.once('listening', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  })));
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, {
    recursive: true,
    force: true,
  })));
});

test('o app backend é exportado', () => {
  assert.equal(typeof app, 'function');
  assert.equal(typeof app.createApp, 'function');
});

test('faz upload, lista e baixa arquivos isolados por usuário', async () => {
  const baseUrl = await startTestServer();
  const form = new FormData();
  form.append('file', new Blob(['conteúdo do documento'], { type: 'text/plain' }), 'relatorio.txt');

  const uploadResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'ana' },
    body: form,
  });
  assert.equal(uploadResponse.status, 201);
  const { document } = await uploadResponse.json();
  assert.equal(document.originalName, 'relatorio.txt');
  assert.equal(document.size, Buffer.byteLength('conteúdo do documento'));
  assert.equal(document.owner, 'ana');
  assert.equal('storedName' in document, false);

  const listResponse = await fetch(`${baseUrl}/documents`, {
    headers: { 'X-User-Id': 'ana' },
  });
  assert.deepEqual((await listResponse.json()).documents.map(({ id }) => id), [document.id]);

  const otherUserList = await fetch(`${baseUrl}/documents`, {
    headers: { 'X-User-Id': 'bia' },
  });
  assert.deepEqual((await otherUserList.json()).documents, []);

  const deniedDownload = await fetch(`${baseUrl}/documents/${document.id}/download`, {
    headers: { 'X-User-Id': 'bia' },
  });
  assert.equal(deniedDownload.status, 404);

  const downloadResponse = await fetch(`${baseUrl}/documents/${document.id}/download`, {
    headers: { 'X-User-Id': 'ana' },
  });
  assert.equal(downloadResponse.status, 200);
  assert.equal(await downloadResponse.text(), 'conteúdo do documento');
  assert.match(downloadResponse.headers.get('content-disposition'), /relatorio\.txt/);
});

test('lista documentos do usuário do mais recente para o mais antigo', async () => {
  const baseUrl = await startTestServer();
  const uploadedIds = [];

  for (const name of ['primeiro.txt', 'segundo.txt']) {
    const form = new FormData();
    form.append('file', new Blob(['abc']), name);
    const response = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: { 'X-User-Id': 'ana' },
      body: form,
    });
    uploadedIds.push((await response.json()).document.id);
    // Garante timestamps distintos para validar a ordenação.
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  const response = await fetch(`${baseUrl}/documents`, { headers: { 'X-User-Id': 'ana' } });
  assert.equal(response.status, 200);
  const { documents } = await response.json();
  assert.deepEqual(documents.map(({ originalName }) => originalName), ['segundo.txt', 'primeiro.txt']);
  assert.deepEqual(documents.map(({ id }) => id), uploadedIds.reverse());
});

test('retorna lista vazia para usuário sem documentos', async () => {
  const baseUrl = await startTestServer();
  const response = await fetch(`${baseUrl}/documents`, { headers: { 'X-User-Id': 'ana' } });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { documents: [] });
});

test('retorna 404 ao baixar um documento inexistente', async () => {
  const baseUrl = await startTestServer();
  const response = await fetch(`${baseUrl}/documents/id-inexistente/download`, {
    headers: { 'X-User-Id': 'ana' },
  });

  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'DOCUMENT_NOT_FOUND');
});

test('retorna 404 ao baixar quando o arquivo foi removido do armazenamento', async () => {
  const storageDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'dms-test-'));
  const baseUrl = await startTestServer({ storageDirectory });
  const form = new FormData();
  form.append('file', new Blob(['abc']), 'sumido.txt');
  const { document } = await (await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'ana' },
    body: form,
  })).json();

  for (const storedName of await fs.readdir(storageDirectory)) {
    await fs.unlink(path.join(storageDirectory, storedName));
  }

  const response = await fetch(`${baseUrl}/documents/${document.id}/download`, {
    headers: { 'X-User-Id': 'ana' },
  });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'FILE_NOT_FOUND');
});

test('valida usuário, arquivo e limite de upload', async () => {
  const baseUrl = await startTestServer({ maximumUploadBytes: 4 });
  const missingOwnerForm = new FormData();
  missingOwnerForm.append('file', new Blob(['abc']), 'file.txt');

  const missingOwner = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    body: missingOwnerForm,
  });
  assert.equal(missingOwner.status, 400);
  assert.equal((await missingOwner.json()).error.code, 'INVALID_USER');

  const emptyUpload = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'ana' },
    body: new FormData(),
  });
  assert.equal(emptyUpload.status, 400);
  assert.equal((await emptyUpload.json()).error.code, 'FILE_REQUIRED');

  const unexpectedFieldForm = new FormData();
  unexpectedFieldForm.append('attachment', new Blob(['abc']), 'file.txt');
  const unexpectedFieldUpload = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'ana' },
    body: unexpectedFieldForm,
  });
  assert.equal(unexpectedFieldUpload.status, 400);
  assert.equal((await unexpectedFieldUpload.json()).error.code, 'INVALID_UPLOAD');

  const oversizedForm = new FormData();
  oversizedForm.append('file', new Blob(['12345']), 'large.txt');
  const oversizedUpload = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'ana' },
    body: oversizedForm,
  });
  assert.equal(oversizedUpload.status, 413);
  assert.equal((await oversizedUpload.json()).error.code, 'FILE_TOO_LARGE');
});

test('rejeita campos multipart não utilizados', async () => {
  const baseUrl = await startTestServer();
  const form = new FormData();
  form.append('extra', 'valor');
  form.append('file', new Blob(['abc']), 'file.txt');

  const response = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'ana' },
    body: form,
  });

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'INVALID_UPLOAD');
});

test('usa o proprietário resolvido por autenticação confiável', async () => {
  const baseUrl = await startTestServer({
    authenticateRequest: (req, res, next) => {
      req.authenticatedUser = { id: 'ana' };
      next();
    },
    resolveOwner: (req) => req.authenticatedUser.id,
  });
  const form = new FormData();
  form.append('file', new Blob(['abc']), 'file.txt');

  const response = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'bia' },
    body: form,
  });

  assert.equal(response.status, 201);
  assert.equal((await response.json()).document.owner, 'ana');
});

test('bloqueia rotas de documentos quando a autenticação é exigida, mas não configurada', async () => {
  const baseUrl = await startTestServer({ requireOwnerAuthentication: true });
  const response = await fetch(`${baseUrl}/documents`, {
    headers: { 'X-User-Id': 'ana' },
  });

  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'AUTH_NOT_CONFIGURED');
});

test('limpa o arquivo se a gravação dos metadados falhar', async () => {
  const removedFiles = [];
  const documentService = createDocumentService({
    documentRepository: {
      save() {
        throw new Error('falha no repositório');
      },
    },
    fileRepository: {
      async removeFile(storedName) {
        removedFiles.push(storedName);
      },
    },
  });
  const file = { originalname: 'arquivo.txt', filename: 'arquivo-interno', size: 3 };

  await assert.rejects(documentService.uploadDocument({ file, owner: 'ana' }), /falha no repositório/);
  assert.deepEqual(removedFiles, ['arquivo-interno']);
});

test('rejeita nomes internos que não sejam UUIDs antes de abrir ou remover', async () => {
  const storageDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'dms-path-test-'));
  temporaryDirectories.push(storageDirectory);
  const fileRepository = createLocalFileRepository({ storageDirectory });

  assert.throws(() => fileRepository.createReadStream('../outside'), /inválido/);
  assert.throws(() => fileRepository.removeFile('../outside'), /inválido/);
});
