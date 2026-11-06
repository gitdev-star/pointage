const fmt = (v) => {
  if (v == null) return "";
  if (typeof v === "string") return v.replace(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2}).*$/, "$1 $2");
  return String(v);
};

// overtime columns are shown as "2 h 28 min" instead of 2.47 (the CSV keeps the decimal value)
const hm = (v) => {
  const n = Number(v);
  if (v == null || v === "" || Number.isNaN(n)) return fmt(v);
  const t = Math.round(n * 60);
  return t < 60 ? `${t} min` : `${Math.floor(t / 60)} h ${String(t % 60).padStart(2, "0")} min`;
};
const cell = (col, v) => (/overtime/i.test(col) ? hm(v) : fmt(v));

function downloadCsv(columns, rows) {
  const esc = (v) => {
    const s = fmt(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [columns, ...rows].map((r) => r.map(esc).join(";")).join("\r\n");
  const blob = new Blob(["\uFEFF" + body], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `assistant_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Header language: stored choice in localStorage.lang ("fr", "en", ...), French by default.
const pickLang = () => {
  try {
    return String(localStorage.getItem("lang") || "fr").slice(0, 2).toLowerCase();
  } catch (_) {
    return "fr";
  }
};

export default function Result({ res }) {
  const shown = res.rows.slice(0, 100);
  const hidden = res.rows.length - shown.length;
  const lang = pickLang();
  const headers = (res.labels && (res.labels[lang] || res.labels.en)) || res.columns;
  return (
    <div className="text-sm leading-relaxed text-gray-900">
      <p className="font-medium">{res.title}</p>
      {res.note && <p className="mt-1 text-gray-600">{res.note}</p>}
      {res.rows.length > 0 && (
        <>
          <div className="mt-3 max-h-[28rem] overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-gray-300">
                  {headers.map((c, hi) => (
                    <th key={hi} className="px-3 py-2 text-left font-semibold text-gray-700">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    {r.map((v, j) => (
                      <td key={j} className="whitespace-nowrap px-3 py-1.5">{cell(res.columns[j], v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {res.rows.length} ligne{res.rows.length > 1 ? "s" : ""}
            {hidden > 0 ? ` (les ${shown.length} premières sont affichées, tout est dans le CSV)` : ""}
            {res.truncated ? " : résultat limité à 500 lignes" : ""}
          </p>
          <button onClick={() => downloadCsv(headers, res.rows)}
                  className="mt-2 rounded-md border px-3 py-1 text-xs text-gray-700 hover:bg-gray-100">
            Télécharger CSV
          </button>
        </>
      )}
      {res.sql && (
        <details className="mt-3 text-xs text-gray-500">
          <summary className="cursor-pointer">Voir la requête SQL</summary>
          <pre className="mt-1 whitespace-pre-wrap">{res.sql}</pre>
        </details>
      )}
    </div>
  );
}
