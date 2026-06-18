import { useEffect, useState } from 'react';
import { ArrowLeft, FileText, Search, Upload, Loader2, Plus, BookOpen } from 'lucide-react';
import LoadingAnimation from '../components/LoadingAnimation';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { buildApiUrl } from '../constants';

interface DocumentItem {
  _id: string;
  title: string;
  content: string;
  updatedAt: string;
}

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
}

export default function Documents() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [querying, setQuerying] = useState(false);

  const headers = {
    Authorization: `Bearer ${localStorage.getItem('vitra_token')}`,
    'Content-Type': 'application/json'
  };

  useEffect(() => {
    const fetchDocs = async () => {
      setLoading(true);
      try {
        const res = await fetch(buildApiUrl('/api/productivity/documents'), { headers });
        if (res.ok) setDocs(await res.json());
      } catch (error) {
        console.error('Document load failed', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDocs();
  }, [user]);

  const createDoc = async () => {
    if (!title.trim() || !content.trim()) {
      showToast('Title and content are required.', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl('/api/productivity/documents'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ title, content })
      });
      if (!res.ok) throw new Error('Create failed');
      const created = await res.json();
      setDocs((prev) => [created, ...prev]);
      setTitle('');
      setContent('');
      showToast('Document saved.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Could not save document.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const searchDocs = async () => {
    if (!query.trim()) return;
    setQuerying(true);
    try {
      const res = await fetch(buildApiUrl(`/api/productivity/documents/search?query=${encodeURIComponent(query)}`), { headers });
      if (!res.ok) throw new Error('Search failed');
      setResults(await res.json());
    } catch (error) {
      console.error(error);
      showToast('Search failed.', 'error');
    } finally {
      setQuerying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-text p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Link to="/dashboard" className="text-text/60 hover:text-text transition"> 
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Documents & RAG</h1>
            <p className="text-text/60">Upload your knowledge, then query it with VITRA for better responses.</p>
          </div>
          <button
            onClick={searchDocs}
            disabled={!query.trim() || querying}
            className="inline-flex items-center gap-2 rounded-3xl bg-primary px-5 py-4 font-semibold text-black hover:bg-primary/90 transition disabled:opacity-50"
          >
            <Search size={18} /> Search docs
          </button>
        </div>

        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6">
          <section className="rounded-3xl border border-white/10 bg-card p-6 space-y-4">
            <h2 className="text-xl font-semibold">Upload document</h2>
            <div className="space-y-4">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-primary transition" />
              <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Paste text or notes here."
                rows={8}
                className="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-4 outline-none focus:border-primary transition resize-none"
              />
              <button onClick={createDoc} disabled={loading} className="inline-flex items-center gap-2 rounded-3xl bg-primary px-5 py-4 font-semibold text-black hover:bg-primary/90 transition disabled:opacity-50">
                <Upload size={18} /> Save Document
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-card p-6 space-y-4">
            <h2 className="text-xl font-semibold">Search documents</h2>
            <div className="flex gap-3">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search query" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-primary transition" />
              <button onClick={searchDocs} disabled={!query.trim() || querying} className="rounded-3xl bg-white/5 px-5 py-3 font-semibold hover:bg-white/10 transition">
                <Search size={18} />
              </button>
            </div>
            <p className="text-sm text-text/60">Search will match keywords inside uploaded documents and return the nearest content snippets.</p>
          </section>
        </div>

        <section className="rounded-3xl border border-white/10 bg-card p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Your documents</h2>
              <p className="text-text/60">Stored knowledge resources are available for future reference.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-3xl bg-white/5 px-4 py-3 text-xs uppercase tracking-[0.2em] text-text/60">
              <BookOpen size={16} /> {docs.length} saved
            </div>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center"><LoadingAnimation label="Loading documents..." /></div>
          ) : docs.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-text/60">No documents uploaded yet.</div>
          ) : (
            <div className="grid gap-4">
              {docs.map((doc) => (
                <div key={doc._id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold">{doc.title}</p>
                      <p className="text-sm text-text/50">Updated {new Date(doc.updatedAt).toLocaleDateString()}</p>
                    </div>
                    <FileText size={22} className="text-primary" />
                  </div>
                  <p className="mt-3 text-text/60 line-clamp-3">{doc.content}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {results.length > 0 && (
          <section className="rounded-3xl border border-white/10 bg-card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Search size={20} />
              <h2 className="text-xl font-semibold">Search results</h2>
            </div>
            {results.map((result) => (
              <div key={result.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="font-semibold">{result.title}</p>
                <p className="mt-2 text-text/60">{result.snippet}</p>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
