import { useState } from 'react';
import { uploadDocument } from '../services/documentsService.js';

export default function UploadComponent({ userId, onUploaded }) {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  async function submitUpload(event) {
    event.preventDefault();
    if (!file) {
      setMessage('Escolha um arquivo para enviar.');
      return;
    }

    setIsUploading(true);
    setMessage('');
    try {
      await uploadDocument(userId, file);
      setFile(null);
      event.currentTarget.reset();
      setMessage('Documento enviado.');
      onUploaded();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form className="upload-form" onSubmit={submitUpload}>
      <label className="file-picker" htmlFor="document-file">
        <span className="file-picker-icon" aria-hidden="true">+</span>
        <span className="file-picker-copy">
          <strong>{file ? file.name : 'Escolher arquivo'}</strong>
          <span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MiB` : 'Qualquer formato · até 10 MiB'}</span>
        </span>
        <input
          id="document-file"
          type="file"
          onChange={(event) => {
            setFile(event.target.files?.[0] || null);
            setMessage('');
          }}
        />
      </label>
      <div className="upload-actions">
        {message && <span className="upload-message" role="status">{message}</span>}
        <button className="button button-primary" type="submit" disabled={isUploading}>
          {isUploading ? 'Enviando...' : 'Enviar documento'}
        </button>
      </div>
    </form>
  );
}