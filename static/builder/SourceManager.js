
export class SourceManager {
  constructor(container, data) {
    this.container = container;
    this.sources = data.sources || [];
    this.onUpdate = null; // Callback when sources change
    this.activePersonId = null; // Context for uploads
    this.render();
  }

  setContext(personId) {
    this.activePersonId = personId;
  }

  setSources(sources) {
    this.sources = sources || [];
    this.render();
  }

  getSources() {
    return this.sources;
  }

  addSource(source) {
    const newSource = {
      id: `S${Date.now()}`,
      ...source
    };
    this.sources.push(newSource);
    this.render();
    if (this.onUpdate) this.onUpdate(this.sources);
    return newSource;
  }

  updateSource(id, updates) {
    const index = this.sources.findIndex(s => s.id === id);
    if (index !== -1) {
      this.sources[index] = { ...this.sources[index], ...updates };
      this.render();
      if (this.onUpdate) this.onUpdate(this.sources);
    }
  }

  deleteSource(id) {
    this.sources = this.sources.filter(s => s.id !== id);
    this.render();
    if (this.onUpdate) this.onUpdate(this.sources);
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="source-list-header">
        <h3>Sources (${this.sources.length})</h3>
        <button type="button" class="f3-btn small" id="addSourceBtn">+ Nouveau</button>
      </div>
      <div class="source-list">
        ${this.sources.length === 0 ? '<p class="hint">Aucune source enregistrée.</p>' : ''}
        ${this.sources.map(source => `
          <div class="source-item" data-id="${source.id}">
            <div class="source-content">
              <strong>${escapeHtml(source.title || 'Sans titre')}</strong>
              <small>${escapeHtml(source.author || '')} ${source.date ? `(${source.date})` : ''}</small>
            </div>
            <div class="source-actions">
              <button type="button" class="ghost small edit-source" data-id="${source.id}">✎</button>
              <button type="button" class="ghost small delete-source" data-id="${source.id}">🗑</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    this.container.querySelector('#addSourceBtn').addEventListener('click', () => this.showEditModal());

    this.container.querySelectorAll('.edit-source').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        const source = this.sources.find(s => s.id === id);
        if (source) this.showEditModal(source);
      });
    });

    this.container.querySelectorAll('.delete-source').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        if (confirm('Supprimer cette source ?')) {
          this.deleteSource(id);
        }
      });
    });
  }

  showEditModal(source = null) {
    const isNew = !source;
    const modal = document.createElement('div');
    modal.className = 'f3-modal-overlay';
    modal.innerHTML = `
      <div class="f3-modal">
        <div class="f3-modal-header">
          <h3>${isNew ? 'Nouvelle Source' : 'Modifier la Source'}</h3>
          <button type="button" class="close-modal">×</button>
        </div>
        <div class="f3-modal-body">
          <form id="sourceForm">
            <label>Titre <span class="required">*</span></label>
            <input type="text" name="title" value="${escapeHtml(source?.title || '')}" required placeholder="Ex: Acte de naissance de..." class="f3-input">
            
            <label>Auteur</label>
            <input type="text" name="author" value="${escapeHtml(source?.author || '')}" placeholder="Ex: Mairie de..." class="f3-input">
            
            <label>Date</label>
            <input type="text" name="date" value="${escapeHtml(source?.date || '')}" placeholder="Ex: 1980-01-10" class="f3-input">
            
            <label>Dépôt / Archive</label>
            <input type="text" name="repository" value="${escapeHtml(source?.repository || '')}" placeholder="Ex: Archives Départementales..." class="f3-input">
            
            <label>URL ou Fichier</label>
            <div class="f3-form-group">
                <input type="file" name="file" id="sourceFile" class="f3-input" accept="image/*,.pdf">
                <input type="url" name="url" value="${escapeHtml(source?.url || '')}" placeholder="https://..." class="f3-input">
            </div>
            <small class="hint">Téléversez un fichier ou collez un lien.</small>
            
            <div class="f3-modal-actions">
              <button type="button" class="f3-btn ghost cancel-modal">Annuler</button>
              <button type="submit" class="f3-btn primary">Enregistrer</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.close-modal').addEventListener('click', close);
    modal.querySelector('.cancel-modal').addEventListener('click', close);

    modal.querySelector('#sourceForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const fileInput = e.target.querySelector('#sourceFile');
      let uploadedUrl = formData.get('url');

      // Handle file upload if present
      if (fileInput && fileInput.files.length > 0) {
        const uploadData = new FormData();
        uploadData.append('file', fileInput.files[0]);
        if (this.activePersonId) {
          uploadData.append('personId', this.activePersonId);
        }

        try {
          const btn = modal.querySelector('button[type="submit"]');
          const originalText = btn.textContent;
          btn.textContent = 'Téléversement...';
          btn.disabled = true;

          const response = await fetch('/api/uploads', {
            method: 'POST',
            body: uploadData
          });

          if (!response.ok) throw new Error('Erreur lors du téléversement');
          const result = await response.json();
          uploadedUrl = result.url;
        } catch (error) {
          console.error(error);
          alert('Erreur lors du téléversement du fichier.');
          const btn = modal.querySelector('button[type="submit"]');
          btn.textContent = originalText;
          btn.disabled = false;
          return;
        }
      }

      const data = Object.fromEntries(formData.entries());
      data.url = uploadedUrl; // Ensure we use the uploaded URL if applicable
      delete data.file; // Don't store the file object itself

      if (isNew) {
        this.addSource(data);
      } else {
        this.updateSource(source.id, data);
      }
      close();
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
