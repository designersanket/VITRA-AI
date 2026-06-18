import { useEffect, useState } from 'react';
import { ArrowLeft, Clock, Sparkles, CalendarDays, BarChart3, Mail } from 'lucide-react';
import LoadingAnimation from '../components/LoadingAnimation';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { buildApiUrl } from '../constants';

interface Snapshot {
  _id: string;
  corePersonality: string;
  learnedTraits: Record<string, any>;
  timestamp: string;
}

export default function Timeline() {
  const { user } = useAuth();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSnapshots = async () => {
      setLoading(true);
      try {
        const res = await fetch(buildApiUrl('/api/productivity/snapshots'), {
          headers: { Authorization: `Bearer ${localStorage.getItem('vitra_token')}` }
        });
        if (!res.ok) throw new Error('Failed to load timeline');
        setSnapshots(await res.json());
      } catch (err: any) {
        setError(err.message || 'Timeline failed to load');
      } finally {
        setLoading(false);
      }
    };
    fetchSnapshots();
  }, [user]);

  return (
    <div className="min-h-screen bg-background text-text p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Link to="/dashboard" className="text-text/60 hover:text-text transition"> 
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Twin Evolution Timeline</h1>
            <p className="text-text/60">Review the snapshots of how your AI twin has changed over time and see its latest learning milestones.</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-3xl bg-primary px-5 py-4 font-semibold text-black hover:bg-primary/90 transition"
          >
            <Clock size={18} /> Refresh
          </button>
        </div>

        <div className="grid gap-6">
          <div className="rounded-3xl border border-white/10 bg-card p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Sparkles className="text-secondary" />
              <div>
                <p className="text-sm text-text/60">Insight</p>
                <p className="text-lg font-semibold">Your twin grows smarter each time you refine its identity.</p>
              </div>
            </div>
            <Link to="/setup" className="inline-flex items-center gap-2 rounded-3xl bg-white/5 px-5 py-4 text-sm font-semibold text-text hover:bg-white/10 transition">
              <Mail size={16} /> Share this twin
            </Link>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-card p-12 flex items-center justify-center"><LoadingAnimation label="Loading timeline..." width={140} height={140} /></div>
          ) : error ? (
            <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-red-200">{error}</div>
          ) : snapshots.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-card p-12 text-center text-text/60">
              No evolution snapshots yet. Save your twin profile or update its traits to create the first timeline entry.
            </div>
          ) : (
            snapshots.map((snapshot, index) => (
              <div key={snapshot._id} className="rounded-3xl border border-white/10 bg-card p-6 space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-text/60">Snapshot {index + 1}</p>
                    <h2 className="text-xl font-semibold">{snapshot.corePersonality || 'Behavior update'}</h2>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-2xl bg-white/5 px-4 py-2 text-sm text-text/60">
                    <CalendarDays size={16} /> {new Date(snapshot.timestamp).toLocaleDateString()}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(snapshot.learnedTraits || {}).map(([key, value]) => (
                    <div key={key} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm text-text/60 uppercase tracking-[0.2em]">{key}</p>
                      <p className="mt-2 text-sm text-text">{Array.isArray(value) ? value.join(', ') : String(value || 'None')}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
