import { useEffect, useState } from 'react';
import DocumentList from './components/DocumentList.jsx';
import UploadComponent from './components/UploadComponent.jsx';
import { getDocuments } from './services/documentsService.js';
import './styles.css';

export default function App() {
  const [userInput, setUserInput] = useState('demo-user');
  const [activeUser, setActiveUser] = useState('demo-user');
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setError('');

    getDocuments(activeUser)
      .then((items) => {
        if (isCurrent) setDocuments(items);
      })
      .catch((requestError) => {
        if (isCurrent) {
          setDocuments([]);
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [activeUser, refreshKey]);

  function selectUser(event) {
    event.preventDefault();
    const nextUser = userInput.trim();
    if (nextUser) {
      setDocuments([]);
      setActiveUser(nextUser);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Documentos, página inicial">
          <span className="wordmark-mark" aria-hidden="true">D</span>
          <span>Arquivo</span>
        </a>
        <form className="user-form" onSubmit={selectUser}>
          <label htmlFor="user-id">Usuário</label>
          <input
            id="user-id"
            value={userInput}
            onChange={(event) => setUserInput(event.target.value)}
            maxLength={128}
            autoComplete="off"
          />
          <button type="submit" className="button button-quiet">Abrir espaço</button>
        </form>
      </header>

      <section className="page-heading" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">ESPAÇO DE TRABALHO / {activeUser}</p>
          <h1 id="page-title">Documentos</h1>
          <p className="page-description">Arquivos enviados para este espaço.</p>
        </div>
        <span className="document-count" aria-live="polite">
          {documents.length} {documents.length === 1 ? 'documento' : 'documentos'}
        </span>
      </section>

      <section className="upload-section" aria-labelledby="upload-title">
        <div className="section-heading">
          <h2 id="upload-title">Adicionar documento</h2>
        </div>
        <UploadComponent
          userId={activeUser}
          onUploaded={() => setRefreshKey((current) => current + 1)}
        />
      </section>

      <section className="list-section" aria-labelledby="list-title">
        <div className="section-heading">
          <h2 id="list-title">Todos os documentos</h2>
          {isLoading && <span className="subtle-status">Atualizando...</span>}
        </div>
        {error ? (
          <p className="feedback feedback-error" role="alert">{error}</p>
        ) : (
          <DocumentList documents={documents} userId={activeUser} isLoading={isLoading} />
        )}
      </section>

      <footer className="app-footer">
        <span>Armazenamento local</span>
        <span>Os metadados desta versão são mantidos em memória.</span>
      </footer>
    </main>
  );
}
