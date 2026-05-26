'use client';

import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { ArrowRight, MapPin, Building2, Bell } from 'lucide-react';

export default function Home() {
  return (
    <>
      <Navbar />

      {/* Hero */}
      <section className="container-civic pt-20 pb-24 relative">
        <div className="grid md:grid-cols-12 gap-8 items-end">
          <div className="md:col-span-7">
            <div className="plate mb-6">No. 001 / Public Service Infrastructure / Est. 2026</div>
            <h1 className="font-display text-6xl md:text-7xl leading-[0.95] tracking-tight">
              A public ledger
              <br />
              for the things
              <br />
              <span className="italic text-signal-rust">your city forgot</span>.
            </h1>
            <p className="mt-8 text-lg text-ink/70 max-w-xl leading-relaxed">
              Report potholes, broken streetlights, drainage failures, and electrical hazards.
              We route them to the right department, in writing, on the record.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/signup" className="btn-primary">
                Report an issue <ArrowRight size={16} />
              </Link>
              <Link href="/dept/register" className="btn-secondary">
                Register a department
              </Link>
            </div>
          </div>

          {/* Editorial right column */}
          <div className="md:col-span-5">
            <div className="border border-ink/15 p-8 bg-paper-soft relative">
              <div className="plate mb-4">Currently on file</div>
              <div className="space-y-4">
                <div className="flex justify-between items-baseline">
                  <span className="font-display text-4xl">2,481</span>
                  <span className="plate">issues reported</span>
                </div>
                <div className="rule" />
                <div className="flex justify-between items-baseline">
                  <span className="font-display text-4xl">1,902</span>
                  <span className="plate">resolved</span>
                </div>
                <div className="rule" />
                <div className="flex justify-between items-baseline">
                  <span className="font-display text-4xl">37</span>
                  <span className="plate">departments active</span>
                </div>
              </div>
              <div className="absolute -top-3 -right-3 w-6 h-6 bg-signal-rust" />
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-ink/10 bg-paper-soft py-20">
        <div className="container-civic">
          <div className="plate mb-2">No. 002 / Method</div>
          <h2 className="font-display text-4xl md:text-5xl mb-12 max-w-2xl">
            Three steps. No bureaucracy in between.
          </h2>

          <div className="grid md:grid-cols-3 gap-10">
            <Step
              number="01"
              icon={<MapPin />}
              title="You report it"
              desc="Pin the location. Snap a photo. Pick a category. Submit in under thirty seconds."
            />
            <Step
              number="02"
              icon={<Building2 />}
              title="We route it"
              desc="Based on category and ward, the system assigns it to a verified department automatically."
            />
            <Step
              number="03"
              icon={<Bell />}
              title="You watch it move"
              desc="Live updates as it's assigned, picked up, and resolved. Every status change, on the record."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container-civic py-12 flex flex-wrap justify-between items-end gap-6 border-t border-ink/10 mt-20">
        <div>
          <div className="font-display text-2xl">Civic Ledger</div>
          <div className="plate mt-1">A public registry of civic reports</div>
        </div>
        <div className="plate">© 2026 / Open source / Built for cities</div>
      </footer>
    </>
  );
}

function Step({
  number,
  icon,
  title,
  desc,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="font-mono text-2xl text-signal-rust">{number}</span>
        <span className="text-ink/60">{icon}</span>
      </div>
      <h3 className="font-display text-2xl mb-2">{title}</h3>
      <p className="text-ink/70 leading-relaxed">{desc}</p>
    </div>
  );
}
