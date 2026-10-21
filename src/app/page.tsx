'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChampionshipEvent, Participant } from '@/types';
import { getEventTimerInfo } from '@/lib/utils/timer';
import { 
  Trophy, 
  Flame, 
  Timer, 
  Target, 
  Repeat, 
  ArrowRight, 
  Keyboard, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  Crown
} from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const [event, setEvent] = useState<ChampionshipEvent | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [timerDisplay, setTimerDisplay] = useState<string>('');
  const [serverOffsetMs, setServerOffsetMs] = useState(0);

  // Form State
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState<string | null>(null);

  // Fetch Event Info
  const fetchEvent = async () => {
    try {
      const res = await fetch('/api/event');
      const data = await res.json();
      if (data.success && data.event) {
        setEvent(data.event);
        if (data.serverTime) {
          const serverMs = new Date(data.serverTime).getTime();
          setServerOffsetMs(serverMs - Date.now());
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchEvent();
    const interval = setInterval(fetchEvent, 10000);
    return () => clearInterval(interval);
  }, []);

  // Check LocalStorage Participant
  useEffect(() => {
    try {
      const stored = localStorage.getItem('tensor_mactober_participant');
      if (stored) {
        setParticipant(JSON.parse(stored));
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Live Timer Countdown
  useEffect(() => {
    if (!event) return;

    const tick = () => {
      const info = getEventTimerInfo(
        event.status,
        event.start_time,
        event.end_time,
        event.test_duration,
        serverOffsetMs
      );

      if (event.status === 'LIVE') {
        setTimerDisplay(`${info.formattedRemaining} remaining`);
      } else if (event.status === 'NOT_STARTED') {
        setTimerDisplay('Waiting for host to start');
      } else {
        setTimerDisplay('Competition has concluded');
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [event, serverOffsetMs]);

  // Handle Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !studentId.trim()) {
      setRegistrationError('Please enter both your Full Name and Student ID.');
      return;
    }

    setSubmitting(true);
    setRegistrationError(null);

    try {
      // Generate or retrieve session ID
      let sessionId = localStorage.getItem('tensor_mactober_session_id');
      if (!sessionId) {
        sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem('tensor_mactober_session_id', sessionId);
      }

      const res = await fetch('/api/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event?.id,
          name: fullName.trim(),
          studentId: studentId.trim(),
          email: email.trim() || null,
          sessionId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Registration failed');
      }

      // Save participant to localStorage
      localStorage.setItem('tensor_mactober_participant', JSON.stringify(data.participant));
      setParticipant(data.participant);
      setRegistrationSuccess(`You're in, ${data.participant.name}!`);

      // Redirect to contest page after brief confirmation
      setTimeout(() => {
        router.push('/contest');
      }, 1200);
    } catch (err: any) {
      setRegistrationError(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-between overflow-hidden">
      {/* Subtle Background Keyboard & Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gradient-to-tr from-orange-600/15 via-amber-500/10 to-transparent blur-[120px] pointer-events-none rounded-full" />
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20 w-full relative z-10">
        
        {/* Top Announcement Pill */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center space-x-2.5 px-4 py-1.5 rounded-full glass-panel border border-white/10 shadow-lg text-xs font-mono text-zinc-300">
            <span className="flex h-2 w-2 relative">
              {event?.status === 'LIVE' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  event?.status === 'LIVE'
                    ? 'bg-emerald-400'
                    : event?.status === 'ENDED'
                    ? 'bg-red-400'
                    : 'bg-zinc-400'
                }`}
              />
            </span>
            <span className="font-semibold text-white">
              {event?.status === 'LIVE' ? 'EVENT IS LIVE' : event?.status === 'ENDED' ? 'EVENT ENDED' : 'EVENT NOT STARTED'}
            </span>
            <span className="text-zinc-500">•</span>
            <span className="text-zinc-300">{timerDisplay}</span>
          </div>
        </div>

        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto mb-14">
          <div className="inline-block mb-3">
            <span className="text-sm font-mono uppercase tracking-[0.3em] text-orange-400 font-bold">
              {event?.organization_name || 'TENSOR'} Championship '26
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.08]">
            <span className="block font-black tracking-tight">{event?.name || "Tensor MacTober Touch Type Championship '26"}</span>
          </h1>

          <p className="text-xl sm:text-2xl text-zinc-300 font-normal max-w-2xl mx-auto mb-8 leading-relaxed">
            {event?.subtitle || `${event?.test_duration || 60} seconds. ${event?.event_duration ? `${event.event_duration} minutes` : 'One hour'}. Type your way to the top.`}
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {participant ? (
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  onClick={() => router.push('/contest')}
                  className="w-full sm:w-auto px-8 py-4 rounded-xl font-semibold text-black bg-gradient-to-r from-orange-500 via-amber-400 to-orange-400 hover:from-orange-400 hover:to-amber-300 transition-all duration-200 shadow-glow-orange flex items-center justify-center space-x-2 text-base group"
                >
                  <span>Enter Contest Arena</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <div className="text-xs text-zinc-400 font-mono">
                  Registered as: <span className="text-white font-bold">{participant.name}</span> ({participant.student_id})
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsRegisterModalOpen(true)}
                className="w-full sm:w-auto px-9 py-4 rounded-xl font-bold text-black bg-gradient-to-r from-orange-500 via-amber-400 to-orange-400 hover:from-orange-400 hover:to-amber-300 transition-all duration-200 shadow-glow-orange flex items-center justify-center space-x-2 text-lg group"
              >
                <span>JOIN THE CHAMPIONSHIP</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            )}

            <Link
              href="/leaderboard"
              className="w-full sm:w-auto px-6 py-4 rounded-xl font-medium text-zinc-300 hover:text-white glass-panel hover:bg-white/10 transition-colors duration-200 flex items-center justify-center space-x-2 border border-white/10 text-base"
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Live Leaderboard</span>
            </Link>
          </div>
        </div>

        {/* 4 Feature Cards (Apple Minimalist Aesthetic - Dynamic Configuration) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-5xl mx-auto mb-16">
          <div className="p-6 rounded-2xl glass-panel border border-white/10 hover:border-white/20 transition-all">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-4 text-orange-400">
              <Timer className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">{event?.test_duration || 60} Seconds</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Fast, high-adrenaline typing rounds. Every millisecond and keystroke matters.
            </p>
          </div>

          <div className="p-6 rounded-2xl glass-panel border border-white/10 hover:border-white/20 transition-all">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 text-emerald-400">
              <Target className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">{event?.minimum_accuracy || 85}% Accuracy</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Official qualification threshold. Submissions below {event?.minimum_accuracy || 85}% do not enter the leaderboard.
            </p>
          </div>

          <div className="p-6 rounded-2xl glass-panel border border-white/10 hover:border-white/20 transition-all">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4 text-blue-400">
              <Repeat className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">
              {event?.max_attempts ? `${event.max_attempts} Attempts Max` : 'Unlimited Tries'}
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {event?.max_attempts
                ? `Participants are allocated ${event.max_attempts} official attempts during the event.`
                : `Take unlimited attempts during the ${event?.event_duration || 60}-minute event window.`}{' '}
              Only your best qualifying WPM counts.
            </p>
          </div>

          <div className="p-6 rounded-2xl glass-panel border border-amber-500/30 bg-amber-950/10 hover:border-amber-500/50 transition-all relative overflow-hidden">
            <div className="absolute top-2 right-2 text-amber-500/20">
              <Crown className="w-16 h-16 -mr-4 -mt-4 rotate-12" />
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400 relative z-10">
              <Trophy className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1 relative z-10">Grand Final</h3>
            <p className="text-xs text-zinc-400 leading-relaxed relative z-10">
              <strong className="text-amber-300">Top {event?.finalists_count || 2} advance</strong> to the high-stakes head-to-head Grand Final round.
            </p>
          </div>
        </div>

        {/* Mac Keycap Decorative Showcase */}
        <div className="max-w-2xl mx-auto text-center p-6 rounded-2xl glass-panel border border-white/5">
          <div className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-4">
            Mechanical Precision Architecture
          </div>
          <div className="inline-flex items-center space-x-2">
            <div className="mac-keycap px-4 py-2.5 rounded-lg font-mono text-sm font-semibold text-zinc-200">
              ⌘ Command
            </div>
            <span className="text-zinc-600">+</span>
            <div className="mac-keycap px-4 py-2.5 rounded-lg font-mono text-sm font-semibold text-zinc-200">
              ⌥ Option
            </div>
            <span className="text-zinc-600">+</span>
            <div className="mac-keycap px-5 py-2.5 rounded-lg font-mono text-sm font-bold text-orange-400 border-orange-500/30">
              TYPE TO WIN
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-4">
            All 180 competitors receive identical passages with anti-paste tamper prevention and server-authoritative scoring.
          </p>
        </div>
      </div>

      {/* Registration Modal (Requirement 4) */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md rounded-2xl p-7 glass-panel-glow border border-orange-500/30 shadow-apple-card relative">
            <button
              onClick={() => setIsRegisterModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1"
            >
              ✕
            </button>

            <div className="flex items-center space-x-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
                <Keyboard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Join the Championship</h3>
                <p className="text-xs text-zinc-400">Enter your details to register for your seat</p>
              </div>
            </div>

            {registrationSuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-xl font-bold text-white">{registrationSuccess}</h4>
                <p className="text-xs text-zinc-400">Redirecting to contest arena...</p>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                {registrationError && (
                  <div className="p-3 rounded-lg bg-red-950/50 border border-red-500/30 text-red-300 text-xs flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{registrationError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Full Name <span className="text-orange-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Arya Sovakar"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Student ID <span className="text-orange-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MAC-101"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white placeholder-zinc-500 text-sm font-mono uppercase focus:outline-none focus:border-orange-500 transition-colors"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">Used to uniquely track your leaderboard score.</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Email Address <span className="text-zinc-500">(Optional)</span>
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. student@university.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 rounded-xl font-bold text-black bg-gradient-to-r from-orange-500 via-amber-400 to-orange-400 hover:from-orange-400 hover:to-amber-300 transition-all duration-150 shadow-glow-orange text-sm flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    <span>{submitting ? 'Registering...' : 'JOIN THE CHAMPIONSHIP'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <p className="text-[11px] text-center text-zinc-500 mt-2.5">
                    No password required. Your session is automatically saved to this device.
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
