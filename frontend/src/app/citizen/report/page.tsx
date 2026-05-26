'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { Camera, Crosshair, X, ArrowRight, Loader2 } from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';
import { CATEGORY_LABELS, type Category } from '@/lib/types';
import { useGeolocation } from '@/hooks/useGeolocation';
import { api, getToken } from '@/lib/api';

const LocationPicker = dynamic(() => import('@/components/LocationPicker'), {
  ssr: false,
  loading: () => <div className="h-[320px] bg-paper-soft animate-pulse" />,
});

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];

export default function ReportPage() {
  return (
    <RoleGuard allowed={['citizen']}>
      <ReportForm />
    </RoleGuard>
  );
}

function ReportForm() {
  const router = useRouter();
  const geo = useGeolocation();
  const [category, setCategory] = useState<Category | ''>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Auto-fetch location on mount
  useEffect(() => {
    geo.fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manage preview URLs
  useEffect(() => {
    const urls = photos.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [photos]);

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fs = Array.from(e.target.files ?? []).slice(0, 5 - photos.length);
    setPhotos((p) => [...p, ...fs]);
  };

  const submit = async () => {
    if (!category) return toast.error('Pick a category');
    if (title.length < 5) return toast.error('Give your issue a short title');
    if (description.length < 10) return toast.error('Add a sentence of description');
    if (!geo.position) return toast.error('Location required — tap the crosshair');

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('description', description);
      fd.append('category', category);
      fd.append('lat', String(geo.position.lat));
      fd.append('lng', String(geo.position.lng));
      photos.forEach((p) => fd.append('photos', p));

      // FormData uses a different api flow (no JSON content-type)
      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ''}/api/issues`,
        {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Submission failed (${res.status})`);
      }
      const data = await res.json();
      toast.success('Reported. Routing to the right department now.');
      const id = data._id || data.issue?._id;
      router.push(id ? `/citizen/issues/${id}` : '/citizen');
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not submit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="container-civic py-12 max-w-5xl">
      <div className="flex items-baseline justify-between mb-2">
        <div className="plate">No. 008 / New Report</div>
        <div className="plate text-signal-rust">Draft</div>
      </div>
      <h1 className="font-display text-5xl mb-3">File a report.</h1>
      <p className="text-ink/70 mb-12 max-w-xl">
        Four quick things. We&apos;ll route it to the right department automatically.
      </p>

      <div className="grid lg:grid-cols-5 gap-10 lg:gap-16">
        {/* LEFT: form */}
        <div className="lg:col-span-3 space-y-12">
          {/* 1. Category */}
          <Section num="01" title="What kind of issue?">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`p-4 border-2 text-left transition-all ${
                    category === c
                      ? 'border-signal-rust bg-signal-rust/5'
                      : 'border-ink/15 hover:border-ink/40'
                  }`}
                >
                  <div className="text-sm font-medium leading-tight">
                    {CATEGORY_LABELS[c]}
                  </div>
                </button>
              ))}
            </div>
          </Section>

          {/* 2. Details */}
          <Section num="02" title="Tell us more">
            <div className="space-y-6">
              <div>
                <label className="label">Title</label>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Large pothole near Subhash Chowk"
                  maxLength={100}
                />
                <p className="text-xs text-ink/50 mt-1 font-mono">{title.length}/100</p>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  className="input min-h-[120px]"
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Where exactly is it? How bad? Has anyone been hurt?"
                  maxLength={500}
                />
                <p className="text-xs text-ink/50 mt-1 font-mono">{description.length}/500</p>
              </div>
            </div>
          </Section>

          {/* 3. Photos */}
          <Section num="03" title="Photos (up to 5)">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {previews.map((src, i) => (
                <div key={i} className="relative aspect-square bg-paper-warm group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 bg-ink text-paper p-1 opacity-0 group-hover:opacity-100 transition"
                    aria-label="Remove"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {photos.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="aspect-square border-2 border-dashed border-ink/30 hover:border-signal-rust flex flex-col items-center justify-center gap-1 text-ink/60 hover:text-signal-rust transition"
                >
                  <Camera size={20} />
                  <span className="text-xs font-mono">Add</span>
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={onPickFiles}
              className="hidden"
            />
          </Section>
        </div>

        {/* RIGHT: location & submit */}
        <div className="lg:col-span-2 lg:sticky lg:top-24 self-start space-y-6">
          <Section num="04" title="Pin the location">
            <div className="w-full h-[320px] border-2 border-ink/15 overflow-hidden">
              {geo.position ? (
                <LocationPicker
                  lat={geo.position.lat}
                  lng={geo.position.lng}
                  onChange={(lat, lng) =>
                    geo.setPosition({ lat, lng, accuracy: geo.position?.accuracy || 0 })
                  }
                  height="320px"
                />
              ) : (
                <div className="h-full flex items-center justify-center bg-paper-soft">
                  {geo.loading ? (
                    <Loader2 className="animate-spin text-ink/40" />
                  ) : (
                    <span className="plate">Click below to locate</span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="font-mono text-xs text-ink/60">
                {geo.position
                  ? `${geo.position.lat.toFixed(5)}, ${geo.position.lng.toFixed(5)}`
                  : geo.loading
                  ? 'Locating…'
                  : 'No location set'}
              </div>
              <button
                type="button"
                onClick={geo.fetch}
                disabled={geo.loading}
                className="flex items-center gap-1.5 text-xs font-medium hover:text-signal-rust transition disabled:opacity-50"
              >
                {geo.loading ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Crosshair size={12} />
                )}
                Use my location
              </button>
            </div>
            {geo.error && <p className="text-xs text-signal-rust mt-1">{geo.error}</p>}
            <p className="text-xs text-ink/60 mt-2">Tap or drag the pin to adjust.</p>
          </Section>

          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="btn-rust w-full py-3.5 text-base"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Submitting…
              </>
            ) : (
              <>
                Submit report <ArrowRight size={18} />
              </>
            )}
          </button>

          <p className="plate text-center">By submitting, you confirm this report is accurate.</p>
        </div>
      </div>
    </main>
  );
}

function Section({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-3 mb-5">
        <span className="font-mono text-sm text-signal-rust">{num}</span>
        <h2 className="font-display text-2xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}
