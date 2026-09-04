export function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-cyan-200">
          Legal &amp; simple downloads
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
          Download your media, simply.
        </h1>
        <p className="mt-5 text-base text-slate-300 sm:text-lg">
          Paste a supported URL and select a format that is technically and legally permitted for download.
        </p>
      </div>
    </section>
  );
}
