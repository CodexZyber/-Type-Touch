'use client';

import React, { useState, useEffect, useRef } from 'react';
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
import FinalStandings from '@/components/final/FinalStandings';
import { pickPassage } from '@/lib/passages';
import { PassageMode } from '@/types';
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
  FileSpreadsheet,
  Crown
} from 'lucide-react';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);

  // Passage & Settings Editing
  const [eventName, setEventName] = useState("Tensor School Typing Championship");
  const [eventSubtitle, setEventSubtitle] = useState('Type fast. Type clean. Climb the leaderboard.');
  const [organizationName, setOrganizationName] = useState('TENSOR');
  const [passageText, setPassageText] = useState('');
  const [eventDurationMin, setEventDurationMin] = useState(60);
  const [testDurationSec, setTestDurationSec] = useState(60);
  const [testDurationPreset, setTestDurationPreset] = useState<string>('60');
  const [minAccuracy, setMinAccuracy] = useState(85.0);
  const [maxAttemptsMode, setMaxAttemptsMode] = useState<'unlimited' | 'limited'>('unlimited');
  const [finalistsCount, setFinalistsCount] = useState<number>(2);
  const [finalDuration, setFinalDuration] = useState<number>(10);
  const [passageMode, setPassageMode] = useState<PassageMode>('random');
  const [finalPassageText, setFinalPassageText] = useState('');
  const [maxAttemptsCount, setMaxAttemptsCount] = useState<number>(5);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  // Draft config is only (re)hydrated from the server on first load, after a
  // successful save, or on explicit discard — never by background polling.
  const [isDirty, setIsDirty] = useState(false);
  const hasHydratedRef = useRef(false);

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

  // Copy saved event settings into the editable draft
  const applyEventToForm = (event: ChampionshipEvent) => {
    setEventName(event.name || "Tensor School Typing Championship");
    setEventSubtitle(event.subtitle || 'Type fast. Type clean. Climb the leaderboard.');
    setOrganizationName(event.organization_name || 'TENSOR');
    setPassageText(event.passage);
    setEventDurationMin(event.event_duration || 60);

    const currentTestDur = event.test_duration || 60;
    setTestDurationSec(currentTestDur);
    if ([15, 30, 45, 60, 90, 120].includes(currentTestDur)) {
      setTestDurationPreset(currentTestDur.toString());
    } else {
      setTestDurationPreset('custom');
    }

    setMinAccuracy(event.minimum_accuracy || 85.0);
    setFinalistsCount(event.finalists_count || 2);
    setFinalDuration(event.final_duration || 10);
    setPassageMode(event.passage_mode === 'custom' ? 'custom' : 'random');
    setFinalPassageText(event.final_passage || '');

    if (event.max_attempts) {
      setMaxAttemptsMode('limited');
      setMaxAttemptsCount(event.max_attempts);
    } else {
      setMaxAttemptsMode('unlimited');
    }

    hasHydratedRef.current = true;
    setIsDirty(false);
  };

  const handleDiscardSettings = () => {
    if (stats?.event) {
      applyEventToForm(stats.event);
    }
    setSettingsError(null);
    setSettingsMessage(null);
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
        if (!hasHydratedRef.current) {
          applyEventToForm(statsData.stats.event);
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
  const handleEventAction = async (action: 'start' | 'pause' | 'end' | 'reset' | 'start_final' | 'end_final') => {
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
            // Use the saved durations so unsaved drafts never leak into a live round
            durationMinutes:
              action === 'start_final' ? stats?.event.final_duration : stats?.event.event_duration,
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        loadAdminData();
      } else {
        window.alert(`Could not ${action.replace('_', ' ')} the event: ${data.error || `HTTP ${res.status}`}`);
      }
    } catch (err) {
      console.error(err);
      window.alert(`Could not ${action} the event. Check the server logs.`);
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
            final_duration: Number(finalDuration),
            passage_mode: passageMode,
            final_passage: passageMode === 'custom' ? finalPassageText.trim() || null : null,
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to save configuration (HTTP ${res.status}). Your unsaved changes are kept.`);
      }

      // Re-baseline the draft from the confirmed server response
      if (data.event) {
        setStats((prev) => (prev ? { ...prev, event: data.event } : prev));
        applyEventToForm(data.event);
      } else {
        setIsDirty(false);
      }

      setSettingsMessage('Configuration saved successfully! All participants will now use these settings.');
      setTimeout(() => setSettingsMessage(null), 4000);
      loadAdminData();
    } catch (err: any) {
      setSettingsError(err.message || 'Error saving settings. Your unsaved changes are kept.');
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
        <div className="w-10 h-10 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full animate-fade-in">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Host Management</h1>
          <p className="text-xs text-slate-500">Control championship state, monitoring, and scores</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleLogout}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-900 glass-panel border border-slate-200 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* 1. Big Status Panel (Requirement 29) */}
      {stats && <StatusPanel stats={stats} serverOffsetMs={serverOffsetMs} />}

      {/* Grand Final board (live) */}
      {stats && (stats.event.final_status !== 'NOT_STARTED' || stats.event.status === 'ENDED') && (
        <div className="mb-8 p-6 rounded-3xl glass-panel border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-mono uppercase tracking-wider font-bold text-slate-900 flex items-center space-x-2">
              <Crown className="w-4 h-4 text-indigo-700" />
              <span>
                {stats.event.final_status === 'NOT_STARTED' ? 'Seeded finalists (projected)' : 'Grand Final standings'}
              </span>
            </h3>
            <a href="/final" target="_blank" rel="noreferrer" className="text-xs font-semibold text-indigo-700 hover:text-indigo-900">
              Open projector view ↗
            </a>
          </div>
          <FinalStandings event={stats.event} standings={stats.finalStandings} compact />
        </div>
      )}

      {/* 2. Event Controls & Demo Mode */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Controls Card */}
        <div className="lg:col-span-1 p-6 rounded-3xl glass-panel border border-slate-200 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-mono uppercase tracking-wider font-bold text-slate-900 flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-indigo-700" />
              <span>Event Controls</span>
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-50 text-slate-500">
              Authoritative
            </span>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => handleEventAction('start')}
              disabled={stats?.event.status === 'LIVE'}
              className="py-3 px-3 rounded-xl font-bold text-slate-900 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 transition-colors text-xs flex items-center justify-center space-x-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
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
              className="py-3 px-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors text-xs flex items-center justify-center space-x-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>RESET ALL</span>
            </button>
          </div>

          {/* Grand Final Controls */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-indigo-700 flex items-center space-x-1">
                <Crown className="w-3.5 h-3.5" />
                <span>GRAND FINAL</span>
              </span>
              <span
                className={`text-[10px] font-mono px-2.5 py-1 rounded-full font-bold border ${
                  stats?.event.final_status === 'LIVE'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : stats?.event.final_status === 'ENDED'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-slate-50 text-slate-500 border-slate-200'
                }`}
              >
                {stats?.event.final_status === 'LIVE' ? 'LIVE' : stats?.event.final_status === 'ENDED' ? 'ENDED' : 'NOT STARTED'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              Seeds the top {stats?.event.finalists_count || 2} of the qualifier board and opens a{' '}
              {stats?.event.final_duration || 10}-minute final window. Requires the qualifier round to be ended.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleEventAction('start_final')}
                disabled={stats?.event.status !== 'ENDED' || stats?.event.final_status === 'LIVE'}
                className="py-2.5 px-3 rounded-xl font-bold text-white bg-indigo-700 hover:bg-indigo-800 disabled:opacity-40 transition-colors text-xs flex items-center justify-center space-x-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>{stats?.event.final_status === 'ENDED' ? 'RESTART FINAL' : 'START FINAL'}</span>
              </button>
              <button
                onClick={() => handleEventAction('end_final')}
                disabled={stats?.event.final_status !== 'LIVE'}
                className="py-2.5 px-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 transition-colors text-xs flex items-center justify-center space-x-1.5"
              >
                <Square className="w-3.5 h-3.5 fill-white" />
                <span>END FINAL</span>
              </button>
            </div>
          </div>

          {/* Demo Mode Controls (Requirement 25) */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-amber-600 flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>DEMO MODE</span>
              </span>
              <button
                onClick={() => handleToggleDemo(!stats?.event.is_demo)}
                className={`text-[10px] font-mono px-2.5 py-1 rounded-full font-bold border transition-colors ${
                  stats?.event.is_demo
                    ? 'bg-amber-100 text-amber-600 border-amber-300'
                    : 'bg-slate-50 text-slate-500 border-slate-200'
                }`}
              >
                {stats?.event.is_demo ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              Enables 5-minute event & 10-second test rounds for rapid testing.
            </p>
            {stats?.event.is_demo && (
              <button
                onClick={handleSimulateDemo}
                className="w-full py-2 rounded-xl text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 transition-colors flex items-center justify-center space-x-1.5"
              >
                <span>+ Simulate Test Participants</span>
              </button>
            )}
          </div>

          {/* CSV Export Buttons (Requirement 16) */}
          <div className="pt-4 border-t border-slate-200 space-y-2">
            <div className="text-xs font-mono uppercase text-slate-500 font-bold mb-1">
              Data Exports
            </div>
            <div className="flex flex-col gap-2">
              <a
                href="/api/admin/export?type=leaderboard"
                download
                className="py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-900 text-xs font-medium border border-slate-200 flex items-center justify-center space-x-2 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-indigo-700" />
                <span>EXPORT RESULTS (LEADERBOARD)</span>
              </a>

              <a
                href="/api/admin/export?type=all_attempts"
                download
                className="py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-900 text-xs font-medium border border-slate-200 flex items-center justify-center space-x-2 transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-700" />
                <span>EXPORT ALL ATTEMPTS</span>
              </a>
            </div>
          </div>
        </div>

        {/* Configuration & Passage Editor Form + Live Summary */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-3xl glass-panel border border-slate-200">
            <form onSubmit={handleSaveSettings} onChange={() => setIsDirty(true)} className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-2">
                <div>
                  <h3 className="text-sm font-mono uppercase tracking-wider font-bold text-slate-900 flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-indigo-700" />
                    <span>Event Configuration</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Configure all championship parameters before initiating the live event
                  </p>
                </div>
                {stats?.event.status === 'LIVE' || stats?.event.final_status === 'LIVE' ? (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-amber-100 text-amber-600 border border-amber-200">
                    🔒 LOCKED ({stats?.event.final_status === 'LIVE' ? 'FINAL LIVE' : 'LIVE EVENT'})
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-mono text-emerald-600 bg-emerald-50 border border-emerald-200">
                    EDITABLE
                  </span>
                )}
              </div>

              {/* Status Warning Banner if LIVE */}
              {(stats?.event.status === 'LIVE' || stats?.event.final_status === 'LIVE') && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 text-xs flex items-center space-x-2.5">
                  <span className="text-base">🔒</span>
                  <span>
                    Parameters are locked while a round is LIVE to guarantee fair and consistent competition. Pause or end the round to adjust configuration.
                  </span>
                </div>
              )}

              {/* Validation Feedback */}
              {settingsError && (
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2">
                  <XCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{settingsError}</span>
                </div>
              )}
              {settingsMessage && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{settingsMessage}</span>
                </div>
              )}

              {/* Event Name, Subtitle, and Org */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-mono text-slate-500 mb-1">
                    Event Name / Title <span className="text-indigo-700">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={stats?.event.status === 'LIVE'}
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="e.g. Tensor School Typing Championship"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-sans text-xs focus:outline-none focus:border-indigo-600 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-slate-500 mb-1">
                    Organization
                  </label>
                  <input
                    type="text"
                    disabled={stats?.event.status === 'LIVE'}
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder="e.g. TENSOR"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs focus:outline-none focus:border-indigo-600 disabled:opacity-50"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-mono text-slate-500 mb-1">
                    Event Subtitle / Tagline
                  </label>
                  <input
                    type="text"
                    disabled={stats?.event.status === 'LIVE'}
                    value={eventSubtitle}
                    onChange={(e) => setEventSubtitle(e.target.value)}
                    placeholder="e.g. 60 seconds. One hour. Type your way to the top."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Event Duration, Attempt Duration, Minimum Accuracy, Maximum Attempts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {/* A. Event Duration */}
                <div>
                  <label className="block text-[11px] font-mono text-slate-500 mb-1">
                    Event Duration (Min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    disabled={stats?.event.status === 'LIVE'}
                    value={eventDurationMin}
                    onChange={(e) => setEventDurationMin(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs disabled:opacity-50"
                  />
                  <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">1 – 1440 mins</span>
                </div>

                {/* B. Attempt Duration */}
                <div>
                  <label className="block text-[11px] font-mono text-slate-500 mb-1">
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
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs disabled:opacity-50"
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
                        className="w-full px-3 py-1.5 rounded-lg bg-white border border-indigo-300 text-slate-900 font-mono text-xs"
                      />
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">5 – 300 secs</span>
                    </div>
                  )}
                </div>

                {/* C. Minimum Accuracy */}
                <div>
                  <label className="block text-[11px] font-mono text-slate-500 mb-1">
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
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs disabled:opacity-50"
                  />
                  <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">1% – 100% threshold</span>
                </div>

                {/* D. Maximum Attempts */}
                <div>
                  <label className="block text-[11px] font-mono text-slate-500 mb-1">
                    Maximum Attempts
                  </label>
                  <select
                    disabled={stats?.event.status === 'LIVE'}
                    value={maxAttemptsMode}
                    onChange={(e) => setMaxAttemptsMode(e.target.value as 'unlimited' | 'limited')}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs disabled:opacity-50"
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
                        className="w-full px-3 py-1.5 rounded-lg bg-white border border-indigo-300 text-slate-900 font-mono text-xs"
                      />
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">e.g. 3, 5, or 10</span>
                    </div>
                  )}
                </div>
              </div>

              {/* E. Number of Finalists */}
                <div>
                  <label className="block text-[11px] font-mono text-slate-500 mb-1">
                    Number of Finalists
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    disabled={stats?.event.status === 'LIVE'}
                    value={finalistsCount}
                    onChange={(e) => setFinalistsCount(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs disabled:opacity-50"
                  />
                  <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                    Number of participants advancing to the final round
                  </span>
                </div>

              {/* F. Grand Final duration */}
                <div>
                  <label className="block text-[11px] font-mono text-slate-500 mb-1">
                    Grand Final Duration (Min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="240"
                    disabled={stats?.event.status === 'LIVE' || stats?.event.final_status === 'LIVE'}
                    value={finalDuration}
                    onChange={(e) => setFinalDuration(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs disabled:opacity-50"
                  />
                  <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                    How long finalists have to post their final-round attempts
                  </span>
                </div>
              {/* Competition Passage */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-[11px] font-mono text-slate-500">Competition Passage</label>
                  <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-semibold">
                    {(['random', 'custom'] as PassageMode[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        disabled={stats?.event.status === 'LIVE' || stats?.event.final_status === 'LIVE'}
                        onClick={() => {
                          setPassageMode(m);
                          setIsDirty(true);
                        }}
                        className={`px-3 py-1 rounded-md transition-colors disabled:opacity-50 ${
                          passageMode === m ? 'bg-white text-indigo-700 shadow-card' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {m === 'random' ? 'Fresh passage every round' : 'Custom passage'}
                      </button>
                    ))}
                  </div>
                </div>

                {passageMode === 'random' ? (
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                    <p className="text-[11px] text-slate-500 mb-2">
                      Each start picks a different passage from the built-in library, and the Grand Final gets another one the
                      finalists have not seen. The passage currently loaded is shown below.
                    </p>
                    <p className="text-xs font-mono leading-relaxed text-slate-700 max-h-28 overflow-y-auto">{passageText}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {passageText.length} characters • ~{passageText.trim().split(/\s+/).filter(Boolean).length} words
                      </span>
                      <button
                        type="button"
                        disabled={stats?.event.status === 'LIVE' || stats?.event.final_status === 'LIVE'}
                        onClick={() => {
                          setPassageText(pickPassage([passageText]));
                          setIsDirty(true);
                        }}
                        className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 disabled:opacity-50"
                      >
                        Shuffle now ↻
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-mono text-slate-500">
                          Qualifier passage <span className="text-indigo-700">*</span>
                        </label>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {passageText.length} characters • ~{passageText.trim().split(/\s+/).filter(Boolean).length} words
                        </span>
                      </div>
                      <textarea
                        rows={4}
                        required
                        disabled={stats?.event.status === 'LIVE' || stats?.event.final_status === 'LIVE'}
                        value={passageText}
                        onChange={(e) => setPassageText(e.target.value)}
                        className="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs leading-relaxed placeholder-slate-400 focus:outline-none focus:border-indigo-600 resize-none disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-mono text-slate-500">Grand Final passage (optional)</label>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {finalPassageText.trim() ? `${finalPassageText.length} characters` : 'blank = random, different from the qualifier'}
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        disabled={stats?.event.status === 'LIVE' || stats?.event.final_status === 'LIVE'}
                        value={finalPassageText}
                        onChange={(e) => setFinalPassageText(e.target.value)}
                        placeholder="Leave blank to pick a fresh library passage when the final starts"
                        className="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs leading-relaxed placeholder-slate-400 focus:outline-none focus:border-indigo-600 resize-none disabled:opacity-50"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-500">
                  {stats?.event.status === 'LIVE'
                    ? '🔒 Locked while LIVE'
                    : isDirty
                    ? <span className="text-amber-600">● Unsaved changes</span>
                    : 'Click save to persist parameters across all pages'}
                </span>
                <div className="flex items-center space-x-2">
                {isDirty && (
                  <button
                    type="button"
                    onClick={handleDiscardSettings}
                    disabled={savingSettings}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-40"
                  >
                    DISCARD
                  </button>
                )}
                <button
                  type="submit"
                  disabled={stats?.event.status === 'LIVE' || stats?.event.final_status === 'LIVE' || savingSettings}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-700 hover:bg-indigo-800 transition-colors flex items-center space-x-1.5 shadow-glow-indigo disabled:opacity-40"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingSettings ? 'Saving...' : 'SAVE CONFIGURATION'}</span>
                </button>
                </div>
              </div>
            </form>
          </div>

          {/* Configuration Summary Card (Requirement 5 & 13) */}
          <div className="p-6 rounded-3xl glass-panel border border-slate-200">
            <h4 className="text-xs font-mono uppercase tracking-wider font-bold text-slate-500 mb-4 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-indigo-600" />
              <span>CURRENT EVENT CONFIGURATION</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block mb-1">Event Duration</span>
                <span className="text-sm font-bold text-slate-900">{stats?.event.event_duration} min</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block mb-1">Attempt Duration</span>
                <span className="text-sm font-bold text-slate-900">
                  {stats?.event.test_duration} sec
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block mb-1">Min Accuracy</span>
                <span className="text-sm font-bold text-emerald-600">{stats?.event.minimum_accuracy}%</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block mb-1">Max Attempts</span>
                <span className="text-sm font-bold text-indigo-700">
                  {stats?.event.max_attempts ? `${stats.event.max_attempts} Tries` : 'Unlimited'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block mb-1">Passage</span>
                <span className="text-sm font-bold text-slate-900 truncate block" title={stats?.event.passage}>
                  {stats?.event.passage.length ?? 0} chars
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block mb-1">Status</span>
                <span
                  className={`text-sm font-bold ${
                    stats?.event.status === 'LIVE'
                      ? 'text-emerald-600'
                      : stats?.event.status === 'ENDED'
                      ? 'text-red-600'
                      : 'text-slate-600'
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
      <div className="p-6 rounded-3xl glass-panel border border-slate-200">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-bold text-slate-900">Participants & Attempt Auditing</h3>
            <p className="text-xs text-slate-500">
              Audit attempts used ({stats?.event.max_attempts ? `Limited to ${stats.event.max_attempts}` : 'Unlimited'}), logs, or manage disqualifications
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-mono uppercase text-slate-500 text-[10px]">
                <th className="py-3 px-3">Student Name</th>
                <th className="py-3 px-3">Student ID</th>
                <th className="py-3 px-3 text-center">Attempts Used</th>
                <th className="py-3 px-3">Registered At</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredParticipants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No participants found.
                  </td>
                </tr>
              ) : (
                filteredParticipants.map((p) => {
                  const maxAtt = stats?.event.max_attempts;
                  const isMaxReached = maxAtt !== null && maxAtt !== undefined && (p.attempts_count || 0) >= maxAtt;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        {p.name}
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {p.student_id}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                            isMaxReached
                              ? 'bg-amber-100 text-amber-600 border border-amber-200'
                              : 'text-slate-600 bg-slate-50'
                          }`}
                        >
                          {p.attempts_count || 0} / {maxAtt || 'Unlimited'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 text-[11px]">
                        {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {p.disqualified ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                            DISQUALIFIED
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ACTIVE
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right space-x-2">
                        <button
                          onClick={() => setSelectedParticipantForHistory(p)}
                          className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 text-[11px] border border-slate-200 transition-colors"
                        >
                          History
                        </button>

                        <button
                          onClick={() => setSelectedParticipantForDisqualify(p)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                            p.disqualified
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
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
