import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/apiClient';
import type { Task } from '../lib/types';

const STATUS_LABELS: Record<Task['status'], string> = {
  todo: 'Belum Dikerjakan',
  in_progress: 'Sedang Diproses',
  done: 'Selesai',
};

const PRIORITY_LABELS: Record<Task['priority'], string> = {
  low: 'Rendah',
  medium: 'Sedang',
  high: 'Tinggi',
};

function isOverdue(task: Task): boolean {
  if (!task.dueDate || task.status === 'done') return false;
  return new Date(task.dueDate).getTime() < Date.now();
}

function formatDueDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function loadTasks() {
    setTasks(await api.get<Task[]>('/tasks'));
  }

  useEffect(() => {
    loadTasks().catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat tugas.'));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/tasks', {
        title,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      });
      setTitle('');
      setPriority('medium');
      setDueDate('');
      await loadTasks();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membuat tugas.');
    }
  }

  async function handleStatusChange(task: Task, status: Task['status']) {
    await api.patch(`/tasks/${task.id}`, { status });
    await loadTasks();
  }

  async function handleDelete(id: string) {
    await api.delete(`/tasks/${id}`);
    await loadTasks();
  }

  const counts = (Object.keys(STATUS_LABELS) as Task['status'][]).reduce<Record<string, number>>(
    (acc, s) => ({ ...acc, [s]: tasks.filter((t) => t.status === s).length }),
    {},
  );

  return (
    <div className="page">
      <div className="page-header">
        <h1>Tugas</h1>
      </div>

      <form className="inline-form" onSubmit={handleCreate}>
        <label>
          Judul Tugas
          <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="mis. Follow up client" />
        </label>
        <label>
          Prioritas
          <select value={priority} onChange={(e) => setPriority(e.target.value as Task['priority'])}>
            {(Object.keys(PRIORITY_LABELS) as Task['priority'][]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tenggat (opsional)
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <button type="submit" className="btn-primary">
          Tambah
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}

      <div className="task-board">
        {(Object.keys(STATUS_LABELS) as Task['status'][]).map((status) => (
          <div key={status} className="task-column">
            <h3>
              {STATUS_LABELS[status]} <span className="task-column-count">{counts[status] ?? 0}</span>
            </h3>
            {tasks.filter((t) => t.status === status).length === 0 && (
              <div className="task-column-empty">Tidak ada tugas.</div>
            )}
            {tasks
              .filter((t) => t.status === status)
              .map((task) => (
                <div key={task.id} className={`task-card priority-${task.priority}`}>
                  <div className="task-title">{task.title}</div>
                  <div className="task-card-meta">
                    <span className={`badge priority-badge-${task.priority}`}>{PRIORITY_LABELS[task.priority]}</span>
                    {task.dueDate && (
                      <span className={`badge${isOverdue(task) ? ' badge-error' : ' badge-pending'}`}>
                        {isOverdue(task) ? '⚠ ' : '📅 '}
                        {formatDueDate(task.dueDate)}
                      </span>
                    )}
                  </div>
                  <div className="task-card-actions">
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(task, e.target.value as Task['status'])}
                    >
                      {(Object.keys(STATUS_LABELS) as Task['status'][]).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                    <button className="btn-ghost" onClick={() => handleDelete(task.id)}>
                      Hapus
                    </button>
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
