import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Loader2, AlertCircle, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { buildApiUrl } from '../constants';

interface CalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
}

export default function CalendarWidget() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async () => {
    try {
      const token = localStorage.getItem('vitra_token');
      const res = await fetch(buildApiUrl('/api/connect/google/calendar'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setEvents(data || []);
        setError(null);
      } else if (res.status === 401) {
        setError('Google Calendar not connected');
      } else {
        setError('Failed to fetch calendar');
      }
    } catch (err) {
      console.error('Calendar Fetch Error:', err);
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  if (loading && events.length === 0) {
    return (
      <div className="p-6 rounded-[32px] bg-white/[0.03] border border-white/5 flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || (events.length === 0 && !loading)) {
    if (error === 'Google Calendar not connected') return null;
    return (
      <div className="p-6 rounded-[32px] bg-white/[0.03] border border-white/5">
        <div className="flex items-center gap-3 text-white/40 mb-2">
          <CalendarIcon size={20} />
          <h3 className="font-bold">Schedule</h3>
        </div>
        <p className="text-xs text-white/20 italic">No upcoming events found for today.</p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-8 rounded-[40px] bg-white/[0.03] border border-white/5 relative overflow-hidden group"
    >
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <CalendarIcon size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Upcoming</h3>
              <p className="text-[10px] text-white/40 uppercase tracking-widest">Google Calendar</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Today</span>
        </div>

        <div className="space-y-4">
          {events.slice(0, 3).map((event) => {
            const startTime = event.start.dateTime ? new Date(event.start.dateTime) : new Date(event.start.date!);
            const timeStr = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            return (
              <div key={event.id} className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-primary/30 transition-all group/item cursor-default">
                <div className="flex flex-col items-center min-w-[48px]">
                  <span className="text-xs font-bold text-primary">{timeStr.split(' ')[0]}</span>
                  <span className="text-[10px] text-white/40 uppercase">{timeStr.split(' ')[1]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold truncate group-hover/item:text-primary transition-colors">{event.summary}</h4>
                  {event.location && (
                    <p className="text-[10px] text-white/40 truncate mt-0.5">{event.location}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {events.length > 3 && (
          <button className="w-full mt-6 flex items-center justify-center gap-2 text-[10px] font-bold text-white/40 hover:text-white transition-colors uppercase tracking-widest">
            View {events.length - 3} More Events
            <ChevronRight size={12} />
          </button>
        )}
      </div>

      <div className="absolute -right-8 -bottom-8 opacity-5 group-hover:opacity-10 transition-opacity">
        <CalendarIcon size={120} />
      </div>
    </motion.div>
  );
}
