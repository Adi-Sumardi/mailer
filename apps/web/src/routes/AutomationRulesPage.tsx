import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/apiClient';
import type { AutomationRule } from '../lib/types';

export default function AutomationRulesPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [name, setName] = useState('');
  const [conditionField, setConditionField] = useState<AutomationRule['conditionField']>('sender');
  const [conditionValue, setConditionValue] = useState('');
  const [actionType, setActionType] = useState<AutomationRule['actionType']>('move_folder');
  const [actionValue, setActionValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function loadRules() {
    setRules(await api.get<AutomationRule[]>('/automation-rules'));
  }

  useEffect(() => {
    loadRules().catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat aturan.'));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/automation-rules', {
        name,
        conditionField,
        conditionValue,
        actionType,
        actionValue: actionType === 'delete' ? undefined : actionValue,
      });
      setName('');
      setConditionValue('');
      setActionValue('');
      await loadRules();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membuat aturan.');
    }
  }

  async function handleToggle(rule: AutomationRule) {
    await api.patch(`/automation-rules/${rule.id}`, { isActive: !rule.isActive });
    await loadRules();
  }

  async function handleDelete(id: string) {
    await api.delete(`/automation-rules/${id}`);
    await loadRules();
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Automation Rules</h1>
      </div>

      <form className="inline-form" onSubmit={handleCreate}>
        <label>
          Nama Aturan
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Jika
          <select
            value={conditionField}
            onChange={(e) => setConditionField(e.target.value as AutomationRule['conditionField'])}
          >
            <option value="sender">Pengirim</option>
            <option value="subject">Subjek</option>
            <option value="body">Isi</option>
          </select>
        </label>
        <label>
          Mengandung
          <input required value={conditionValue} onChange={(e) => setConditionValue(e.target.value)} />
        </label>
        <label>
          Maka
          <select value={actionType} onChange={(e) => setActionType(e.target.value as AutomationRule['actionType'])}>
            <option value="move_folder">Pindah ke Folder</option>
            <option value="forward">Forward ke</option>
            <option value="auto_reply">Auto-Reply</option>
            <option value="delete">Hapus</option>
          </select>
        </label>
        {actionType !== 'delete' && (
          <label>
            {actionType === 'move_folder' ? 'Nama Folder' : actionType === 'forward' ? 'Alamat Tujuan' : 'Isi Balasan'}
            <input required value={actionValue} onChange={(e) => setActionValue(e.target.value)} />
          </label>
        )}
        <button type="submit" className="btn-primary">
          Simpan Aturan
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}

      <ul className="event-list">
        {rules.length === 0 && <li className="email-list-empty">Belum ada aturan.</li>}
        {rules.map((rule) => (
          <li key={rule.id} className="event-list-item">
            <div>
              <div className="event-title">{rule.name}</div>
              <div className="event-time">
                Jika {rule.conditionField} {rule.conditionOperator} "{rule.conditionValue}" → {rule.actionType}
                {rule.actionValue ? ` (${rule.actionValue})` : ''}
              </div>
            </div>
            <div className="task-card-actions">
              <button className="btn-ghost" onClick={() => handleToggle(rule)}>
                {rule.isActive ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
              <button className="btn-ghost" onClick={() => handleDelete(rule.id)}>
                Hapus
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
