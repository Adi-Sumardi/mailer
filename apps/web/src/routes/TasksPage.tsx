import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/apiClient';
import type { Task } from '../lib/types';

const STATUS_LABELS: Record<Task['status'], string> = {
  todo: 'Belum Dikerjakan',
  in_progress: 'Sedang Diproses',
  done: 'Selesai',
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('medium');
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
      await api.post('/tasks', { title, priority });
      setTitle('');
      setPriority('medium');
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

  return (
    <div className="page">
      <div className="page-header">
        <h1>Tugas</h1>
      </div>

      <form className="inline-form" onSubmit={handleCreate}>
        <label>
          Judul Tugas
          <input required value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          Prioritas
          <select value={priority} onChange={(e) => setPriority(e.target.value as Task['priority'])}>
            <option value="low">Rendah</option>
            <option value="medium">Sedang</option>
            <option value="high">Tinggi</option>
          </select>
        </label>
        <button type="submit" className="btn-primary">
          Tambah
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}

      <div className="task-board">
        {(Object.keys(STATUS_LABELS) as Task['status'][]).map((status) => (
          <div key={status} className="task-column">
            <h3>{STATUS_LABELS[status]}</h3>
            {tasks
              .filter((t) => t.status === status)
              .map((task) => (
                <div key={task.id} className={`task-card priority-${task.priority}`}>
                  <div className="task-title">{task.title}</div>
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
