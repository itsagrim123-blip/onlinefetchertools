import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ToolCatalog } from "@/components/tools/ToolCatalog";

export default function Home() {
  return (
    <main className="min-h-screen w-full max-w-full overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_35%),linear-gradient(180deg,#020817_0%,#0f172a_100%)] text-slate-100">
      <Header />
      <section className="mx-auto max-w-7xl w-full px-4 pb-10 pt-10 text-center sm:px-6 sm:pb-16 sm:pt-20 lg:px-8 lg:pt-28">
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 sm:mb-6 inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[11px] sm:text-xs font-medium uppercase tracking-[0.18em] text-cyan-200">
            One calm workspace for your files
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-6xl break-words">
            Everything you need for your <span className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">files and media.</span>
          </h1>
          <p className="mx-auto mt-4 sm:mt-6 max-w-2xl text-sm sm:text-lg leading-6 sm:leading-7 text-slate-300">
            Download, convert, compress and manage — all in one place.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl w-full px-4 pb-16 sm:pb-20 sm:px-6 lg:px-8"><ToolCatalog /></section>
      <Footer />
    </main>
  );
}
