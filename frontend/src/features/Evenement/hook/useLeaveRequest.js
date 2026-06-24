import { useCallback, useEffect, useState } from "react";
import { eventService } from "../api/EvenementApi";

export default function useLeaveRequests(filters) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);

    try {
      const params = {
        page_size: 100,
      };

      if (filters?.status) {
        params.status = filters.status;
      }

      if (filters?.search) {
        params.search = filters.search;
      }

      const data = await eventService.getRequests(params);

      setRequests(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const createRequest = async (payload) => {
    await eventService.createRequest(payload);
    await fetchRequests();
  };

  const approveRequest = async (id) => {
    await eventService.approveReject(id, {
      action: "approve",
    });

    await fetchRequests();
  };

  const rejectRequest = async (
    id,
    rejection_reason
  ) => {
    await eventService.approveReject(id, {
      action: "reject",
      rejection_reason,
    });

    await fetchRequests();
  };

  return {
    requests,
    loading,
    fetchRequests,
    createRequest,
    approveRequest,
    rejectRequest,
  };
}