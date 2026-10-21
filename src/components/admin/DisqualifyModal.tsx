'use client';

import React, { useState } from 'react';
import { Participant } from '@/types';
import { AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface DisqualifyModalProps {
  participant: Participant | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DisqualifyModal({
  participant,
  onClose,
  onSuccess,
}: DisqualifyModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!participant) return null;

  const isAlreadyDisqualified = participant.disqualified;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAlreadyDisqualified && !reason.trim()) {
      setError('Please provide a reason for disqualification.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/participants/disqualify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: participant.id,
          disqualified: !isAlreadyDisqualified,
          reason: isAlreadyDisqualified ? null : reason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update disqualification status');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md rounded-2xl p-6 glass-panel-glow border border-red-500/30 shadow-apple-card relative">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              {isAlreadyDisqualified ? 'Reverse Disqualification' : 'Disqualify Participant'}
            </h3>
            <p className="text-xs text-zinc-400">
              {participant.name} ({participant.student_id})
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-lg bg-red-950/60 border border-red-500/30 text-red-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isAlreadyDisqualified ? (
            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to reinstate this participant? Their qualifying attempts will once again appear on the public leaderboard.
            </p>
          ) : (
            <>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Disqualifying will immediately remove this participant from the public leaderboard. All their previous attempts will be preserved in the database for auditing.
              </p>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Reason for Disqualification <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Scripting / External macro detected / Multiple tab violation"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-red-500 resize-none"
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white glass-panel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition-colors ${
                isAlreadyDisqualified
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : 'bg-red-600 hover:bg-red-500'
              }`}
            >
              {submitting
                ? 'Processing...'
                : isAlreadyDisqualified
                ? 'Reinstate Participant'
                : 'Confirm Disqualification'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
