function createDocumentRepository() {
  const documents = new Map();

  return {
    save(document) {
      documents.set(document.id, { ...document });
      return { ...document };
    },

    listByOwner(owner) {
      return [...documents.values()]
        .filter((document) => document.owner === owner)
        .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt))
        .map((document) => ({ ...document }));
    },

    findByIdAndOwner(id, owner) {
      const document = documents.get(id);
      return document?.owner === owner ? { ...document } : null;
    },
  };
}

module.exports = { createDocumentRepository };