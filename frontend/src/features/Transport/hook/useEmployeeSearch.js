import { useState, useEffect, useRef } from "react";
import hrClient from "../../../api/hrClient"; // ← adapte le chemin

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function useEmployeeSearch() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setResults([]);
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setSearching(true);
    hrClient
      .get("employees/transport-search/", {
        params: { search: debouncedQuery.trim() },
        signal: abortRef.current.signal,
      })
      .then(r => setResults(r.data || []))
      .catch(() => {})
      .finally(() => setSearching(false));
  }, [debouncedQuery]);

  return { query, setQuery, results, setResults, searching };
}