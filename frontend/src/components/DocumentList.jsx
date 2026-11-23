import DownloadButton from './DownloadButton.jsx';

function formatSize(bytes) {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 1,
  }).format(bytes / 1024) + ' KB';
}

function formatDate(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function DocumentList({ documents, userId, isLoading }) {
  if (isLoading && documents.length === 0) {
    return <p className="empty-state">Carregando documentos...</p>;
  }

  if (documents.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-mark" aria-hidden="true">—</span>
        <p>Nenhum documento neste espaço.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="document-table">
        <thead>
          <tr>
            <th scope="col">Nome</th>
            <th scope="col">Enviado em</th>
            <th scope="col">Tamanho</th>
            <th scope="col"><span className="visually-hidden">Ações</span></th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <tr key={document.id}>
              <td className="document-name">
                <span className="document-type" aria-hidden="true">DOC</span>
                <span>{document.originalName}</span>
              </td>
              <td className="muted-cell">{formatDate(document.uploadedAt)}</td>
              <td className="muted-cell">{formatSize(document.size)}</td>
              <td className="action-cell">
                <DownloadButton document={document} userId={userId} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}