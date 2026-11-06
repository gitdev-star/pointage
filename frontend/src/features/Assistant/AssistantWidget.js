import { useCallback, useEffect, useRef, useState } from "react";
import { askAssistant, deleteConversation, getConversation, listConversations } from "./assistantApi";
import Result from "./AssistantResult";
import WelcomePopup from "./WelcomePopup";
import AssistantLauncher from "./AssistantLauncher";

const SUGGESTIONS = [
  "Qui était en retard hier ?",
  "Nombre de retards par jour cette semaine",
  "Top 10 des heures supplémentaires ce mois",
  "Prévision des retards pour les prochains jours",
  "Anomalies récentes sur les pointeuses",
];

function groupByDate(items) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const groups = [["Aujourd'hui", []], ["Hier", []], ["7 derniers jours", []], ["Plus ancien", []]];
  items.forEach((c) => {
    const d = new Date(c.updated_at);
    d.setHours(0, 0, 0, 0);
    const age = Math.round((today - d) / 86400000);
    groups[age <= 0 ? 0 : age === 1 ? 1 : age <= 7 ? 2 : 3][1].push(c);
  });
  return groups.filter(([, list]) => list.length);
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
}

export default function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [welcome, setWelcome] = useState(() => {
    try {
      const id = (localStorage.getItem("refresh_token") || localStorage.getItem("access_token") || "").slice(-16);
      return !!id && localStorage.getItem("assistant_welcome_seen") !== id;
    } catch (_) { return false; }
  });
  const [side, setSide] = useState(false);
  const [big, setBig] = useState(false);
  const [convs, setConvs] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [secs, setSecs] = useState(0);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  const refresh = useCallback(async () => {
    try { setConvs(await listConversations()); } catch (_) { /* keep the current list */ }
  }, []);

  useEffect(() => { if (open) refresh(); }, [open, refresh]);
  useEffect(() => {
    if (!welcome) return undefined;
    try {
      const id = (localStorage.getItem("refresh_token") || localStorage.getItem("access_token") || "").slice(-16);
      localStorage.setItem("assistant_welcome_seen", id);
    } catch (_) { /* storage blocked */ }
    return undefined;
  }, [welcome]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);
  useEffect(() => {
    if (!busy) return undefined;
    setSecs(0);
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function newChat() {
    if (busy) return;
    setActiveId(null);
    setMessages([]);
    setSide(false);
  }

  async function openConv(id) {
    if (busy) return;
    setSide(false);
    try {
      const d = await getConversation(id);
      setActiveId(d.id);
      setMessages(d.messages.map((m) => (m.role === "user"
        ? { role: "user", text: m.content }
        : m.result ? { role: "assistant", result: m.result }
        : { role: "assistant", text: m.content, error: true })));
    } catch (_) {
      setMessages([{ role: "assistant", text: "Impossible de charger cette conversation.", error: true }]);
    }
  }

  async function removeConv(id, e) {
    e.stopPropagation();
    if (busy || !window.confirm("Supprimer cette conversation ?")) return;
    try {
      await deleteConversation(id);
      if (id === activeId) { setActiveId(null); setMessages([]); }
    } catch (_) { /* refresh below shows the real state */ }
    refresh();
  }

  async function send(text) {
    const q = (text ?? inputRef.current?.value ?? input).trim();
    if (q.length < 2 || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", text: q }]);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const d = await askAssistant(q, activeId, ctrl.signal);
      setActiveId(d.conversation_id);
      setMessages((m) => [...m, d.result
        ? { role: "assistant", result: d.result }
        : { role: "assistant", text: d.error || "L'assistant n'a pas pu répondre.", error: true }]);
    } catch (e) {
      console.error("assistant", e);
      const detail = e?.response?.data?.detail;
      const msg = ctrl.signal.aborted ? "Demande annulée."
        : typeof detail === "string" ? detail : `L'assistant n'a pas pu répondre (${e?.message || "erreur réseau"}).`;
      setMessages((m) => [...m, { role: "assistant", text: msg, error: true }]);
    } finally {
      setBusy(false);
      refresh();
    }
  }

  if (!open) {
    return (
      <>
        {welcome && (
          <WelcomePopup
            greeting={greeting()}
            examples={SUGGESTIONS.slice(0, 3)}
            onSkip={() => setWelcome(false)}
            onUse={() => { setWelcome(false); setOpen(true); }}
            onPick={(q) => { setInput(q); setWelcome(false); setOpen(true); }}
          />
        )}
        <AssistantLauncher onOpen={() => setOpen(true)} tips={SUGGESTIONS} />
      </>
    );
  }

  return (
    <div className="fixed z-[100] flex overflow-hidden rounded-2xl border bg-white"
         style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)",
                  width: big ? "calc(100vw - 2rem)" : "min(1200px, calc(100vw - 3rem))",
                  height: big ? "calc(100vh - 2rem)" : "min(840px, calc(100vh - 3rem))",
                  boxShadow: "0 0 0 100vmax rgba(15,23,42,.45), 0 25px 60px rgba(0,0,0,.35)" }}>
      <aside className={`${side ? "flex" : "hidden"} absolute inset-y-0 left-0 z-10 w-52 shrink-0 flex-col border-r bg-gray-50 md:static md:flex`}>
        <div className="p-3">
          <button onClick={newChat} disabled={busy}
                  className="w-full rounded-lg border bg-white px-3 py-2 text-left text-sm font-medium hover:bg-gray-100 disabled:opacity-50">
            + Nouvelle conversation
          </button>
        </div>
        <div className="flex-1 overflow-auto px-2 pb-3">
          {convs.length === 0 && <p className="px-2 text-xs text-gray-500">Aucune conversation pour le moment.</p>}
          {groupByDate(convs).map(([label, list]) => (
            <div key={label} className="mb-3">
              <div className="px-2 py-1 text-xs font-medium text-gray-500">{label}</div>
              {list.map((c) => (
                <div key={c.id} onClick={() => openConv(c.id)}
                     className={`group flex cursor-pointer items-center justify-between rounded px-2 py-2 text-sm ${c.id === activeId ? "bg-blue-100" : "hover:bg-gray-200"} ${busy ? "opacity-60" : ""}`}>
                  <span className="truncate">{c.title}</span>
                  <button onClick={(e) => removeConv(c.id, e)} title="Supprimer"
                          className="ml-2 hidden text-gray-400 hover:text-red-600 group-hover:block">✕</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <button className="md:hidden" onClick={() => setSide((s) => !s)} aria-label="Conversations">☰</button>
            <span className="font-semibold">Assistant IA — présences et retards</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setBig((b) => !b)} title={big ? "Réduire" : "Agrandir"}
                    className="rounded border px-3 py-1 text-sm hover:bg-gray-100">{big ? "⤡" : "⤢"}</button>
            <button onClick={() => setOpen(false)} className="rounded border px-3 py-1 text-sm hover:bg-gray-100">✕</button>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-5xl space-y-4 p-4">
            {messages.length === 0 && (
              <div className="pt-8 text-center">
                <h2 className="text-2xl font-semibold">{greeting()} ! Que voulez-vous savoir ?</h2>
                <p className="mt-2 text-sm text-gray-600">Je suis l'assistant IA du pointage. Posez-moi une question sur les présences, les retards, les heures supplémentaires ou les pointeuses.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)}
                            className="rounded-full border px-3 py-1 text-xs hover:bg-gray-100">{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (m.role === "user" ? (
              <div key={i} className="ml-auto w-fit max-w-[80%] rounded-3xl bg-gray-100 px-4 py-2.5 text-sm text-gray-900">{m.text}</div>
            ) : m.result ? (
              <div key={i} className="flex gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">IA</div>
                <div className="min-w-0 flex-1">
                  {m.result.answer && <p className="mb-3 whitespace-pre-wrap text-sm text-gray-800">{m.result.answer}</p>}
                  <Result res={m.result} />
                </div>
              </div>
            ) : (
              <div key={i} className="flex gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">IA</div>
                <p className="min-w-0 flex-1 text-sm text-red-600">{m.text}</p>
              </div>
            )))}
            {busy && <div className="animate-pulse pl-10 text-sm text-gray-500">Analyse en cours… {secs}s (20 à 70 s en général)</div>}
            <div ref={endRef} />
          </div>
        </div>

        <div className="border-t p-3">
          <div className="mx-auto flex max-w-5xl gap-2">
            <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} maxLength={300}
                   onKeyDown={(e) => e.key === "Enter" && send()} disabled={busy}
                   placeholder="Ex. : qui a fait plus de 3 retards ce mois ?"
                   className="flex-1 rounded-full border px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            {busy
              ? <button onClick={() => abortRef.current?.abort()} className="rounded-full border px-5 py-2 text-sm">Annuler</button>
              : <button onClick={() => send()} className="rounded-full bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700">Envoyer</button>}
          </div>
        </div>
      </section>
    </div>
  );
}
