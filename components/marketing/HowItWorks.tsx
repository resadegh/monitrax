'use client';

/**
 * Public-site marketing — "Three steps to one clean picture."
 *
 * Phase 48 PR 4 (2026-05-26). Built from the Stitch `five-and-how` canonical
 * screen, section 2. Three numbered steps explaining the user flow: Add
 * → See → Model. The Stitch source had AI-generated stock photos for each
 * step; we replaced those with abstract cosmos-glass visualization panels
 * for three reasons:
 *   1. AI-stock-photo aesthetic doesn't match the restraint discipline
 *      (CLAUDE.md §0 designer lens — premium fintech reference is
 *      Mercury / Linear / Stripe, none of which use stock photos).
 *   2. Zero asset weight added to the bundle vs ~150KB for 3 images.
 *   3. Abstract panels are cheaper to iterate on than re-generating
 *      photos.
 *
 * Strategic discipline (CLAUDE.md §0 financial-adviser + AFSL lens):
 *   - Step 3 copy reads "We show the scenarios. You decide. We do not
 *     recommend products." — explicit AFSL boundary statement per
 *     Phase 46 §9 + the locked positioning DNA. Do NOT soften.
 *
 * Composes: cosmos-* tokens + TRAIL stage hue tokens (PR 1), `Reveal`.
 */

import { Reveal } from './animations';

type Step = {
  number: '01' | '02' | '03';
  title: string;
  description: string;
  panel: React.ComponentType;
};

const STEPS: readonly Step[] = [
  {
    number: '01',
    title: 'Add your picture.',
    description:
      "Manual entry or CSV import. Property, loans, super, investments, cashflow, entities. Live bank connections via CDR are in development.",
    panel: AddPanel,
  },
  {
    number: '02',
    title: 'See where you stand.',
    description:
      'Net worth, cashflow, debt, buffers, asset position — together, not in five tabs. Read by one engine, surfaced as one view.',
    panel: SeePanel,
  },
  {
    number: '03',
    title: 'Model the levers.',
    description:
      'Adjust assumptions, see what changes across the whole picture. We show the scenarios. You decide. We do not recommend products.',
    panel: ModelPanel,
  },
] as const;

export function HowItWorks() {
  return (
    <section
      aria-label="How it works — three steps"
      className="bg-cosmos-deeper/40 py-24 md:py-32"
    >
      <div className="mx-auto max-w-7xl px-6">
        <Reveal>
          <div className="mb-16 text-center md:mb-20">
            <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.4em] text-cosmos-muted">
              How it works
            </p>
            <h2 className="text-balance text-3xl font-semibold tracking-tight text-cosmos sm:text-4xl lg:text-[44px]">
              Three steps to one clean picture.
            </h2>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-10 lg:gap-16">
          {STEPS.map(({ number, title, description, panel: Panel }, i) => (
            <Reveal key={number} delay={i * 0.1}>
              <div className="group">
                <div className="mb-8 aspect-[4/3] overflow-hidden rounded-xl border border-cosmos-hairline bg-cosmos-surface/50">
                  <Panel />
                </div>
                <div className="flex gap-4">
                  <span className="text-2xl font-semibold text-cosmos-action/40 transition-colors group-hover:text-cosmos-action">
                    {number}
                  </span>
                  <div>
                    <h3 className="mb-3 text-xl font-semibold leading-snug text-cosmos">
                      {title}
                    </h3>
                    <p className="text-base leading-relaxed text-cosmos-soft">
                      {description}
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Step panels — abstract cosmos-glass visualizations.                       */
/*  Each panel is a 4:3 self-contained illustration. No external assets.      */
/* -------------------------------------------------------------------------- */

function AddPanel() {
  // Stylised entry tiles being placed into a stack.
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 30% 40%, hsl(var(--cosmos-track) / 0.10), transparent 60%)',
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative h-32 w-32">
          <div className="absolute inset-0 rounded-2xl border border-cosmos-track/40 bg-cosmos-track/5 shadow-[0_8px_24px_rgba(0,0,0,0.4)] -rotate-6" />
          <div className="absolute inset-2 rounded-2xl border border-cosmos-track/40 bg-cosmos-surface shadow-[0_8px_24px_rgba(0,0,0,0.4)] -rotate-3" />
          <div className="absolute inset-4 rounded-2xl border border-cosmos-track/40 bg-cosmos-elevated shadow-[0_8px_24px_rgba(0,0,0,0.5)]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-7 w-7 text-cosmos-track"
              aria-hidden="true"
            >
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function SeePanel() {
  // Stylised converging-lines view of the engine.
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at center, hsl(var(--cosmos-action) / 0.12), transparent 65%)',
        }}
      />
      <svg
        viewBox="0 0 200 150"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="line-fade" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--cosmos-action))" stopOpacity="0" />
            <stop offset="50%" stopColor="hsl(var(--cosmos-action))" stopOpacity="0.7" />
            <stop offset="100%" stopColor="hsl(var(--cosmos-action))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Four diagonal converging lines */}
        <line x1="10" y1="20" x2="100" y2="75" stroke="url(#line-fade)" strokeWidth="1" />
        <line x1="190" y1="20" x2="100" y2="75" stroke="url(#line-fade)" strokeWidth="1" />
        <line x1="10" y1="130" x2="100" y2="75" stroke="url(#line-fade)" strokeWidth="1" />
        <line x1="190" y1="130" x2="100" y2="75" stroke="url(#line-fade)" strokeWidth="1" />
        {/* Central node */}
        <circle cx="100" cy="75" r="6" fill="hsl(var(--cosmos-action))" />
        <circle
          cx="100"
          cy="75"
          r="14"
          fill="none"
          stroke="hsl(var(--cosmos-action))"
          strokeWidth="1"
          opacity="0.4"
        />
        <circle
          cx="100"
          cy="75"
          r="24"
          fill="none"
          stroke="hsl(var(--cosmos-action))"
          strokeWidth="1"
          opacity="0.2"
        />
      </svg>
    </div>
  );
}

function ModelPanel() {
  // Stylised lever slider visualizing scenario modelling.
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 70% 50%, hsl(var(--cosmos-live) / 0.10), transparent 60%)',
        }}
      />
      <div className="absolute inset-0 flex flex-col justify-center gap-4 p-8">
        {[60, 75, 40].map((width, i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-between text-[10px] font-medium uppercase tracking-wide text-cosmos-muted">
              <span>{['Cashflow', 'Tax', 'Liquidity'][i]}</span>
              <span className="text-cosmos-soft">{width}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-cosmos-hairline">
              <div
                className="h-full rounded-full bg-cosmos-action"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
