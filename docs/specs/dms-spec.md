# Especificação - Document Management System

## 1. Objetivo

Permitir que usuários enviem, consultem e baixem documentos próprios por uma interface web, com arquivos armazenados no filesystem local da aplicação.

## 2. Escopo

### Dentro do escopo

- Upload de um documento por requisição.
- Listagem dos metadados dos documentos do usuário identificado na requisição.
- Download de um documento pelo identificador, limitado ao usuário dono.
- Interface React para upload, listagem e download.
- Metadados mantidos em memória durante a execução do processo.
- Identificação simples do usuário via cabeçalho `X-User-Id`.

### Fora do escopo

- Armazenamento externo ou em nuvem.
- Persistência durável dos metadados ou recuperação após reinício.
- Autenticação, autorização baseada em credenciais e gestão de contas.
- Versionamento, exclusão, edição e compartilhamento de documentos.
- Busca, paginação e pastas.
- Verificação antivírus ou validação de conteúdo por tipo de arquivo.

## 3. Requisitos funcionais

| ID | Requisito |
| --- | --- |
| RF-01 | O usuário pode enviar um arquivo usando o campo multipart `file`. |
| RF-02 | O sistema gera um identificador UUID e um nome físico interno único para o arquivo. |
| RF-03 | O sistema registra os metadados do arquivo e associa o registro ao usuário da requisição. |
| RF-04 | O usuário pode listar somente os documentos associados ao seu identificador, em ordem decrescente de envio. |
| RF-05 | O usuário pode baixar um documento existente de sua propriedade pelo identificador. |
| RF-06 | O sistema rejeita requisições sem `X-User-Id`, com identificador vazio ou maior que 128 caracteres. |
| RF-07 | O sistema rejeita upload sem arquivo, com campo diferente de `file` ou acima do limite configurado. |
| RF-08 | O sistema mantém `GET /health`, que retorna o estado de saúde do backend. |
| RF-09 | A interface permite escolher o identificador do espaço, enviar arquivos, visualizar metadados e iniciar downloads. |

## 4. Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | Os arquivos são gravados exclusivamente no filesystem local usando Multer com `diskStorage`. |
| RNF-02 | O diretório padrão é `backend/storage`; `STORAGE_DIR` permite configurá-lo. |
| RNF-03 | O limite padrão de upload é 10 MiB e pode ser configurado por `MAX_UPLOAD_BYTES`. |
| RNF-04 | A porta HTTP usa `PORT`, com padrão `3000`. |
| RNF-05 | Os metadados ficam em memória e não sobrevivem à reinicialização do processo. |
| RNF-06 | A API retorna erros JSON com `error.code` e `error.message`. |
| RNF-07 | O nome original não é usado como caminho físico; o nome armazenado é gerado pelo servidor. |
| RNF-08 | Símbolos de código são nomeados em inglês; textos apresentados ao usuário são em português. |
| RNF-09 | O frontend chama `/api`; o proxy de desenvolvimento encaminha para o backend e remove esse prefixo. |

## 5. Modelo de dados

### Documento

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `id` | string (UUID) | Identificador público único do documento. |
| `originalName` | string | Nome de exibição recebido no upload, limitado a 255 caracteres e sem diretórios. |
| `storedName` | string | Nome físico interno gerado pelo servidor; nunca retornado pela API. |
| `mimeType` | string | Tipo informado pelo cliente durante o upload; metadado não verificado. |
| `size` | number | Tamanho do arquivo em bytes. |
| `uploadedAt` | string (ISO 8601) | Data e hora do registro do upload em UTC. |
| `owner` | string | Identificador do usuário recebido em `X-User-Id`. |

O repositório de metadados indexa registros por `id`. A propriedade é conferida tanto na listagem quanto na busca para download. A API omite `storedName`.

## 6. Contratos de API

Os caminhos abaixo são os caminhos do backend. No frontend de desenvolvimento, o prefixo `/api` é aplicado pelo proxy do Vite: por exemplo, `/api/upload` é encaminhado para `/upload`.

### Convenções

- Todas as rotas do DMS exigem `X-User-Id` não vazio, com até 128 caracteres.
- Erro: `{ "error": { "code": "...", "message": "..." } }`.
- `404 DOCUMENT_NOT_FOUND` é retornado tanto para identificador inexistente quanto para documento de outro usuário.

### `POST /upload`

- Entrada: `multipart/form-data` com arquivo no campo `file`; cabeçalho `X-User-Id`.
- Sucesso `201`:

```json
{
  "document": {
    "id": "uuid",
    "originalName": "relatorio.pdf",
    "mimeType": "application/pdf",
    "size": 12345,
    "uploadedAt": "2026-11-23T12:00:00.000Z",
    "owner": "usuario-1"
  }
}
```

- Erros: `400 INVALID_USER`, `400 FILE_REQUIRED`, `400 INVALID_UPLOAD`, `413 FILE_TOO_LARGE`, `500 INTERNAL_ERROR`.

### `GET /documents`

- Entrada: cabeçalho `X-User-Id`.
- Sucesso `200`: `{ "documents": [<metadados públicos do documento>] }`.
- A lista contém somente documentos do usuário e vem ordenada do mais recente para o mais antigo.
- Erros: `400 INVALID_USER`, `500 INTERNAL_ERROR`.

### `GET /documents/:id/download`

- Entrada: identificador na URL e cabeçalho `X-User-Id`.
- Sucesso `200`: conteúdo binário como anexo, com nome original no `Content-Disposition`.
- Erros: `400 INVALID_USER`, `404 DOCUMENT_NOT_FOUND`, `404 FILE_NOT_FOUND`, `500 INTERNAL_ERROR`.

### `GET /health`

- Sucesso `200`: `{ "status": "ok" }`.

## 7. Decisões arquiteturais e riscos

- O fluxo segue `routes -> controllers -> services -> repositories`. `app.js` compõe as implementações e injeta o middleware Multer na rota.
- `documentRepository` mantém metadados em memória; `localFileRepository` configura Multer `diskStorage` e fornece streams de leitura do diretório local.
- O `owner` é derivado do cabeçalho, nunca do corpo de upload. Essa identificação é apenas conveniência para o MVP: como não há autenticação, um cliente pode declarar outro `X-User-Id`. Não usar como fronteira de segurança em implantação compartilhada.
- Arquivos podem permanecer órfãos se o processo encerrar entre a gravação no disco e a criação dos metadados. O inverso também é possível se os arquivos locais forem removidos manualmente. Sem persistência de metadados, reiniciar o backend torna os registros inacessíveis pela API.
- O tipo MIME vem do cliente e não é validado. Download é entregue como anexo; conteúdo perigoso, antivírus e políticas de formatos permitidos não fazem parte deste escopo.
- O armazenamento local pressupõe volume persistente e permissões de escrita no diretório configurado.

## 8. Plano de execução

1. **Especificação:** criar este documento em `docs/specs/dms-spec.md`; revisar requisitos, contratos, riscos e critérios de aceite antes de implementar.
2. **Backend:** criar repositories para metadados em memória e arquivos locais, service de documentos, controller HTTP e rotas; integrar `multer` com `diskStorage` e configuração por ambiente.
3. **Testes backend:** verificar saúde, upload, listagem, download, isolamento por usuário, validações e limite de tamanho com diretório temporário.
4. **Frontend:** implementar serviço `fetch`, componente de upload, listagem, ação de download e seleção do espaço do usuário, usando o proxy `/api` existente.
5. **Integração e aceite:** executar testes backend e build frontend; validar o fluxo completo de envio, listagem e download. Nenhum armazenamento externo ou persistência durável deve ser introduzido.

## 9. Critérios de aceite

- Upload válido retorna `201` com metadados públicos e salva bytes em `backend/storage` ou no diretório configurado.
- O nome físico é único e `storedName` não aparece nas respostas.
- Usuários veem somente seus registros; downloads de outro usuário e IDs inexistentes retornam `404`.
- Ausência de usuário ou arquivo retorna `400`; upload maior que o limite retorna `413`.
- A interface permite enviar, listar e baixar arquivos, exibindo estados de carregamento e erro.
- `cd backend && npm test` e `cd frontend && npm run build` concluem sem falhas.