import { useCallback, useEffect, useState } from "react";
import hrClient from "../../../api/hrClient";

export default function useEventTypes() {
  const [eventTypes, setEventTypes] = useState([]);
  const [loading, setLoading]       = useState(false);

  const fetchEventTypes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hrClient.get("leaves/types/?page_size=50");
      setEventTypes(res.data.results ?? res.data);
    } catch {
      throw new Error("Erreur de chargement des types d'événement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEventTypes(); }, [fetchEventTypes]);

  const createEventType = async (form) => {
    await hrClient.post("leaves/types/", form);
    await fetchEventTypes();
  };

  const updateEventType = async (id, form) => {
    await hrClient.patch(`leaves/types/${id}/`, form);
    await fetchEventTypes();
  };

  return { eventTypes, loading, fetchEventTypes, createEventType, updateEventType };
}