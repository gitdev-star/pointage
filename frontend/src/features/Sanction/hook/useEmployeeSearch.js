import { useCallback, useEffect, useRef, useState } from "react";
import hrClient from "../../../api/hrClient";

export default function useEmployeeSearch(query) {
  const [employees, setEmployees]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const debounceRef                 = useRef(null);

  const search = useCallback(async (q) => {
    setLoading(true);
    try {
      const params = { page: 1, page_size: 30 };
      if (q.trim()) params.search = q.trim();
      const res = await hrClient.get("employees/", { params });
      setEmployees(res.data.results ?? res.data ?? []);
    } catch {
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  return { employees, loading };
}