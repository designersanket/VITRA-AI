import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Save, Trash2, Loader2 } from 'lucide-react';
import LoadingAnimation from '../components/LoadingAnimation';
import SimpleLoader from '../components/SimpleLoader';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { buildApiUrl } from '../constants';

interface JournalEntry {
  _id: string;
  title: string;
  content: string;
  updatedAt: string;
}

export default function Journal() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const headers = {
    Authorization: `Bearer ${localStorage.getItem('vitra_token')}`,
    'Content-Type': 'application/json'
  };

  useEffect(() => {
    const fetchEntries = async () => {
      setLoading(true);
      try {
        const res = await fetch(buildApiUrl('/api/productivity/journals'), { headers });
        if (res.ok) {
          setEntries(await res.json());
        }
      } catch (error) {
        console.error('Journal load failed', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEntries();
  }, [user]);

  const openEntry = (entry: JournalEntry) => {
    setSelectedEntry(entry);
    setTitle(entry.title);
    setContent(entry.content);
  };

  const resetForm = () => {
    setSelectedEntry(null);
    setTitle('');
    setContent('');
  };

  const saveEntry = async () => {
    if (!title.trim() || !content.trim()) {
      showToast('Title and content are required.', 'error');
      return;
    }
    setSaving(true);
    try {
      const method = selectedEntry ? 'PUT' : 'POST';
      const path = selectedEntry ? `/api/productivity/journals/${selectedEntry._id}` : '/api/productivity/journals';
      const res = await fetch(buildApiUrl(path), {
        method,
        headers,
        body: JSON.stringify({ title, content })
      });
      if (!res.ok) throw new Error('Failed to save entry');
      const updated = await res.json();
      setEntries((prev) => {
        if (selectedEntry) {
          return prev.map((entry) => entry._id === updated._id ? updated : entry);
        }
        return [updated, ...prev];
      });
      resetForm();
      showToast('Journal saved.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Could not save journal entry.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async () => {
    if (!selectedEntry) return;
    try {
      const res = await fetch(buildApiUrl(`/api/productivity/journals/${selectedEntry._id}`), {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error('Delete failed');
      setEntries((prev) => prev.filter((entry) => entry._id !== selectedEntry._id));
      resetForm();
      showToast('Journal deleted.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Delete failed.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-background text-text p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between gap-4">
          <Link to="/dashboard" className="text-text/60 hover:text-text transition"> 
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Journal & Reflection</h1>
            <p className="text-text/60">Capture reflections, add AI-powered insights, and see your progress over time.</p>
          </div>
          <button
            onClick={resetForm}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 hover:bg-white/5 transition"
          >
            <Plus size={16} /> New Entry
          </button>
        </div>

        <div className="grid lg:grid-cols-[360px_1fr] gap-6">
          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-card p-5">
              <h2 className="text-lg font-semibold mb-4">Your reflections</h2>
              {loading ? (
                <div className="flex items-center justify-center py-16"><LoadingAnimation label="Loading journal entries..." /></div>
              ) : entries.length === 0 ? (
                <p className="text-text/60">No entries yet. Start by writing something meaningful.</p>
              ) : (
                <div className="space-y-3">
                  {entries.map((entry) => (
                    <button
                      key={entry._id}
                      onClick={() => openEntry(entry)}
                      className="w-full text-left rounded-3xl border border-white/10 p-4 hover:border-primary/30 hover:bg-white/5 transition"
                    >
                      <p className="font-semibold">{entry.title}</p>
                      <p className="text-sm text-text/50 mt-1">Updated {new Date(entry.updatedAt).toLocaleDateString()}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-card p-6 space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{selectedEntry ? 'Edit entry' : 'New journal entry'}</h2>
                <p className="text-text/50">Use your journal to help VITRA learn how you think and feel.</p>
              </div>
              {selectedEntry && (
                <button
                  onClick={deleteEntry}
                  className="inline-flex items-center gap-2 rounded-full border border-red-500/20 px-4 py-2 text-red-400 hover:bg-red-500/10 transition"
                >
                  <Trash2 size={16} /> Delete
                </button>
              )}
            </div>

            <div className="grid gap-4">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-primary transition"
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                placeholder="Write your reflections, lessons learned, or how your day felt."
                className="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-4 outline-none focus:border-primary transition resize-none"
              />
            </div>

            <button
              onClick={saveEntry}
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 rounded-3xl bg-primary px-5 py-4 font-semibold text-black hover:bg-primary/90 transition disabled:opacity-50"
            >
              {saving ? <SimpleLoader /> : <Save size={18} />} {selectedEntry ? 'Update entry' : 'Save entry'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
