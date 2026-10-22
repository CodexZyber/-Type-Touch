'use client';

import React, { useState } from 'react';
import { Participant } from '@/types';
import { PARTICIPANT_STORAGE_KEY } from '@/lib/utils/participant-session';
import { AlertCircle, ArrowRight, X } from 'lucide-react';

const SESSION_STORAGE_KEY = 'tensor_mactober_session_id';

interface RegisterModalProps {
  eventId?: string;
  onRegistered: (participant: Participant) => void;
  onClose?: () => void;
}

/**
 * Minimal candidate sign-in: name + student ID. No password; the participant
 * record is stored in the browser and re-validated against the server.
 */
export default function RegisterModal({ eventId, onRegistered, onClose }: RegisterModalProps) {
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !studentId.trim()) {
      setError('Please enter your full name and student ID.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      let sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!sessionId) {
        sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
      }

      const res = await fetch('/api/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          name: name.trim(),
          studentId: studentId.trim(),
          sessionId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Registration failed');
      }

      localStorage.setItem(PARTICIPANT_STORAGE_KEY, JSON.stringify(data.participant));
      onRegistered(data.participant);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-2xl p-7 bg-white border border-slate-200 shadow-card-lg relative">
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <span className="ts-eyebrow block mb-2">Enter the contest</span>
        <h3 className="text-xl font-bold text-slate-900 mb-1">Who&apos;s typing?</h3>
        <p className="text-sm text-slate-500 mb-5">Your scores are tracked by student ID.</p>

        {error && (
          <div className="p-3 mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="ts-label" htmlFor="reg-name">
              Full name
            </label>
            <input
              id="reg-name"
              type="text"
              required
              autoFocus
              autoComplete="name"
              placeholder="e.g. Arya Sovakar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="ts-input"
            />
          </div>

          <div>
            <label className="ts-label" htmlFor="reg-student-id">
              Student ID
            </label>
            <input
              id="reg-student-id"
              type="text"
              required
              autoComplete="off"
              placeholder="e.g. TS-101"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="ts-input font-mono uppercase"
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            <span>{submitting ? 'Joining…' : 'Enter Contest Arena'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-[11px] text-center text-slate-400">
            No password needed. Your session is saved on this device.
          </p>
        </form>
      </div>
    </div>
  );
}
