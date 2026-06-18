import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, CheckCircle2, Loader2, Target, Clock, ListChecks, Sparkles } from 'lucide-react';
import LoadingAnimation from '../components/LoadingAnimation';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { buildApiUrl } from '../constants';

interface Milestone {
  title: string;
  completed: boolean;
  deadline?: string;
}

interface GoalItem {
  _id: string;
  title: string;
  description?: string;
  progress: number;
  completed: boolean;
  deadline?: string;
  milestones: Milestone[];
}

export default function Goals() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const headers = {
    Authorization: `Bearer ${localStorage.getItem('vitra_token')}`,
    'Content-Type': 'application/json'
  };

  useEffect(() => {
    const fetchGoals = async () => {
      setLoading(true);
      try {
        const res = await fetch(buildApiUrl('/api/productivity/goals'), { headers });
        if (res.ok) setGoals(await res.json());
      } catch (error) {
        console.error('Load goals failed', error);
      } finally {
        setLoading(false);
      }
    };
    fetchGoals();
  }, [user]);

  const addGoal = async () => {
    if (!title.trim()) {
      showToast('Goal title is required.', 'error');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(buildApiUrl('/api/productivity/goals'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ title, description, deadline: deadline || undefined })
      });
      if (!res.ok) throw new Error('Could not create goal');
      const created = await res.json();
      setGoals((prev) => [created, ...prev]);
      setTitle('');
      setDescription('');
      setDeadline('');
      showToast('Goal created.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Could not create goal.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const addMilestone = async (goalId: string) => {
    const title = prompt('Milestone title');
    if (!title) return;
    try {
      const res = await fetch(buildApiUrl(`/api/productivity/goals/${goalId}/milestones`), {
        method: 'POST',
        headers,
        body: JSON.stringify({ title })
      });
      if (!res.ok) throw new Error('Could not create milestone');
      const updated = await res.json();
      setGoals((prev) => prev.map((goal) => goal._id === updated._id ? updated : goal));
      showToast('Milestone added.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Could not add milestone.', 'error');
    }
  };

  const toggleMilestone = async (goalId: string, index: number) => {
    try {
      const res = await fetch(buildApiUrl(`/api/productivity/goals/${goalId}/milestones/${index}/toggle`), {
        method: 'PUT',
        headers
      });
      if (!res.ok) throw new Error('Could not toggle milestone');
      const updated = await res.json();
      setGoals((prev) => prev.map((goal) => goal._id === updated._id ? updated : goal));
    } catch (error) {
      console.error(error);
      showToast('Could not update milestone.', 'error');
    }
  };

  const progressColor = (progress: number) => {
    if (progress >= 80) return 'bg-emerald-500';
    if (progress >= 50) return 'bg-amber-400';
    return 'bg-primary';
  };

  return (
    <div className="min-h-screen bg-background text-text p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Link to="/dashboard" className="text-text/60 hover:text-text transition"> 
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Goal Tracker</h1>
            <p className="text-text/60">Build milestones, track progress, and let VITRA nudge you toward completion.</p>
          </div>
          <button
            onClick={addGoal}
            disabled={creating}
            className="inline-flex items-center gap-2 rounded-3xl bg-primary px-5 py-4 font-semibold text-black hover:bg-primary/90 transition disabled:opacity-50"
          >
            <Plus size={18} /> Add Goal
          </button>
        </div>

        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6">
          <section className="rounded-3xl border border-white/10 bg-card p-6 space-y-6">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-text/60">Goal Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New goal title" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-primary transition" />
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-text/60">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" rows={3} className="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-primary transition resize-none" />
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-text/60">Deadline</label>
              <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-primary transition" />
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-card p-6 space-y-4">
            <h2 className="text-lg font-semibold">Goal Essentials</h2>
            <p className="text-text/60">Use this space to capture your most important outcomes. Each goal can be broken into milestones that feed VITRA's productivity guidance.</p>
            <div className="rounded-3xl bg-white/5 p-4">
              <div className="flex items-center gap-2 text-sm text-text/70">
                <Target size={16} /> Tip: Keep goals focused and measurable.
              </div>
              <div className="flex items-center gap-2 text-sm text-text/70 mt-3">
                <Clock size={16} /> Add milestones to measure momentum.
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-card p-8 flex items-center justify-center"><LoadingAnimation label="Loading goals..." /></div>
          ) : goals.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-card p-8 text-center text-text/60">No goals yet. Create one to get started.</div>
          ) : (
            goals.map((goal) => (
              <div key={goal._id} className="rounded-3xl border border-white/10 bg-card p-6 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">{goal.title}</h2>
                    <p className="text-text/60">{goal.description || 'Set milestones to make progress visible.'}</p>
                  </div>
                  <div className="text-right text-sm text-text/60">
                    <div>{goal.progress}% complete</div>
                    {goal.deadline && <div>Deadline {new Date(goal.deadline).toLocaleDateString()}</div>}
                  </div>
                </div>
                <div className="h-3 rounded-full bg-white/5 overflow-hidden">
                  <div className={`h-full ${progressColor(goal.progress)}`} style={{ width: `${goal.progress}%` }} />
                </div>
                <div className="grid gap-3">
                  {goal.milestones.map((milestone, index) => (
                    <button
                      key={`${goal._id}-${index}`}
                      onClick={() => toggleMilestone(goal._id, index)}
                      className={`rounded-2xl border p-4 text-left transition ${milestone.completed ? 'border-emerald-400/30 bg-emerald-500/5' : 'border-white/10 hover:border-primary/30 hover:bg-white/5'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{milestone.title}</p>
                          {milestone.deadline && <p className="text-sm text-text/50">Due {new Date(milestone.deadline).toLocaleDateString()}</p>}
                        </div>
                        {milestone.completed ? <CheckCircle2 className="text-emerald-400" /> : <ListChecks className="text-text/50" />}
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => addMilestone(goal._id)}
                  className="inline-flex items-center gap-2 rounded-3xl bg-white/5 px-4 py-3 text-sm font-semibold text-text hover:bg-white/10 transition"
                >
                  <Plus size={16} /> Add milestone
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
