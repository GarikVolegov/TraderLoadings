import { useLocation } from "wouter";
import { TrendingUp, BarChart2, Shield, Zap } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const features = [
  {
    icon: TrendingUp,
    title: "Live Market Intelligence",
    desc: "Real-time news, macro analysis, and sentiment tracking across all major pairs.",
  },
  {
    icon: BarChart2,
    title: "Advanced Trading Journal",
    desc: "Log trades, track performance, and analyse patterns with detailed analytics.",
  },
  {
    icon: Shield,
    title: "Risk Management Tools",
    desc: "Lot calculator, session clock, and economic calendar — all in one place.",
  },
  {
    icon: Zap,
    title: "Gamified Progress",
    desc: "Earn XP, level up, and stay accountable with daily missions and streaks.",
  },
];

export default function LandingPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[hsl(224,71%,4%)] text-[#d8e3f0] flex flex-col">
      <header className="flex items-center justify-between px-8 py-5 border-b border-[#1d2d44]">
        <div className="flex items-center gap-3">
          <img src={`${basePath}/logo.svg`} alt="TraderLoading" className="w-9 h-9" />
          <span className="text-lg font-bold tracking-tight">
            TRADER<span className="text-[#00cc66]">LOADING</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/sign-in")}
            className="text-sm font-medium text-[#7d90a7] hover:text-[#d8e3f0] transition-colors px-4 py-2"
          >
            Sign In
          </button>
          <button
            onClick={() => setLocation("/sign-up")}
            className="text-sm font-semibold bg-[#00cc66] text-[#031a0d] hover:bg-[#00e673] transition-colors px-5 py-2 rounded-lg"
          >
            Get Started
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-[#0d1f10] border border-[#00cc66]/30 text-[#00cc66] text-xs font-semibold px-3 py-1.5 rounded-full mb-8">
          <span className="w-1.5 h-1.5 bg-[#00cc66] rounded-full animate-pulse" />
          Professional Trading Dashboard
        </div>

        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-tight max-w-3xl mb-6">
          Trade Smarter,{" "}
          <span className="text-[#00cc66]">Not Harder</span>
        </h1>

        <p className="text-lg text-[#7d90a7] max-w-xl mb-10 leading-relaxed">
          Your all-in-one trading companion — journal your trades, track macro
          news, manage risk, and level up your discipline every single day.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={() => setLocation("/sign-up")}
            className="w-full sm:w-auto text-base font-semibold bg-[#00cc66] text-[#031a0d] hover:bg-[#00e673] transition-colors px-8 py-3.5 rounded-xl shadow-lg shadow-[#00cc66]/20"
          >
            Start for Free
          </button>
          <button
            onClick={() => setLocation("/sign-in")}
            className="w-full sm:w-auto text-base font-medium border border-[#1d2d44] hover:border-[#00cc66]/40 text-[#d8e3f0] hover:text-white transition-colors px-8 py-3.5 rounded-xl"
          >
            I already have an account
          </button>
        </div>
      </main>

      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-5">
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="bg-[#07111f] border border-[#1d2d44] rounded-2xl p-6 text-left hover:border-[#00cc66]/30 transition-colors"
            >
              <div className="w-10 h-10 bg-[#0d1f10] rounded-xl flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-[#00cc66]" />
              </div>
              <h3 className="font-semibold text-[#d8e3f0] mb-1.5">{title}</h3>
              <p className="text-sm text-[#7d90a7] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-[#1d2d44] py-6 text-center text-xs text-[#7d90a7]">
        © {new Date().getFullYear()} TraderLoading. All rights reserved.
      </footer>
    </div>
  );
}
