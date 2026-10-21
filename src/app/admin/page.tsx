'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  AdminStats, 
  Participant, 
  LeaderboardEntry, 
  ChampionshipEvent 
} from '@/types';
import StatusPanel from '@/components/admin/StatusPanel';
import AttemptHistoryModal from '@/components/admin/AttemptHistoryModal';
import DisqualifyModal from '@/components/admin/DisqualifyModal';
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw, 
  Download, 
  Search, 
  Sparkles, 
  Sliders, 
  Save, 
  LogOut, 
  ShieldAlert, 
  History, 
  CheckCircle2, 
  XCircle,
  FileSpreadsheet
} from 'lucide-react';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);

  // Passage & Settings Editing
  const [eventName, setEventName] = useState("Tensor MacTober Touch Type Championship '26");
  const [eventSubtitle, setEventSubtitle] = useState('60 seconds. One hour. Type your way to the top.');
  const [organizationName, setOrganizationName] = useState('TENSOR');
  const [passageText, setPassageText] = useState('');
  const [eventDurationMin, setEventDurationMin] = useState(60);
  const [testDurationSec, setTestDurationSec] = useState(60);
  const [testDurationPreset, setTestDurationPreset] = useState<string>('60');
  const [minAccuracy, setMinAccuracy] = useState(85.0);
  const [maxAttemptsMode, setMaxAttemptsMode] = useState<'unlimited' | 'limited'>('unlimited');
const [finalistsCount, setFinalistsCount] = useState<number>(2);
  const [maxAttemptsCount, setMaxAttemptsCount] = useState<number>(5);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Modals
  const [selectedParticipantForHistory, setSelectedParticipantForHistory] = useState<Participant | null>(null);
  const [selectedParticipantForDisqualify, setSelectedParticipantForDisqualify] = useState<Participant | null>(null);

  // Verify Auth
  const checkAuth = async () => {
    try {
      const res = await fetch('/api/admin/auth');
      const data = await res.json();
      if (!data.authenticated) {
        router.push('/admin/login');
        return false;
      }
      return true;
    } catch {
      router.push('/admin/login');
      return false;
    }
  };

  // Fetch Stats & Participants
  const loadAdminData = async () => {
    try {
      const [statsRes, partsRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/participants'),
      ]);

      if (statsRes.status === 401 || partsRes.status === 401) {
        router.push('/admin/login');
        return;
      }

      const statsData = await statsRes.json();
      const partsData = await partsRes.json();

      if (statsData.success && statsData.stats) {
        setStats(statsData.stats);
        setEventName(statsData.stats.event.name || "Tensor MacTober Touch Type Championship '26");
        setEventSubtitle(statsData.stats.event.subtitle || '60 seconds. One hour. Type your way to the top.');
        setOrganizationName(statsData.stats.event.organization_name || 'TENSOR');
        setPassageText(statsData.stats.event.passage);
        setEventDurationMin(statsData.stats.event.event_duration || 60);

        const currentTestDur = statsData.stats.event.test_duration || 60;
        setTestDurationSec(currentTestDur);
        if ([15, 30, 45, 60, 90, 120].includes(currentTestDur)) {
          setTestDurationPreset(currentTestDur.toString());
        } else {
          setTestDurationPreset('custom');
        }

        setMinAccuracy(statsData.stats.event.minimum_accuracy || 85.0);
setFinalistsCount(statsData.stats.event.finalists_count || 2);

        if (statsData.stats.event.max_attempts) {
          setMaxAttemptsMode('limited');
          setMaxAttemptsCount(statsData.stats.event.max_attempts);
        } else {
          setMaxAttemptsMode('unlimited');
        }

        if (statsData.stats.currentServerTime) {
          const sTime = new Date(statsData.stats.currentServerTime).getTime();
          setServerOffsetMs(sTime - Date.now());
        }
      }

      if (partsData.success && partsData.participants) {
        setParticipants(partsData.participants);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth().then((authed) => {
      if (authed) {
        loadAdminData();
      }
    });

    const interval = setInterval(loadAdminData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Event Control Handlers
  const handleEventAction = async (action: 'start' | 'pause' | 'end' | 'reset') => {
    if (action === 'reset') {
      const confirmed = window.confirm(
        'Are you sure you want to RESET the event? This will clear all recorded attempts.'
      );
      if (!confirmed) return;
    }

    try {
      const res = await fetch('/api/event', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          updates: {
            durationMinutes: eventDurationMin,
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        loadAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMessage(null);
    setSettingsError(null);

    // Client Validation
    const effectiveTestSecs = testDurationPreset === 'custom' ? Number(testDurationSec) : Number(testDurationPreset);
    if (!eventName.trim()) {
      setSettingsError('Event Name cannot be empty.');
      setSavingSettings(false);
      return;
    }
    if (eventDurationMin < 1 || eventDurationMin > 1440) {
      setSettingsError('Event duration must be between 1 and 1440 minutes.');
      setSavingSettings(false);
      return;
    }
    if (effectiveTestSecs < 5 || effectiveTestSecs > 300) {
      setSettingsError('Attempt duration must be between 5 and 300 seconds.');
      setSavingSettings(false);
      return;
    }
    if (minAccuracy < 1 || minAccuracy > 100) {
      setSettingsError('Minimum accuracy must be between 1% and 100%.');
      setSavingSettings(false);
      return;
    }
    if (maxAttemptsMode === 'limited') {
      if (!maxAttemptsCount || maxAttemptsCount < 1 || !Number.isInteger(Number(maxAttemptsCount))) {
        setSettingsError('Maximum attempts must be a positive integer.');
        setSavingSettings(false);
        return;
      }
    }
    if (!passageText.trim() || passageText.trim().length < 20) {
      setSettingsError('Competition passage must be at least 20 characters.');
      setSavingSettings(false);
      return;
    }

    try {
      const res = await fetch('/api/event', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: {
            name: eventName.trim(),
            subtitle: eventSubtitle.trim() || null,
            organization_name: organizationName.trim() || null,
            passage: passageText.trim(),
            event_duration: Number(eventDurationMin),
            test_duration: effectiveTestSecs,
            minimum_accuracy: Number(minAccuracy),
            max_attempts: maxAttemptsMode === 'limited' ? Number(maxAttemptsCount) : null,
finalists_count: Number(finalistsCount),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save configuration.');
      }

      setSettingsMessage('Configuration saved successfully! All participants will now use these settings.');
      setTimeout(() => setSettingsMessage(null), 4000);
      loadAdminData();
    } catch (err: any) {
      setSettingsError(err.message || 'Error saving settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // Demo Mode Handlers (Requirement 25)
  const handleToggleDemo = async (enable: boolean) => {
    try {
      const res = await fetch('/api/admin/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_mode', enable }),
      });
      const data = await res.json();
      if (data.success) {
        loadAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimulateDemo = async () => {
    try {
      const res = await fetch('/api/admin/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'simulate_activity' }),
      });
      const data = await res.json();
      if (data.success) {
        loadAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Logout
  const handleLogout = async () => {
    await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    router.push('/admin/login');
  };

  // Filter Participants
  const filteredParticipants = participants.filter((p) => {
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.student_id.toLowerCase().includes(q);
  });

  if (loading && !stats) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <div className="w-10 h-10 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full animate-fade-in">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Host Management</h1>
          <p className="text-xs text-zinc-400">Control championship state, monitoring, and scores</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleLogout}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white glass-panel border border-white/10 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* 1. Big Status Panel (Requirement 29) */}
      {stats && <StatusPanel stats={stats} serverOffsetMs={serverOffsetMs} />}

      {/* 2. Event Controls & Demo Mode */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Controls Card */}
        <div className="lg:col-span-1 p-6 rounded-3xl glass-panel border border-white/10 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-mono uppercase tracking-wider font-bold text-white flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-orange-400" />
              <span>Event Controls</span>
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-zinc-400">
              Authoritative
            </span>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => handleEventAction('start')}
              disabled={stats?.event.status === 'LIVE'}
              className="py-3 px-3 rounded-xl font-bold text-black bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 transition-colors text-xs flex items-center justify-center space-x-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-black" />
              <span>START EVENT</span>
            </button>

            <button
              onClick={() => handleEventAction('pause')}
              disabled={stats?.event.status !== 'LIVE'}
              className="py-3 px-3 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-40 transition-colors text-xs flex items-center justify-center space-x-1.5"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>PAUSE EVENT</span>
            </button>

            <button
              onClick={() => handleEventAction('end')}
              disabled={stats?.event.status === 'ENDED'}
              className="py-3 px-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 transition-colors text-xs flex items-center justify-center space-x-1.5"
            >
              <Square className="w-3.5 h-3.5 fill-white" />
              <span>END EVENT</span>
            </button>

            <button
              onClick={() => handleEventAction('reset')}
              className="py-3 px-3 rounded-xl font-bold text-zinc-300 bg-white/10 hover:bg-white/15 transition-colors text-xs flex items-center justify-center space-x-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>RESET ALL</span>
            </button>
          </div>

          {/* Demo Mode Controls (Requirement 25) */}
          <div className="pt-4 border-t border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-amber-300 flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>DEMO MODE</span>
              </span>
              <button
                onClick={() => handleToggleDemo(!stats?.event.is_demo)}
                className={`text-[10px] font-mono px-2.5 py-1 rounded-full font-bold border transition-colors ${
                  stats?.event.is_demo
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-white/5 text-zinc-400 border-white/10'
                }`}
              >
                {stats?.event.is_demo ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
            <p className="text-[11px] text-zinc-500 mb-3">
              Enables 5-minute event & 10-second test rounds for rapid testing.
            </p>
            {stats?.event.is_demo && (
              <button
                onClick={handleSimulateDemo}
                className="w-full py-2 rounded-xl text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors flex items-center justify-center space-x-1.5"
              >
                <span>+ Simulate Test Participants</span>
              </button>
            )}
          </div>

          {/* CSV Export Buttons (Requirement 16) */}
          <div className="pt-4 border-t border-white/10 space-y-2">
            <div className="text-xs font-mono uppercase text-zinc-400 font-bold mb-1">
              Data Exports
            </div>
            <div className="flex flex-col gap-2">
              <a
                href="/api/admin/export?type=leaderboard"
                download
                className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-medium border border-white/10 flex items-center justify-center space-x-2 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-orange-400" />
                <span>EXPORT RESULTS (LEADERBOARD)</span>
              </a>

              <a
                href="/api/admin/export?type=all_attempts"
                download
                className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-medium border border-white/10 flex items-center justify-center space-x-2 transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
                <span>EXPORT ALL ATTEMPTS</span>
              </a>
            </div>
          </div>
        </div>

        {/* Configuration & Passage Editor Form + Live Summary */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-3xl glass-panel border border-white/10">
            <form onSubmit={handleSaveSettings} className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/10 gap-2">
                <div>
                  <h3 className="text-sm font-mono uppercase tracking-wider font-bold text-white flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-orange-400" />
                    <span>Event Configuration</span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Configure all championship parameters before initiating the live event
                  </p>
                </div>
                {stats?.event.status === 'LIVE' ? (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    🔒 LOCKED (LIVE EVENT)
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                    EDITABLE
                  </span>
                )}
              </div>

              {/* Status Warning Banner if LIVE */}
              {stats?.event.status === 'LIVE' && (
                <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs flex items-center space-x-2.5">
                  <span className="text-base">🔒</span>
                  <span>
                    Parameters are locked while the event is LIVE to guarantee fair and consistent competition. Pause or end the event to adjust configuration.
                  </span>
                </div>
              )}

              {/* Validation Feedback */}
              {settingsError && (
                <div className="p-3.5 rounded-2xl bg-red-950/60 border border-red-500/30 text-red-300 text-xs flex items-center space-x-2">
                  <XCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{settingsError}</span>
                </div>
              )}
              {settingsMessage && (
                <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{settingsMessage}</span>
                </div>
              )}

              {/* Event Name, Subtitle, and Org */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                    Event Name / Title <span className="text-orange-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={stats?.event.status === 'LIVE'}
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="e.g. Tensor MacTober Touch Type Championship '26"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/10 text-white font-sans text-xs focus:outline-none focus:border-orange-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                    Organization
                  </label>
                  <input
                    type="text"
                    disabled={stats?.event.status === 'LIVE'}
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder="e.g. TENSOR"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-orange-500 disabled:opacity-50"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                    Event Subtitle / Tagline
                  </label>
                  <input
                    type="text"
                    disabled={stats?.event.status === 'LIVE'}
                    value={eventSubtitle}
                    onChange={(e) => setEventSubtitle(e.target.value)}
                    placeholder="e.g. 60 seconds. One hour. Type your way to the top."
                    className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/10 text-white text-xs focus:outline-none focus:border-orange-500 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Event Duration, Attempt Duration, Minimum Accuracy, Maximum Attempts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {/* A. Event Duration */}
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                    Event Duration (Min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    disabled={stats?.event.status === 'LIVE'}
                    value={eventDurationMin}
                    onChange={(e) => setEventDurationMin(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono text-xs disabled:opacity-50"
                  />
                  <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">1 – 1440 mins</span>
                </div>

                {/* B. Attempt Duration */}
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                    Attempt Duration
                  </label>
                  <select
                    disabled={stats?.event.status === 'LIVE'}
                    value={testDurationPreset}
                    onChange={(e) => {
                      setTestDurationPreset(e.target.value);
                      if (e.target.value !== 'custom') {
                        setTestDurationSec(Number(e.target.value));
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono text-xs disabled:opacity-50"
                  >
                    <option value="15">15 seconds (Sprint)</option>
                    <option value="30">30 seconds</option>
                    <option value="45">45 seconds</option>
                    <option value="60">60 seconds (Standard)</option>
                    <option value="90">90 seconds</option>
                    <option value="120">120 seconds</option>
                    <option value="custom">Custom seconds...</option>
                  </select>

                  {testDurationPreset === 'custom' && (
                    <div className="mt-1.5">
                      <input
                        type="number"
                        min="5"
                        max="300"
                        disabled={stats?.event.status === 'LIVE'}
                        value={testDurationSec}
                        onChange={(e) => setTestDurationSec(Number(e.target.value))}
                        placeholder="Seconds (5-300)"
                        className="w-full px-3 py-1.5 rounded-lg bg-black/80 border border-orange-500/40 text-white font-mono text-xs"
                      />
                      <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">5 – 300 secs</span>
                    </div>
                  )}
                </div>

                {/* C. Minimum Accuracy */}
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                    Min Accuracy (%)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    max="100"
                    disabled={stats?.event.status === 'LIVE'}
                    value={minAccuracy}
                    onChange={(e) => setMinAccuracy(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono text-xs disabled:opacity-50"
                  />
                  <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">1% – 100% threshold</span>
                </div>

                {/* D. Maximum Attempts */}
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                    Maximum Attempts
                  </label>
                  <select
                    disabled={stats?.event.status === 'LIVE'}
                    value={maxAttemptsMode}
                    onChange={(e) => setMaxAttemptsMode(e.target.value as 'unlimited' | 'limited')}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono text-xs disabled:opacity-50"
                  >
                    <option value="unlimited">Unlimited (Default)</option>
                    <option value="limited">Limited Attempts</option>
                  </select>

                  {maxAttemptsMode === 'limited' && (
                    <div className="mt-1.5">
                      <input
                        type="number"
                        min="1"
                        max="50"
                        disabled={stats?.event.status === 'LIVE'}
                        value={maxAttemptsCount}
                        onChange={(e) => setMaxAttemptsCount(Math.max(1, Number(e.target.value)))}
                        placeholder="e.g. 5 attempts"
                        className="w-full px-3 py-1.5 rounded-lg bg-black/80 border border-orange-500/40 text-white font-mono text-xs"
                      />
                      <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">e.g. 3, 5, or 10</span>
                    </div>
                  )}
                </div>
              </div>

              {/* E. Number of Finalists */}
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                    Number of Finalists
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    disabled={stats?.event.status === 'LIVE'}
                    value={finalistsCount}
                    onChange={(e) => setFinalistsCount(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white font-mono text-xs disabled:opacity-50"
                  />
                  <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">
                    Number of participants advancing to the final round
                  </span>
                </div>
              {/* Competition Passage */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-mono text-zinc-400">
                    Official Competition Passage (Identical for all participants) <span className="text-orange-400">*</span>
                  </label>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {passageText.length} characters • ~{passageText.trim().split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>
                <textarea
                  rows={4}
                  required
                  disabled={stats?.event.status === 'LIVE'}
                  value={passageText}
                  onChange={(e) => setPassageText(e.target.value)}
                  className="w-full p-3.5 rounded-xl bg-black/60 border border-white/10 text-white font-mono text-xs leading-relaxed placeholder-zinc-600 focus:outline-none focus:border-orange-500 resize-none disabled:opacity-50"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-zinc-500">
                  {stats?.event.status === 'LIVE' ? '🔒 Locked while LIVE' : 'Click save to persist parameters across all pages'}
                </span>
                <button
                  type="submit"
                  disabled={stats?.event.status === 'LIVE' || savingSettings}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 transition-colors flex items-center space-x-1.5 shadow-glow-orange disabled:opacity-40"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingSettings ? 'Saving...' : 'SAVE CONFIGURATION'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Configuration Summary Card (Requirement 5 & 13) */}
          <div className="p-6 rounded-3xl glass-panel border border-white/10">
            <h4 className="text-xs font-mono uppercase tracking-wider font-bold text-zinc-400 mb-4 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-orange-400" />
              <span>CURRENT EVENT CONFIGURATION</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] text-zinc-400 uppercase block mb-1">Event Duration</span>
                <span className="text-sm font-bold text-white">{eventDurationMin} min</span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] text-zinc-400 uppercase block mb-1">Attempt Duration</span>
                <span className="text-sm font-bold text-white">
                  {testDurationPreset === 'custom' ? testDurationSec : testDurationPreset} sec
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] text-zinc-400 uppercase block mb-1">Min Accuracy</span>
                <span className="text-sm font-bold text-emerald-400">{minAccuracy}%</span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] text-zinc-400 uppercase block mb-1">Max Attempts</span>
                <span className="text-sm font-bold text-orange-400">
                  {maxAttemptsMode === 'limited' ? `${maxAttemptsCount} Tries` : 'Unlimited'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] text-zinc-400 uppercase block mb-1">Passage</span>
                <span className="text-sm font-bold text-white truncate block" title={passageText}>
                  {passageText.length} chars
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] text-zinc-400 uppercase block mb-1">Status</span>
                <span
                  className={`text-sm font-bold ${
                    stats?.event.status === 'LIVE'
                      ? 'text-emerald-400'
                      : stats?.event.status === 'ENDED'
                      ? 'text-red-400'
                      : 'text-zinc-300'
                  }`}
                >
                  {stats?.event.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Participant Search & Audit Management (Requirements 14, 15 & 9) */}
      <div className="p-6 rounded-3xl glass-panel border border-white/10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-5 pb-4 border-b border-white/10">
          <div>
            <h3 className="text-base font-bold text-white">Participants & Attempt Auditing</h3>
            <p className="text-xs text-zinc-400">
              Audit attempts used ({stats?.event.max_attempts ? `Limited to ${stats.event.max_attempts}` : 'Unlimited'}), logs, or manage disqualifications
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 font-mono uppercase text-zinc-400 text-[10px]">
                <th className="py-3 px-3">Student Name</th>
                <th className="py-3 px-3">Student ID</th>
                <th className="py-3 px-3 text-center">Attempts Used</th>
                <th className="py-3 px-3">Registered At</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {filteredParticipants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500">
                    No participants found.
                  </td>
                </tr>
              ) : (
                filteredParticipants.map((p) => {
                  const maxAtt = stats?.event.max_attempts;
                  const isMaxReached = maxAtt !== null && maxAtt !== undefined && (p.attempts_count || 0) >= maxAtt;

                  return (
                    <tr key={p.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-3 font-semibold text-white">
                        {p.name}
                      </td>
                      <td className="py-3 px-3 text-zinc-400">
                        {p.student_id}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                            isMaxReached
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'text-zinc-300 bg-white/5'
                          }`}
                        >
                          {p.attempts_count || 0} / {maxAtt || 'Unlimited'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-zinc-500 text-[11px]">
                        {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {p.disqualified ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-950/60 text-red-300 border border-red-500/30">
                            DISQUALIFIED
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                            ACTIVE
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right space-x-2">
                        <button
                          onClick={() => setSelectedParticipantForHistory(p)}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 text-[11px] border border-white/10 transition-colors"
                        >
                          History
                        </button>

                        <button
                          onClick={() => setSelectedParticipantForDisqualify(p)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                            p.disqualified
                              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-red-500/10 text-red-300 border border-red-500/30 hover:bg-red-500/20'
                          }`}
                        >
                          {p.disqualified ? 'Reinstate' : 'Disqualify'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <AttemptHistoryModal
        participant={selectedParticipantForHistory}
        onClose={() => setSelectedParticipantForHistory(null)}
      />

      <DisqualifyModal
        participant={selectedParticipantForDisqualify}
        onClose={() => setSelectedParticipantForDisqualify(null)}
        onSuccess={loadAdminData}
      />
    </div>
  );
}
