export function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-6 pt-6 sm:px-6 sm:pb-10 sm:pt-10 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-cyan-200 sm:mb-6">
          Legal &amp; simple downloads
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
          Download your media, simply.
        </h1>
        <p className="mt-3 text-sm text-slate-300 sm:mt-5 sm:text-lg">
          Paste a supported URL and select a format that is technically and legally permitted for download.
        </p>
      </div>
    </section>
  );
}
