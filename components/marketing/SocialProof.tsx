export function SocialProof() {
  return (
    <section className="border-y border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="py-8 sm:py-12">
          <div className="flex flex-col items-center gap-6 text-center md:flex-row md:justify-between md:text-left">
            {/* Trust badges */}
            <div className="flex flex-wrap justify-center gap-4 md:gap-6">
              <div className="flex items-center gap-2 rounded-full bg-background px-4 py-2 text-sm font-medium shadow-sm border">
                <svg className="h-4 w-4 text-brand-secondary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Built for Australian wealth builders
              </div>
              <div className="flex items-center gap-2 rounded-full bg-background px-4 py-2 text-sm font-medium shadow-sm border">
                <svg className="h-4 w-4 text-brand-secondary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Long-term property & portfolio planning
              </div>
            </div>

            {/* Featured quote */}
            <div className="max-w-md">
              <blockquote className="text-sm italic text-muted-foreground">
                &ldquo;Monitrax is the first tool that actually understands my properties, loans, super and ETFs in one place.&rdquo;
              </blockquote>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
