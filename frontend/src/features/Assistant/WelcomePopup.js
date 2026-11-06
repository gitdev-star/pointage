import { useEffect, useState } from "react";

const GRADIENT = "linear-gradient(135deg, #2563eb, #7c3aed)";
const CONIC = "conic-gradient(from 0deg, #2563eb, #7c3aed, #06b6d4, #2563eb)";
const SPARKS = [
  { top: -6, right: -8, size: 16, d: 0 },
  { top: 30, right: -24, size: 11, d: 0.6 },
  { top: -12, left: 4, size: 11, d: 1.2 },
  { bottom: -4, left: -16, size: 14, d: 1.8 },
];

// only transform and opacity are animated: they run on the GPU even while the page is busy
const CSS = `
@keyframes aw-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes aw-unfade { to { opacity: 0 } }
@keyframes aw-pop { from { opacity: 0; transform: translateY(40px) scale(.9) } to { opacity: 1; transform: none } }
@keyframes aw-leave { to { opacity: 0; transform: translateY(16px) scale(.96) } }
@keyframes aw-rise { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
@keyframes aw-float { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
@keyframes aw-spin { to { transform: rotate(360deg) } }
@keyframes aw-wave { 0% { transform: scale(1); opacity: .55 } 100% { transform: scale(1.9); opacity: 0 } }
@keyframes aw-orb1 { 0%, 100% { transform: translate3d(0, 0, 0) } 50% { transform: translate3d(50px, 30px, 0) } }
@keyframes aw-orb2 { 0%, 100% { transform: translate3d(0, 0, 0) } 50% { transform: translate3d(-44px, -26px, 0) } }
@keyframes aw-twinkle { 0%, 100% { transform: scale(.3); opacity: 0 } 50% { transform: scale(1); opacity: 1 } }
@keyframes aw-sweep { from { transform: translateX(-120%) skewX(-20deg) } to { transform: translateX(420%) skewX(-20deg) } }
@keyframes aw-card-shine { 0% { transform: translateX(-150%) skewX(-20deg) } 45%, 100% { transform: translateX(900%) skewX(-20deg) } }
@keyframes aw-dot { 0%, 80%, 100% { transform: scale(.5); opacity: .4 } 40% { transform: scale(1); opacity: 1 } }
@keyframes aw-d-q { 0%, 3% { opacity: 0; transform: translateY(6px) } 8%, 90% { opacity: 1; transform: none } 96%, 100% { opacity: 0; transform: none } }
@keyframes aw-d-think { 0%, 14% { opacity: 0 } 18%, 34% { opacity: 1 } 38%, 100% { opacity: 0 } }
@keyframes aw-d-row { 0%, 38% { opacity: 0; transform: translateX(-12px) } 44%, 90% { opacity: 1; transform: none } 96%, 100% { opacity: 0; transform: none } }
@keyframes aw-d-csv { 0%, 62% { opacity: 0 } 68%, 90% { opacity: 1 } 96%, 100% { opacity: 0 } }
.aw-fade { animation: aw-fade .3s ease-out both }
.aw-pop { animation: aw-pop .6s cubic-bezier(.2, .9, .3, 1.15) .2s both }
.aw-rise { animation: aw-rise .5s ease-out both }
.aw-float { animation: aw-float 3s ease-in-out infinite }
.aw-spin { animation: aw-spin 4s linear infinite }
.aw-wave { animation: aw-wave 2.4s ease-out infinite }
.aw-orb1 { animation: aw-orb1 7s ease-in-out infinite }
.aw-orb2 { animation: aw-orb2 9s ease-in-out infinite }
.aw-twinkle { animation: aw-twinkle 2.4s ease-in-out infinite }
.aw-sweep { animation: aw-sweep 2.6s ease-in-out infinite }
.aw-shine { animation: aw-card-shine 5s ease-in-out 2s infinite }
.aw-dot { animation: aw-dot 1.1s ease-in-out infinite }
.aw-d-q { animation: aw-d-q 8s linear 1.4s infinite backwards }
.aw-d-think { animation: aw-d-think 8s linear 1.4s infinite backwards }
.aw-d-row { animation: aw-d-row 8s linear infinite backwards }
.aw-d-csv { animation: aw-d-csv 8s linear 1.4s infinite backwards }
.aw-root.aw-out { animation: aw-unfade .22s ease-in both }
.aw-out .aw-card { animation: aw-leave .22s ease-in both }
.aw-gpu { will-change: transform, opacity }
`;

export default function WelcomePopup({ greeting, examples, onSkip, onUse, onPick }) {
  const [leaving, setLeaving] = useState(false);
  const words = `${greeting} ! Bienvenue sur Pointage`.split(" ");
  const demoQuestion = examples[0] || "Qui était en retard hier ?";

  const leave = (fn) => () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(fn, 220);
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") leave(onSkip)(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className={`aw-root aw-fade ${leaving ? "aw-out" : ""}`} onClick={leave(onSkip)}
         style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center",
                  justifyContent: "center", padding: 16, background: "rgba(15, 23, 42, 0.55)" }}>
      <style>{CSS}</style>
      <div className="aw-card aw-pop relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl"
           role="dialog" aria-modal="true" aria-label="Assistant IA" onClick={(e) => e.stopPropagation()}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="aw-orb1 aw-gpu absolute -left-16 -top-20 h-64 w-64 rounded-full"
               style={{ background: "radial-gradient(circle, rgba(37,99,235,.28), rgba(37,99,235,0) 70%)" }} />
          <div className="aw-orb2 aw-gpu absolute -right-16 top-10 h-64 w-64 rounded-full"
               style={{ background: "radial-gradient(circle, rgba(124,58,237,.25), rgba(124,58,237,0) 70%)" }} />
          <div className="aw-shine aw-gpu absolute inset-y-0 left-0 w-24" style={{ background: "rgba(37,99,235,.08)" }} />
        </div>

        <div className="relative max-h-[calc(100vh-2rem)] overflow-y-auto p-8">
          <div className="flex flex-col items-center text-center">
            <div className="aw-float relative h-20 w-20">
              <div className="aw-wave aw-gpu absolute inset-0 rounded-full" style={{ background: "rgba(37,99,235,.35)" }} />
              <div className="aw-wave aw-gpu absolute inset-0 rounded-full" style={{ background: "rgba(124,58,237,.3)", animationDelay: "1.2s" }} />
              <div className="aw-spin aw-gpu absolute inset-0 rounded-full" style={{ background: CONIC }} />
              <div className="absolute inset-[3px] flex items-center justify-center rounded-full text-2xl font-bold text-white"
                   style={{ background: GRADIENT }}>IA</div>
              {SPARKS.map(({ size, d, ...pos }, i) => (
                <span key={i} className="aw-twinkle aw-gpu absolute text-yellow-400"
                      style={{ ...pos, fontSize: size, animationDelay: `${d}s` }}>✦</span>
              ))}
            </div>
            <h2 className="mt-6 text-3xl font-semibold">
              {words.map((w, i) => (
                <span key={i} className="aw-rise aw-gpu inline-block"
                      style={{ animationDelay: `${0.5 + i * 0.12}s`, marginRight: "0.3em" }}>{w}</span>
              ))}
            </h2>
            <p className="aw-rise mt-3 max-w-lg text-base text-gray-600" style={{ animationDelay: "1.1s" }}>
              Voici votre assistant IA. Posez une question en quelques mots sur les présences, les retards
              ou les heures supplémentaires : la réponse arrive en tableau, avec export CSV.
            </p>
          </div>

          <div className="aw-rise mt-6 rounded-2xl border bg-gray-50 p-3 text-left" style={{ animationDelay: "1.2s" }}>
            <div className="flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-xs text-gray-700 shadow-sm">
              <span className="aw-d-q aw-gpu flex-1 truncate">{demoQuestion}</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full text-white" style={{ background: GRADIENT }}>↑</span>
            </div>
            <div className="relative mt-3 h-[8.5rem]">
              <div className="aw-d-think aw-gpu absolute left-1 top-3 flex items-center gap-1.5">
                {[0, 1, 2].map((d) => (
                  <span key={d} className="aw-dot inline-block h-2 w-2 rounded-full bg-blue-500" style={{ animationDelay: `${d * 0.16}s` }} />
                ))}
                <span className="ml-2 text-[11px] text-gray-500">Analyse en cours…</span>
              </div>
              <div className="absolute inset-x-0 top-0">
                <div className="overflow-hidden rounded-lg border bg-white">
                  <div className="grid grid-cols-3 gap-3 border-b bg-gray-100 px-3 py-1.5 text-[10px] font-semibold text-gray-500">
                    <span>user_id</span><span>date</span><span>arrival</span>
                  </div>
                  {[0, 1, 2, 3].map((r) => (
                    <div key={r} className="aw-d-row aw-gpu grid grid-cols-3 gap-3 border-b border-gray-100 px-3 py-2 last:border-0"
                         style={{ animationDelay: `${1.4 + r * 0.3}s` }}>
                      <span className="h-2.5 w-2/3 rounded bg-gray-300" />
                      <span className="h-2.5 w-5/6 rounded bg-gray-200" />
                      <span className="h-2.5 w-3/4 rounded bg-gray-200" />
                    </div>
                  ))}
                </div>
                <div className="aw-d-csv aw-gpu mt-2 flex items-center gap-2 text-[11px] text-gray-500">
                  <span className="rounded border px-1.5 py-0.5 font-medium">CSV</span>
                  Réponse en tableau, exportable
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {examples.map((s, i) => (
              <button key={s} onClick={leave(() => onPick(s))}
                      className="aw-rise rounded-2xl border p-4 text-left text-sm hover:border-blue-400 hover:shadow-lg"
                      style={{ animationDelay: `${1.6 + i * 0.12}s` }}>
                {s}
              </button>
            ))}
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <button onClick={leave(onSkip)} className="rounded-xl border px-5 py-2.5 text-sm hover:bg-gray-100">Plus tard</button>
            <button onClick={leave(onUse)}
                    className="relative overflow-hidden rounded-xl px-6 py-2.5 text-sm font-medium text-white shadow-lg hover:opacity-90"
                    style={{ background: GRADIENT }}>
              <span className="aw-sweep aw-gpu pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-white/30" />
              <span className="relative">Essayer maintenant</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
