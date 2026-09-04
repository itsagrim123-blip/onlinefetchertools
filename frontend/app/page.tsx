import { DownloaderCard } from "@/components/DownloaderCard";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_35%),linear-gradient(180deg,#020817_0%,#0f172a_100%)] text-slate-100">
      <Header />
      <Hero />
      <DownloaderCard />
      <Footer />
    </main>
  );
}
