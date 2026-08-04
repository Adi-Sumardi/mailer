import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/apiClient';
import type { CalendarEvent } from '../lib/types';

const WEEKDAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTH_LABELS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Grid 6x7 dimulai dari hari Minggu di minggu yang memuat tanggal 1, sampai cukup
// menutupi seluruh hari di bulan itu (pola kalender bulanan standar).
function buildMonthGrid(monthAnchor: Date): Date[] {
  const first = startOfMonth(monthAnchor);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());

  const days: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  return days;
}

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
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

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = toDateKey(new Date(ev.startTime));
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const monthGrid = useMemo(() => buildMonthGrid(monthAnchor), [monthAnchor]);
  const today = new Date();
  const todayKey = toDateKey(today);

  function openCreateForm(day: Date) {
    setSelectedDay(day);
    const defaultStart = new Date(day);
    defaultStart.setHours(9, 0, 0, 0);
    const defaultEnd = new Date(day);
    defaultEnd.setHours(10, 0, 0, 0);
    setStartTime(toDatetimeLocal(defaultStart));
    setEndTime(toDatetimeLocal(defaultEnd));
    setTitle('');
    setLocation('');
    setIsFormOpen(true);
  }

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

  const selectedDayEvents = selectedDay ? eventsByDay.get(toDateKey(selectedDay)) ?? [] : [];

  return (
    <div className="page calendar-page">
      <div className="page-header">
        <h1>Kalender</h1>
        <button className="btn-primary" onClick={() => openCreateForm(selectedDay ?? today)}>
          + Acara Baru
        </button>
      </div>

      <div className="calendar-toolbar">
        <button
          className="btn-ghost"
          onClick={() => setMonthAnchor((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
        >
          ‹
        </button>
        <div className="calendar-toolbar-title">
          {MONTH_LABELS[monthAnchor.getMonth()]} {monthAnchor.getFullYear()}
        </div>
        <button
          className="btn-ghost"
          onClick={() => setMonthAnchor((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
        >
          ›
        </button>
        <button className="btn-ghost" onClick={() => setMonthAnchor(startOfMonth(new Date()))}>
          Hari Ini
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="calendar-layout">
        <div className="calendar-grid">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="calendar-weekday">
              {label}
            </div>
          ))}
          {monthGrid.map((day) => {
            const key = toDateKey(day);
            const dayEvents = eventsByDay.get(key) ?? [];
            const isCurrentMonth = day.getMonth() === monthAnchor.getMonth();
            const isToday = key === todayKey;
            const isSelected = selectedDay ? key === toDateKey(selectedDay) : false;
            return (
              <button
                key={key}
                className={`calendar-day${isCurrentMonth ? '' : ' outside'}${isToday ? ' today' : ''}${
                  isSelected ? ' selected' : ''
                }`}
                onClick={() => setSelectedDay(day)}
                onDoubleClick={() => openCreateForm(day)}
              >
                <span className="calendar-day-number">{day.getDate()}</span>
                <div className="calendar-day-events">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <span key={ev.id} className="calendar-event-chip">
                      {ev.title}
                    </span>
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="calendar-event-more">+{dayEvents.length - 3} lagi</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <aside className="calendar-side-panel">
          <h3>
            {selectedDay
              ? selectedDay.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })
              : 'Pilih tanggal'}
          </h3>
          {selectedDay && selectedDayEvents.length === 0 && (
            <p className="calendar-side-empty">Tidak ada acara di tanggal ini.</p>
          )}
          {selectedDayEvents.map((ev) => (
            <div key={ev.id} className="calendar-side-event">
              <div className="event-title">{ev.title}</div>
              <div className="event-time">
                {new Date(ev.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} –{' '}
                {new Date(ev.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                {ev.location ? ` · ${ev.location}` : ''}
              </div>
              <button className="btn-ghost" onClick={() => handleDelete(ev.id)}>
                Hapus
              </button>
            </div>
          ))}
        </aside>
      </div>

      {isFormOpen && (
        <div className="modal-overlay" onClick={() => setIsFormOpen(false)}>
          <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <div className="modal-header">
              <h2>Acara Baru</h2>
              <button type="button" className="btn-ghost" onClick={() => setIsFormOpen(false)} aria-label="Tutup">
                ✕
              </button>
            </div>
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
            {error && <p className="form-error">{error}</p>}
            <div className="modal-footer">
              <button type="button" className="btn-ghost" onClick={() => setIsFormOpen(false)}>
                Batal
              </button>
              <button type="submit" className="btn-primary">
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
