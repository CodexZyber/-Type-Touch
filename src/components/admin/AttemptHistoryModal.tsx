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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl rounded-3xl p-6 glass-panel-glow border border-slate-200 shadow-card relative max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-bold text-slate-900">{participant.name}</h3>
              <span className="text-xs font-mono text-slate-500">({participant.student_id})</span>
            </div>
            <p className="text-xs text-slate-500">Complete Attempt Log & Accuracy Records</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Table */}
        <div className="overflow-y-auto flex-1 my-4 pr-1">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500 font-mono">
              Loading attempt logs...
            </div>
          ) : attempts.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No attempts recorded yet for this participant.
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                    <th className="py-2.5 px-3">Attempt #</th>
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3 text-right">WPM</th>
                    <th className="py-2.5 px-3 text-right">Accuracy</th>
                    <th className="py-2.5 px-3 text-right">Correct</th>
                    <th className="py-2.5 px-3 text-right" title="Mistypes / uncorrected">Errors</th>
                    <th className="py-2.5 px-3 text-center">Qualified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attempts.map((att, idx) => (
                    <tr
                      key={att.id}
                      className={att.qualified ? 'hover:bg-slate-50' : 'bg-red-50 hover:bg-red-50'}
                    >
                      <td className="py-2.5 px-3 text-slate-600 font-bold">
                        #{attempts.length - idx}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {formatDateTime(att.completed_at || att.created_at)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {att.wpm_display}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-semibold ${
                          att.accuracy >= 85 ? 'text-slate-700' : 'text-red-600'
                        }`}
                      >
                        {att.accuracy}%
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-600">
                        {att.correct_characters}
                      </td>
                      <td className="py-2.5 px-3 text-right text-red-600" title="Mistypes (wrong keypresses) / uncorrected typos left in the text">
                        {att.incorrect_keystrokes ?? att.incorrect_characters}
                        <span className="text-slate-500"> / {att.incorrect_characters}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {att.qualified ? (
                          <span className="inline-flex items-center text-emerald-600 text-[11px] font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            YES
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-red-600 text-[11px] font-semibold">
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
        <div className="pt-3 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 shrink-0">
          <span>Total attempts: {attempts.length}</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-medium text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
