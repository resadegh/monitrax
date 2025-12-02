const testimonials = [
  {
    quote: "The first app that treats my home and investments as one strategy.",
    author: "Chris",
    location: "Melbourne",
  },
  {
    quote: "I went from spreadsheets to having a clear 10-year plan in a weekend.",
    author: "Sarah",
    location: "Sydney",
  },
  {
    quote: "Seeing how extra repayments compare to investing changed how I use my offset account.",
    author: "James",
    location: "Brisbane",
  },
  {
    quote: "Finally, software that understands negative gearing properly.",
    author: "Emma",
    location: "Perth",
  },
  {
    quote: "The forecasting is incredible — I can see exactly when I'll be debt-free.",
    author: "Michael",
    location: "Adelaide",
  },
];

export function Testimonials() {
  return (
    <section className="py-16 sm:py-24 bg-neutral-50 dark:bg-neutral-900/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Trusted by wealth builders across Australia
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Join thousands who are taking control of their financial future.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="relative rounded-2xl border bg-card p-6 shadow-sm"
            >
              {/* Quote icon */}
              <svg
                className="absolute top-4 right-4 h-8 w-8 text-brand-secondary/10"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
              </svg>

              <blockquote className="text-lg leading-relaxed mb-4">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>

              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-brand-secondary/10 flex items-center justify-center">
                  <span className="text-sm font-semibold text-brand-secondary">
                    {testimonial.author.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-medium">{testimonial.author}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.location}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
