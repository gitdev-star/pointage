import { useCallback, useEffect, useState } from "react";
import { eventService } from "../api/EvenementApi";

export default function useLeaveTypes() {
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchTypes = useCallback(async () => {
    setLoading(true);

    try {
      const data = await eventService.getTypes();

      setLeaveTypes(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  const createType = async (payload) => {
    const created =
      await eventService.createType(payload);

    setLeaveTypes((prev) => [
      ...prev,
      created,
    ]);
  };

  const updateType = async (id, payload) => {
    const updated =
      await eventService.updateType(id, payload);

    setLeaveTypes((prev) =>
      prev.map((item) =>
        item.id === id ? updated : item
      )
    );
  };

  return {
    leaveTypes,
    loading,
    fetchTypes,
    createType,
    updateType,
    setLeaveTypes,
  };
}