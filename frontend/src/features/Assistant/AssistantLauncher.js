import { useEffect, useState } from "react";

const CSS = `
@keyframes al-float { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
@keyframes al-ring {
  0%   { box-shadow: 0 8px 24px rgba(37,99,235,.35), 0 0 0 0 rgba(37,99,235,.55) }
  100% { box-shadow: 0 8px 24px rgba(37,99,235,.35), 0 0 0 22px rgba(37,99,235,0) }
}
@keyframes al-shift { 0%, 100% { background-position: 0% 50% } 50% { background-position: 100% 50% } }
@keyframes al-spark { 0%, 100% { transform: scale(1) rotate(0deg); opacity: 1 } 50% { transform: scale(1.25) rotate(18deg); opacity: .8 } }
@keyframes al-tip { 0% { opacity: 0; transform: translateY(6px) } 12%, 88% { opacity: 1; transform: none } 100% { opacity: 0; transform: translateY(-4px) } }
.al-wrap { animation: al-float 3.2s ease-in-out infinite }
.al-btn {
  background: linear-gradient(120deg, #2563eb, #7c3aed, #06b6d4, #2563eb);
  background-size: 300% 300%;
  animation: al-ring 2.2s ease-out infinite, al-shift 6s ease infinite;
  transition: transform .2s ease;
}
.al-btn:hover { transform: scale(1.06) }
.al-spark { animation: al-spark 1.8s ease-in-out infinite; transform-box: fill-box; transform-origin: center }
.al-tip { animation: al-tip 4.5s ease both }
`;

export default function AssistantLauncher({ onOpen, tips }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!tips.length) return undefined;
    const t = setInterval(() => setI((n) => (n + 1) % tips.length), 4500);
    return () => clearInterval(t);
  }, [tips.length]);

  return (
    <div className="al-wrap fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      <style>{CSS}</style>
      {tips.length > 0 && (
        <div key={i} className="al-tip pointer-events-none max-w-[16rem] rounded-2xl bg-white px-3 py-2 text-xs text-gray-700 shadow-lg ring-1 ring-black/5">
          Essayez : « {tips[i]} »
        </div>
      )}
      <button onClick={onOpen} aria-label="Assistant IA"
              className="al-btn flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-white">
        <svg className="al-spark h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" />
        </svg>
        Assistant IA
      </button>
    </div>
  );
}
