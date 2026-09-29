import { useCallback, useEffect, useState } from "react";
import hrClient from "../../../api/hrClient";

export default function useSanctions({ sanctionType, date, search } = {}) {
  const [sanctions, setSanctions]         = useState([]);
  const [sanctionTypes, setSanctionTypes] = useState([]);
  const [loading, setLoading]             = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (sanctionType) params.sanction_type = sanctionType;
      if (date)         params.date          = date;
      if (search)       params.search        = search;

      const [s, t] = await Promise.all([
        hrClient.get("sanctions/",       { params }),
        hrClient.get("sanctions/types/", { params: { is_active: true } }),
      ]);

      setSanctions(s.data.results ?? s.data);
      const rawTypes = (t.data.results ?? t.data ?? []).filter(Boolean);
      setSanctionTypes([
        ...rawTypes
          .filter((x) => x && x.code !== "LICENCIEMENT")
          .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)),
        ...rawTypes.filter((x) => x && x.code === "LICENCIEMENT"),
      ]);
    } catch {
      throw new Error("Erreur de chargement des sanctions");
    } finally {
      setLoading(false);
    }
  }, [sanctionType, date, search]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const createSanction = async (form) => {
    await hrClient.post("sanctions/", form);
    await fetchAll();
  };

  const updateSanction = async (id, form) => {
    await hrClient.patch(`sanctions/${id}/`, form);
    await fetchAll();
  };

  const createType = async (form) => {
    await hrClient.post("sanctions/types/", form);
    await fetchAll();
  };

  const updateType = async (id, form) => {
    await hrClient.patch(`sanctions/types/${id}/`, form);
    await fetchAll();
  };

  const toggleType = async (t) => {
    await hrClient.patch(`sanctions/types/${t.id}/`, { is_active: !t.is_active });
    await fetchAll();
  };

  const autoTerminate = async (employeeId, date, reason) => {
    await hrClient.patch(`employees/${employeeId}/`, {
      status:           "TERMINATED",
      termination_date: date,
      motif_depart:     reason,
    });
  };

  return {
    sanctions, sanctionTypes, loading,
    fetchAll,
    createSanction, updateSanction,
    createType, updateType, toggleType,
    autoTerminate,
  };
}