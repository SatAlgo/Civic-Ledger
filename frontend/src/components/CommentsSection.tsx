'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  Send,
  Image as ImageIcon,
  X,
  Trash2,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import { api, getToken } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useSocket } from '@/hooks/useSocket';
import type { Comment } from '@/lib/types';

interface Props {
  issueId: string;
  // Allow detail pages to receive the running count to update sidebars, etc.
  onCountChange?: (n: number) => void;
}

export function CommentsSection({ issueId, onCountChange }: Props) {
  const user = useAuthStore((s) => s.user);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load
  useEffect(() => {
    let cancelled = false;
    api<{ comments: Comment[] }>(`/api/issues/${issueId}/comments`)
      .then((res) => {
        if (cancelled) return;
        setComments(res.comments);
        onCountChange?.(res.comments.length);
      })
      .catch(() => toast.error('Could not load comments'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId]);

  // Live updates via Socket.IO
  useSocket((socket) => {
    socket.emit('join:issue', issueId);

    const onCommented = (data: { issueId: string; comment: Comment }) => {
      if (data.issueId !== issueId) return;
      setComments((prev) => {
        if (prev.some((c) => c._id === data.comment._id)) return prev;
        const next = [data.comment, ...prev];
        onCountChange?.(next.length);
        return next;
      });
    };
    const onDeleted = (data: { issueId: string; commentId: string }) => {
      if (data.issueId !== issueId) return;
      setComments((prev) => {
        const next = prev.filter((c) => c._id !== data.commentId);
        onCountChange?.(next.length);
        return next;
      });
    };

    socket.on('issue:commented', onCommented);
    socket.on('comment:deleted', onDeleted);

    return () => {
      socket.emit('leave:issue', issueId);
      socket.off('issue:commented', onCommented);
      socket.off('comment:deleted', onDeleted);
    };
  });

  // Manage photo preview lifecycle
  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) {
      toast.error('Photo must be under 8MB');
      return;
    }
    setPhoto(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Sign in to comment');
      return;
    }
    const trimmed = body.trim();
    if (trimmed.length < 1) return;

    setPosting(true);
    try {
      // Use fetch directly so we can send multipart when there's a photo
      const fd = new FormData();
      fd.append('body', trimmed);
      if (photo) fd.append('photo', photo);

      const token = getToken();
      const base = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${base}/api/issues/${issueId}/comments`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Comment failed');
      }
      const data = (await res.json()) as { comment: Comment };

      // Insert at top if socket hasn't already done so
      setComments((prev) => {
        if (prev.some((c) => c._id === data.comment._id)) return prev;
        const next = [data.comment, ...prev];
        onCountChange?.(next.length);
        return next;
      });
      setBody('');
      setPhoto(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not post comment');
    } finally {
      setPosting(false);
    }
  };

  const deleteComment = async (c: Comment) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await api(`/api/issues/${issueId}/comments/${c._id}`, { method: 'DELETE' });
      setComments((prev) => {
        const next = prev.filter((x) => x._id !== c._id);
        onCountChange?.(next.length);
        return next;
      });
    } catch (err: any) {
      toast.error(err?.message ?? 'Delete failed');
    }
  };

  return (
    <section>
      <div className="plate mb-4 flex items-center gap-2">
        <MessageSquare size={12} />
        Discussion · {comments.length}
      </div>

      {/* Composer */}
      {user ? (
        <form onSubmit={submit} className="card mb-6 space-y-3">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share an update, ask a question, or add context…"
            className="input min-h-[80px] resize-y"
            maxLength={1000}
          />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="btn-ghost text-xs"
              >
                <ImageIcon size={12} />
                {photo ? photo.name.slice(0, 24) : 'Add photo'}
              </button>
              {photo && (
                <button
                  type="button"
                  onClick={() => {
                    setPhoto(null);
                    if (fileRef.current) fileRef.current.value = '';
                  }}
                  className="btn-ghost text-xs text-signal-rust"
                  title="Remove photo"
                >
                  <X size={12} />
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={onPickFile}
                className="hidden"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="plate">{body.length}/1000</span>
              <button
                type="submit"
                disabled={posting || body.trim().length < 1}
                className="btn-primary text-xs"
              >
                {posting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Send size={12} />
                )}
                {posting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
          {photoPreview && (
            <div className="w-24 h-24 border border-ink/15 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
            </div>
          )}
        </form>
      ) : (
        <div className="card mb-6 text-center text-sm text-ink/60">
          <a href="/login" className="text-signal-rust hover:underline">Sign in</a> to join the discussion.
        </div>
      )}

      {/* Comment list */}
      {loading ? (
        <div className="text-center py-10 text-ink/40">
          <Loader2 size={20} className="animate-spin mx-auto" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-ink/15">
          <p className="font-display text-lg mb-1">No comments yet.</p>
          <p className="text-xs text-ink/50">Be the first to weigh in.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => {
            const canDelete =
              user &&
              (user._id === c.user?._id || user.role === 'super_admin');
            return (
              <li key={c._id} className="card">
                <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-sm">
                      {c.user?.displayName ?? 'Citizen'}
                    </span>
                    {c.user?.role === 'department_admin' && (
                      <span className="badge bg-signal-rust text-paper text-[9px]">
                        Department
                      </span>
                    )}
                    {c.user?.role === 'super_admin' && (
                      <span className="badge bg-ink text-paper text-[9px]">
                        Super-admin
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono text-ink/50">
                    <span>
                      {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                    </span>
                    {canDelete && (
                      <button
                        onClick={() => deleteComment(c)}
                        className="hover:text-signal-rust"
                        aria-label="Delete comment"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
                {c.isHidden ? (
                  <p className="text-sm italic text-ink/40">
                    [hidden by moderators]
                  </p>
                ) : (
                  <>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{c.body}</p>
                    {c.photo && (
                      <a
                        href={c.photo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 block w-32 h-32 overflow-hidden border border-ink/15"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={c.photo}
                          alt="comment attachment"
                          className="w-full h-full object-cover hover:scale-105 transition-transform"
                        />
                      </a>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
