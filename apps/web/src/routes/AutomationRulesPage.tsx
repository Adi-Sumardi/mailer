import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/apiClient';
import type { AutomationRule } from '../lib/types';

const CONDITION_FIELD_LABEL: Record<AutomationRule['conditionField'], string> = {
  sender: 'Pengirim',
  subject: 'Subjek',
  body: 'Isi',
};

const ACTION_LABEL: Record<AutomationRule['actionType'], string> = {
  move_folder: 'Pindah ke Folder',
  forward: 'Forward ke',
  auto_reply: 'Auto-Reply',
  delete: 'Hapus',
  ai_agent: '🤖 AI Agent',
};

const MODEL_PRESETS: Record<'openai' | 'anthropic', string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o3-mini'],
  anthropic: ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5', 'claude-fable-5'],
};

export default function AutomationRulesPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [name, setName] = useState('');
  const [conditionField, setConditionField] = useState<AutomationRule['conditionField']>('sender');
  const [conditionValue, setConditionValue] = useState('');
  const [actionType, setActionType] = useState<AutomationRule['actionType']>('move_folder');
  const [actionValue, setActionValue] = useState('');
  const [aiProvider, setAiProvider] = useState<'openai' | 'anthropic'>('anthropic');
  const [aiModel, setAiModel] = useState(MODEL_PRESETS.anthropic[1]);
  const [aiApiKey, setAiApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  async function loadRules() {
    setRules(await api.get<AutomationRule[]>('/automation-rules'));
  }

  useEffect(() => {
    loadRules().catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat aturan.'));
  }, []);

  function handleProviderChange(provider: 'openai' | 'anthropic') {
    setAiProvider(provider);
    setAiModel(MODEL_PRESETS[provider][0]);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/automation-rules', {
        name,
        conditionField,
        conditionValue,
        actionType,
        actionValue: actionType === 'delete' || actionType === 'ai_agent' ? undefined : actionValue,
        aiProvider: actionType === 'ai_agent' ? aiProvider : undefined,
        aiModel: actionType === 'ai_agent' ? aiModel : undefined,
        aiApiKey: actionType === 'ai_agent' ? aiApiKey : undefined,
      });
      setName('');
      setConditionValue('');
      setActionValue('');
      setAiApiKey('');
      setIsFormOpen(false);
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
        <h1>Automation</h1>
        <button className="btn-primary" onClick={() => setIsFormOpen((v) => !v)}>
          {isFormOpen ? 'Tutup' : '+ Aturan Baru'}
        </button>
      </div>
      <p className="auth-subtitle" style={{ margin: 0 }}>
        Otomatiskan penanganan email masuk — mirip Gmail Filters / Outlook Rules. Setiap aturan punya
        <strong> trigger</strong> (kondisi email masuk) dan <strong>aksi</strong> yang dijalankan, termasuk
        opsi menyerahkan keputusan ke <strong>AI Agent</strong>.
      </p>

      {isFormOpen && (
        <form className="inline-form automation-form" onSubmit={handleCreate}>
          <label>
            Nama Aturan
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Triase Vendor" />
          </label>
          <label>
            Jika
            <select
              value={conditionField}
              onChange={(e) => setConditionField(e.target.value as AutomationRule['conditionField'])}
            >
              {(Object.keys(CONDITION_FIELD_LABEL) as AutomationRule['conditionField'][]).map((f) => (
                <option key={f} value={f}>
                  {CONDITION_FIELD_LABEL[f]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mengandung
            <input required value={conditionValue} onChange={(e) => setConditionValue(e.target.value)} />
          </label>
          <label>
            Maka
            <select value={actionType} onChange={(e) => setActionType(e.target.value as AutomationRule['actionType'])}>
              {(Object.keys(ACTION_LABEL) as AutomationRule['actionType'][]).map((a) => (
                <option key={a} value={a}>
                  {ACTION_LABEL[a]}
                </option>
              ))}
            </select>
          </label>
          {actionType !== 'delete' && actionType !== 'ai_agent' && (
            <label>
              {actionType === 'move_folder' ? 'Nama Folder' : actionType === 'forward' ? 'Alamat Tujuan' : 'Isi Balasan'}
              <input required value={actionValue} onChange={(e) => setActionValue(e.target.value)} />
            </label>
          )}
          {actionType === 'ai_agent' && (
            <div className="ai-agent-config">
              <label>
                Provider
                <select
                  value={aiProvider}
                  onChange={(e) => handleProviderChange(e.target.value as 'openai' | 'anthropic')}
                >
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="openai">OpenAI (GPT)</option>
                </select>
              </label>
              <label>
                Model
                <select value={aiModel} onChange={(e) => setAiModel(e.target.value)}>
                  {MODEL_PRESETS[aiProvider].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                API Key
                <input
                  type="password"
                  required
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  placeholder={aiProvider === 'openai' ? 'sk-...' : 'sk-ant-...'}
                  autoComplete="off"
                />
              </label>
              <p className="ai-agent-note">
                🔒 API key dienkripsi sebelum disimpan dan tidak pernah ditampilkan mentah lagi setelah dibuat.
                Eksekusi AI agent masih dalam pengembangan — aturan ini tersimpan sebagai konfigurasi, belum
                otomatis memanggil model saat email masuk.
              </p>
            </div>
          )}
          <button type="submit" className="btn-primary">
            Simpan Aturan
          </button>
        </form>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="automation-list">
        {rules.length === 0 && <p className="email-list-empty">Belum ada aturan automation.</p>}
        {rules.map((rule) => (
          <div key={rule.id} className={`automation-flow-card${rule.isActive ? '' : ' inactive'}`}>
            <div className="automation-flow-header">
              <strong>{rule.name}</strong>
              <div className="task-card-actions">
                <button className="btn-ghost" onClick={() => handleToggle(rule)}>
                  {rule.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
                <button className="btn-ghost" onClick={() => handleDelete(rule.id)}>
                  Hapus
                </button>
              </div>
            </div>

            <div className="automation-flow">
              <div className="automation-flow-node trigger">
                <span className="automation-flow-node-label">TRIGGER</span>
                <div className="automation-flow-node-body">
                  {CONDITION_FIELD_LABEL[rule.conditionField]} {rule.conditionOperator}{' '}
                  <code>"{rule.conditionValue}"</code>
                </div>
              </div>

              <div className="automation-flow-arrow">→</div>

              {rule.actionType === 'ai_agent' ? (
                <div className="automation-flow-node ai">
                  <span className="automation-flow-node-label">AI AGENT</span>
                  <div className="automation-flow-node-body">
                    <div>
                      {rule.aiProvider === 'openai' ? 'OpenAI' : 'Anthropic'} · {rule.aiModel}
                    </div>
                    <code>{rule.aiApiKeyMasked}</code>
                  </div>
                </div>
              ) : (
                <div className="automation-flow-node action">
                  <span className="automation-flow-node-label">AKSI</span>
                  <div className="automation-flow-node-body">
                    {ACTION_LABEL[rule.actionType]}
                    {rule.actionValue ? <> · <code>{rule.actionValue}</code></> : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
