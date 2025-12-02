export function ForecastSection() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          {/* Left - Copy */}
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              See the future of your wealth
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Project your cash balance, net worth and equity month-by-month for up to 30 years.
              Make decisions with confidence knowing exactly where you&apos;re headed.
            </p>

            <ul className="mt-8 space-y-4">
              <li className="flex items-start gap-3">
                <svg className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-muted-foreground">
                  Build and compare multiple strategy timelines side by side
                </span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-muted-foreground">
                  Stress-test rate rises, rent changes and contribution tweaks
                </span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-muted-foreground">
                  See exactly when you&apos;ll hit key milestones like debt-free or $1M net worth
                </span>
              </li>
            </ul>
          </div>

          {/* Right - Chart visualization */}
          <div className="relative">
            <div className="rounded-2xl border bg-card p-6 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold">Net Worth Projection</h3>
                  <p className="text-sm text-muted-foreground">30-year forecast</p>
                </div>
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-primary" />
                    <span className="text-muted-foreground">Projected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-primary/30" />
                    <span className="text-muted-foreground">Range</span>
                  </div>
                </div>
              </div>

              {/* SVG Chart */}
              <div className="relative h-64">
                <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                  {/* Grid lines */}
                  <g className="text-muted stroke-current opacity-20">
                    <line x1="0" y1="50" x2="400" y2="50" strokeWidth="1" />
                    <line x1="0" y1="100" x2="400" y2="100" strokeWidth="1" />
                    <line x1="0" y1="150" x2="400" y2="150" strokeWidth="1" />
                  </g>

                  {/* Confidence band */}
                  <path
                    d="M0,180 Q100,160 200,120 T400,40 L400,60 Q300,100 200,140 T0,190 Z"
                    className="fill-primary/10"
                  />

                  {/* Main projection line */}
                  <path
                    d="M0,185 Q50,175 100,160 T200,130 T300,80 T400,50"
                    className="stroke-primary fill-none"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />

                  {/* Data points */}
                  <circle cx="0" cy="185" r="4" className="fill-primary" />
                  <circle cx="100" cy="160" r="4" className="fill-primary" />
                  <circle cx="200" cy="130" r="4" className="fill-primary" />
                  <circle cx="300" cy="80" r="4" className="fill-primary" />
                  <circle cx="400" cy="50" r="4" className="fill-primary" />
                </svg>

                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-muted-foreground py-2">
                  <span>$3M</span>
                  <span>$2M</span>
                  <span>$1M</span>
                  <span>$0</span>
                </div>

                {/* X-axis labels */}
                <div className="absolute bottom-0 left-8 right-0 flex justify-between text-xs text-muted-foreground">
                  <span>Today</span>
                  <span>10yr</span>
                  <span>20yr</span>
                  <span>30yr</span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
                <div>
                  <p className="text-sm text-muted-foreground">Today</p>
                  <p className="text-lg font-semibold">$450K</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">10 Years</p>
                  <p className="text-lg font-semibold text-primary">$1.2M</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">30 Years</p>
                  <p className="text-lg font-semibold text-primary">$2.8M</p>
                </div>
              </div>
            </div>

            {/* Decorative blur */}
            <div className="absolute -z-10 -top-8 -right-8 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
          </div>
        </div>
      </div>
    </section>
  );
}
