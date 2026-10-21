'use client';

import React, { useEffect, useState } from 'react';
import { TypingAttempt, Participant } from '@/types';
import { formatDateTime } from '@/lib/utils/timer';
import { X, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface AttemptHistoryModalProps {
  participant: Participant | null;
  onClose: () => void;
}

export default function AttemptHistoryModal({
  participant,
  onClose,
}: AttemptHistoryModalProps) {
  const [attempts, setAttempts] = useState<TypingAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!participant) return;
    const fetchAttempts = async () => {
      try {
        const res = await fetch(`/api/participants?participantId=${participant.id}`);
        const data = await res.json();
        if (data.success && data.attempts) {
          setAttempts(data.attempts);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAttempts();
  }, [participant]);

  if (!participant) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl rounded-3xl p-6 glass-panel-glow border border-white/15 shadow-apple-card relative max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-bold text-white">{participant.name}</h3>
              <span className="text-xs font-mono text-zinc-400">({participant.student_id})</span>
            </div>
            <p className="text-xs text-zinc-400">Complete Attempt Log & Accuracy Records</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Table */}
        <div className="overflow-y-auto flex-1 my-4 pr-1">
          {loading ? (
            <div className="py-12 text-center text-xs text-zinc-500 font-mono">
              Loading attempt logs...
            </div>
          ) : attempts.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500">
              No attempts recorded yet for this participant.
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="bg-white/5 text-[10px] uppercase text-zinc-400 border-b border-white/10">
                    <th className="py-2.5 px-3">Attempt #</th>
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3 text-right">WPM</th>
                    <th className="py-2.5 px-3 text-right">Accuracy</th>
                    <th className="py-2.5 px-3 text-right">Correct</th>
                    <th className="py-2.5 px-3 text-right">Errors</th>
                    <th className="py-2.5 px-3 text-center">Qualified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {attempts.map((att, idx) => (
                    <tr
                      key={att.id}
                      className={att.qualified ? 'hover:bg-white/5' : 'bg-red-950/20 hover:bg-red-950/30'}
                    >
                      <td className="py-2.5 px-3 text-zinc-300 font-bold">
                        #{attempts.length - idx}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-400">
                        {formatDateTime(att.completed_at || att.created_at)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-white">
                        {att.wpm_display}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-semibold ${
                          att.accuracy >= 85 ? 'text-zinc-200' : 'text-red-400'
                        }`}
                      >
                        {att.accuracy}%
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-400">
                        {att.correct_characters}
                      </td>
                      <td className="py-2.5 px-3 text-right text-red-400">
                        {att.incorrect_characters}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {att.qualified ? (
                          <span className="inline-flex items-center text-emerald-400 text-[11px] font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            YES
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-red-400 text-[11px] font-semibold">
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            NO (&lt;85%)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-white/10 flex justify-between items-center text-xs text-zinc-400 shrink-0">
          <span>Total attempts: {attempts.length}</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
