---
description: Verifica se arquivos anexados no fluxo de upload podem ser duplicados e propõe/aplica a correção.
name: verificar-duplicados
argument-hint: escopo da verificação (ex. upload no backend, UploadComponent no frontend)
agent: agent
---

# Verificar arquivos duplicados anexados

Analise o fluxo de upload de documentos do DMS considerando o escopo `${input:escopo:escopo da verificação (opcional, padrão: fluxo completo de upload)}` e verifique se arquivos duplicados podem ser anexados e armazenados.

Siga o fluxo de dependência do backend: `routes -> controllers -> services -> repositories`.

Passos:

1. Mapeie o caminho do upload: `backend/src/routes/documentRoutes.js`, `backend/src/controllers/documentController.js`, `backend/src/services/documentService.js`, `backend/src/repositories/documentRepository.js`, `backend/src/repositories/localFileRepository.js` e `frontend/src/components/UploadComponent.jsx`.
2. Verifique se há checagem de duplicidade e em qual critério ela se baseia (nome original, tamanho, hash do conteúdo ou combinação). Considere que os metadados ficam em memória e os arquivos ficam em `backend/storage`.
3. Identifique casos de borda: mesmo arquivo enviado duas vezes pelo mesmo dono, mesmo nome com conteúdo diferente, mesmo conteúdo com nome diferente, uploads concorrentes e arquivos com caminho no nome.
4. Não considere duplicado entre donos diferentes como erro: a gestão é por usuário (`X-User-Id`).
5. Se houver lacuna, proponha a menor correção que respeite a arquitetura em camadas. A regra de negócio deve ficar em `services/`, a persistência e a busca em `repositories/`, e o retorno HTTP em `controllers/`. Use hash SHA-256 com `node:crypto` quando o critério for conteúdo, sem dependências externas.
6. Trate erros de entrada HTTP com código e mensagem em português, seguindo o padrão de `createServiceError` e de `requireOwner`.
7. Adicione testes em `backend/test` somente para o comportamento introduzido, usando `node:test` e `node:assert`, sem serviços externos.

Requisitos:

- Não quebre funcionalidades existentes, como listagem e download.
- Mantenha mensagens ao usuário e comentários em português; símbolos de código em inglês.
- Não use armazenamento ou serviços de terceiros.

Entrega:

- Resumo do que foi encontrado, com caminhos de arquivo e linhas.
- Alterações feitas (ou proposta, se você não aplicar mudanças).
- Resultado dos testes executados (`npm test` no backend).
