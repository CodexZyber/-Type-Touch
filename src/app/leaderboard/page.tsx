'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Participant, LeaderboardEntry } from '@/types';
import { formatDateTime } from '@/lib/utils/timer';
import { useLiveFeed } from '@/lib/hooks/useLiveFeed';
import { PARTICIPANT_STORAGE_KEY } from '@/lib/utils/participant-session';
import FinalStandings from '@/components/final/FinalStandings';
import StudentDetail from '@/components/leaderboard/StudentDetail';
import Histogram from '@/components/charts/Histogram';
import { Search, ArrowRight, Crown, Radio, Users, Gauge, Target, Keyboard, ChevronRight } from 'lucide-react';

const MEDALS = ['🥇', '🥈', '🥉'];
type Tab = 'final' | 'qualifier';

function StatTile({ icon: Icon, label, value, sub }: { icon: any; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
        <div className="text-2xl font-extrabold tabular-nums text-slate-900 leading-tight">{value}</div>
        {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const { event, leaderboard: entries, finalStandings, progress, connected, loaded } = useLiveFeed();
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState<Tab | null>(null);
  const [selected, setSelected] = useState<{ id: string; rank: number | null; bestAttemptId?: string | null; round: 'QUALIFIER' | 'FINAL' } | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PARTICIPANT_STORAGE_KEY);
      if (stored) setParticipant(JSON.parse(stored));
    } catch (e) {
      // ignore
    }
  }, []);

  const finalStarted = Boolean(event && event.final_status !== 'NOT_STARTED');
  const activeTab: Tab = tab ?? (finalStarted ? 'final' : 'qualifier');

  const finalistsCount = Number(event?.finalists_count) || 2;
  const minimumAccuracy = event?.minimum_accuracy || 85;
  const podium = entries.slice(0, Math.min(finalistsCount, 3));

  const q = searchQuery.trim().toLowerCase();
  const filteredEntries = q
    ? entries.filter((e) => e.name.toLowerCase().includes(q) || e.student_id.toLowerCase().includes(q))
    : entries;

  const currentUserEntry = entries.find((e) => e.participant_id === participant?.id);

  const stats = useMemo(() => {
    if (!entries.length) return null;
    const n = entries.length;
    const avgWpm = Math.round(entries.reduce((s, e) => s + e.best_wpm, 0) / n);
    const avgAcc = Math.round((entries.reduce((s, e) => s + Number(e.best_accuracy), 0) / n) * 10) / 10;
    const totalAttempts = entries.reduce((s, e) => s + Number(e.attempts_count), 0);
    const median = [...entries].map((e) => e.best_wpm).sort((a, b) => a - b)[Math.floor(n / 2)];
    return { n, avgWpm, avgAcc, totalAttempts, median, top: entries[0].best_wpm };
  }, [entries]);

  const openDetail = (e: LeaderboardEntry) =>
    setSelected({ id: e.participant_id, rank: e.rank, bestAttemptId: e.best_attempt_id, round: 'QUALIFIER' });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full animate-fade-in pb-28">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <span className="ts-eyebrow block mb-2">Live standings</span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">Leaderboard</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-xl">
            {activeTab === 'final'
              ? 'Grand Final: finalists ranked by their best final-round attempt, updating as they type.'
              : `Ranked by each student's best attempt at ${minimumAccuracy}% accuracy or better. Ties go to higher accuracy, then the earlier attempt. Click a row for the full story.`}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
              connected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}
            title={connected ? 'Connected to the live stream' : 'Live stream unavailable, refreshing every few seconds'}
          >
            <Radio className="w-3.5 h-3.5" />
            {connected ? 'Live' : 'Refreshing'}
          </span>
          {!finalStarted && (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-semibold">
              <Crown className="w-3.5 h-3.5" />
              Top {finalistsCount} advance to the Grand Final
            </span>
          )}
        </div>
      </div>

      {/* Tabs (only once the Grand Final exists) */}
      {finalStarted && (
        <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 mb-6">
          {(
            [
              { id: 'final', label: event?.final_status === 'LIVE' ? 'Grand Final · live' : 'Grand Final' },
              { id: 'qualifier', label: 'Qualifiers' },
            ] as { id: Tab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === t.id ? 'bg-white text-indigo-700 shadow-card' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'final' ? (
        <>
          <FinalStandings
            event={event}
            standings={finalStandings}
            progress={progress}
            currentParticipantId={participant?.id}
            onSelect={(id) => {
              const row = finalStandings.find((s) => s.participant_id === id);
              setSelected({ id, rank: row?.rank ?? null, round: 'FINAL' });
            }}
          />
          <div className="mt-6 text-center">
            <Link href="/final" className="btn-secondary px-5 py-2.5 text-xs">
              Open the Grand Final page
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </>
      ) : (
        <>
          {/* Overview */}
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <StatTile icon={Users} label="Ranked" value={stats.n} sub={`${stats.totalAttempts} attempts total`} />
              <StatTile icon={Gauge} label="Top speed" value={`${stats.top}`} sub={`avg ${stats.avgWpm} · median ${stats.median} WPM`} />
              <StatTile icon={Target} label="Avg accuracy" value={`${stats.avgAcc}%`} sub={`min ${minimumAccuracy}% to rank`} />
              <StatTile
                icon={Keyboard}
                label={currentUserEntry ? 'You' : 'Your rank'}
                value={currentUserEntry ? `#${currentUserEntry.rank}` : '—'}
                sub={currentUserEntry ? `${currentUserEntry.best_wpm} WPM · ${currentUserEntry.best_accuracy}%` : participant ? 'not ranked yet' : 'not signed in'}
              />
            </div>
          )}

          {entries.length >= 3 && (
            <div className="rounded-2xl bg-white border border-slate-200 p-4 mb-6">
              <div className="flex items-baseline justify-between mb-1">
                <h3 className="text-sm font-bold text-slate-900">How the field is spread</h3>
                <span className="text-[11px] text-slate-500">students per 10-WPM band</span>
              </div>
              <Histogram values={entries.map((e) => e.best_wpm)} highlight={currentUserEntry?.best_wpm ?? null} height={130} />
            </div>
          )}

          {/* Podium */}
          {podium.length > 0 && (
            <div
              className={`grid gap-3 mb-6 ${
                podium.length === 1 ? 'grid-cols-1 max-w-sm' : podium.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'
              }`}
            >
              {podium.map((entry, i) => {
                const isMe = entry.participant_id === participant?.id;
                return (
                  <button
                    type="button"
                    onClick={() => openDetail(entry)}
                    key={entry.participant_id}
                    className={`text-left relative rounded-2xl p-5 border shadow-card transition-colors hover:border-indigo-300 ${
                      i === 0 ? 'bg-amber-50/60 border-amber-200' : 'bg-white border-slate-200'
                    } ${isMe ? 'ring-4 ring-indigo-100' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-2xl leading-none">{MEDALS[i]}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                        Finalist #{i + 1}
                      </span>
                    </div>
                    <div className="font-bold text-slate-900 text-lg truncate">{entry.name}</div>
                    <div className="text-xs font-mono text-slate-500 mb-4">{entry.student_id}</div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-3xl font-extrabold tabular-nums text-slate-900">
                        {entry.best_wpm}
                        <span className="text-sm font-semibold text-slate-400 ml-1">WPM</span>
                      </span>
                      <span className="text-sm font-semibold text-slate-600 tabular-nums">{entry.best_accuracy}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Search + count */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                placeholder="Search name or student ID"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ts-input pl-10"
              />
            </div>
            <div className="text-xs text-slate-500">
              {entries.length} ranked student{entries.length === 1 ? '' : 's'}
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4 text-center w-16">Rank</th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4 text-right">WPM</th>
                    <th className="py-3 px-4 text-right hidden sm:table-cell" title="All typed characters, mistakes included">Raw</th>
                    <th className="py-3 px-4 text-right">Accuracy</th>
                    <th className="py-3 px-4 text-right hidden md:table-cell" title="How even the speed stayed">Consistency</th>
                    <th className="py-3 px-4 text-center hidden sm:table-cell">Attempts</th>
                    <th className="py-3 px-4 text-right hidden lg:table-cell">Best attempt</th>
                    <th className="py-3 px-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {!loaded && entries.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-14 text-center text-xs text-slate-400">
                        Loading standings…
                      </td>
                    </tr>
                  ) : filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-14 text-center text-xs text-slate-500">
                        {searchQuery ? 'No students match your search.' : 'No qualifying attempts yet.'}
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map((entry) => {
                      const isCurrent = entry.participant_id === participant?.id;
                      const isFinalist = entry.rank <= finalistsCount;
                      return (
                        <tr
                          key={entry.participant_id}
                          onClick={() => openDetail(entry)}
                          className={`cursor-pointer transition-colors ${
                            isCurrent ? 'bg-indigo-50 hover:bg-indigo-100/70' : isFinalist ? 'bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex w-7 h-7 items-center justify-center rounded-lg text-xs font-bold ${
                                entry.rank === 1 ? 'bg-amber-100 text-amber-700' : isFinalist ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {entry.rank}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className={`font-semibold ${isCurrent ? 'text-indigo-800' : 'text-slate-900'}`}>{entry.name}</span>
                              {isCurrent && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-700 text-white">YOU</span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-slate-500">{entry.student_id}</span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold tabular-nums text-slate-900 text-base">{entry.best_wpm}</td>
                          <td className="py-3 px-4 text-right tabular-nums text-slate-500 hidden sm:table-cell">
                            {entry.best_raw_wpm != null ? Math.round(Number(entry.best_raw_wpm)) : '—'}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums text-slate-600">{entry.best_accuracy}%</td>
                          <td className="py-3 px-4 text-right hidden md:table-cell">
                            {entry.best_consistency != null && Number(entry.best_consistency) > 0 ? (
                              <span className="inline-flex items-center gap-2 justify-end">
                                <span className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                  <span className="block h-full bg-indigo-500" style={{ width: `${Math.max(0, Math.min(100, Number(entry.best_consistency)))}%` }} />
                                </span>
                                <span className="tabular-nums text-slate-600 w-9 text-right">{Math.round(Number(entry.best_consistency))}%</span>
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center text-xs text-slate-500 hidden sm:table-cell">{entry.attempts_count}</td>
                          <td className="py-3 px-4 text-right text-xs text-slate-400 hidden lg:table-cell">{formatDateTime(entry.last_attempt_at)}</td>
                          <td className="py-3 px-2 text-slate-300">
                            <ChevronRight className="w-4 h-4" />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Your position (qualifier round) */}
      {participant && activeTab === 'qualifier' && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-white border border-indigo-200 shadow-card-lg p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-700 text-white flex items-center justify-center font-bold text-sm shrink-0">
              {currentUserEntry ? `#${currentUserEntry.rank}` : '—'}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 truncate">{participant.name}</div>
              <div className="text-xs text-slate-500">
                {currentUserEntry ? (
                  <>
                    Best <strong className="text-indigo-700">{currentUserEntry.best_wpm} WPM</strong> · {currentUserEntry.best_accuracy}%
                    {' · '}
                    <button className="underline hover:text-indigo-700" onClick={() => openDetail(currentUserEntry)}>
                      see my graphs
                    </button>
                  </>
                ) : (
                  <>Not ranked yet. Finish an attempt at {minimumAccuracy}%+ accuracy.</>
                )}
              </div>
            </div>
          </div>
          {event?.status === 'LIVE' && (
            <Link href="/contest" className="btn-primary px-4 py-2 text-xs shrink-0">
              <span>{currentUserEntry ? 'Improve' : 'Enter arena'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      )}

      {selected && (
        <StudentDetail
          participantId={selected.id}
          rank={selected.rank}
          bestAttemptId={selected.bestAttemptId}
          round={selected.round}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
