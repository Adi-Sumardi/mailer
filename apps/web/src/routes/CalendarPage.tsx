import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/apiClient';
import type { CalendarEvent } from '../lib/types';

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function loadEvents() {
    const list = await api.get<CalendarEvent[]>('/calendar-events');
    setEvents(list.sort((a, b) => a.startTime.localeCompare(b.startTime)));
  }

  useEffect(() => {
    loadEvents().catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat kalender.'));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/calendar-events', {
        title,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        location: location || undefined,
      });
      setTitle('');
      setStartTime('');
      setEndTime('');
      setLocation('');
      setIsFormOpen(false);
      await loadEvents();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membuat acara.');
    }
  }

  async function handleDelete(id: string) {
    await api.delete(`/calendar-events/${id}`);
    await loadEvents();
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Kalender</h1>
        <button className="btn-primary" onClick={() => setIsFormOpen((v) => !v)}>
          {isFormOpen ? 'Tutup' : '+ Acara Baru'}
        </button>
      </div>

      {isFormOpen && (
        <form className="inline-form" onSubmit={handleSubmit}>
          <label>
            Judul
            <input required value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Mulai
            <input
              type="datetime-local"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </label>
          <label>
            Selesai
            <input
              type="datetime-local"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </label>
          <label>
            Lokasi (opsional)
            <input value={location} onChange={(e) => setLocation(e.target.value)} />
          </label>
          <button type="submit" className="btn-primary">
            Simpan
          </button>
        </form>
      )}

      {error && <p className="form-error">{error}</p>}

      <ul className="event-list">
        {events.length === 0 && <li className="email-list-empty">Belum ada acara.</li>}
        {events.map((event) => (
          <li key={event.id} className="event-list-item">
            <div>
              <div className="event-title">{event.title}</div>
              <div className="event-time">
                {new Date(event.startTime).toLocaleString('id-ID')} —{' '}
                {new Date(event.endTime).toLocaleString('id-ID')}
                {event.location ? ` · ${event.location}` : ''}
              </div>
            </div>
            <button className="btn-ghost" onClick={() => handleDelete(event.id)}>
              Hapus
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
