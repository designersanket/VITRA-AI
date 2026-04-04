import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Music, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SpotifyTrack {
  item: {
    name: string;
    artists: { name: string }[];
    album: {
      images: { url: string }[];
      name: string;
    };
    duration_ms: number;
  };
  progress_ms: number;
  is_playing: boolean;
}

export default function SpotifyPlayer() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      const token = localStorage.getItem('vitra_token');
      const res = await fetch('/api/connect/spotify/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setError(null);
      } else if (res.status === 401) {
        setError('Spotify not connected');
      } else {
        setError('Failed to fetch Spotify status');
      }
    } catch (err) {
      console.error('Spotify Status Error:', err);
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  const handleControl = async (action: string) => {
    setIsActionLoading(true);
    try {
      const token = localStorage.getItem('vitra_token');
      const res = await fetch(`/api/connect/spotify/control/${action}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.details?.includes('No active device')) {
          alert('Please open Spotify on a device first.');
        } else {
          throw new Error(data.error || 'Failed to control playback');
        }
      }
      
      // Optimistic update or just refetch
      setTimeout(fetchStatus, 500);
    } catch (err: any) {
      console.error('Spotify Control Error:', err);
    } finally {
      setIsActionLoading(false);
    }
  };

  if (loading && !status) {
    return (
      <div className="p-6 rounded-[32px] bg-white/[0.03] border border-white/5 flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !status) {
    return null; // Don't show if not connected or error
  }

  const isPlaying = status.status === 'playing';
  const track = status.data?.item;
  const artists = track?.artists.map((a: any) => a.name).join(', ');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-[32px] bg-gradient-to-br from-[#1DB954]/10 to-transparent border border-[#1DB954]/20 relative overflow-hidden group"
    >
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#1DB954] flex items-center justify-center">
              <Music size={16} className="text-black" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#1DB954]">Spotify</span>
          </div>
          {status.status === 'playing' && (
            <div className="flex gap-1">
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  animate={{ height: [4, 12, 4] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.2 }}
                  className="w-1 bg-[#1DB954] rounded-full"
                />
              ))}
            </div>
          )}
        </div>

        {track ? (
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden shadow-lg shadow-black/40 relative">
              <img 
                src={track.album.images[0]?.url} 
                alt={track.album.name} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm truncate group-hover:text-[#1DB954] transition-colors">{track.name}</h4>
              <p className="text-xs text-white/40 truncate">{artists}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 h-16">
            <div className="w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center">
              <Music size={24} className="text-white/10" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white/40">Not playing</p>
              <p className="text-[10px] text-white/20">Recently played shown in context</p>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-6">
          <button 
            onClick={() => handleControl('previous')}
            disabled={isActionLoading}
            className="p-2 text-white/40 hover:text-white transition-colors disabled:opacity-50"
          >
            <SkipBack size={20} fill="currentColor" />
          </button>
          
          <button 
            onClick={() => handleControl(isPlaying ? 'pause' : 'play')}
            disabled={isActionLoading}
            className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50"
          >
            {isPlaying ? <Pause size={24} fill="black" /> : <Play size={24} className="ml-1" fill="black" />}
          </button>

          <button 
            onClick={() => handleControl('next')}
            disabled={isActionLoading}
            className="p-2 text-white/40 hover:text-white transition-colors disabled:opacity-50"
          >
            <SkipForward size={20} fill="currentColor" />
          </button>
        </div>
      </div>

      {/* Progress Bar (Optional) */}
      {track && status.data.progress_ms && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5">
          <motion.div 
            initial={false}
            animate={{ width: `${(status.data.progress_ms / track.duration_ms) * 100}%` }}
            className="h-full bg-[#1DB954]"
          />
        </div>
      )}
    </motion.div>
  );
}
