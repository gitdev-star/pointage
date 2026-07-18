import hrClient from "../../../api/hrClient";

const BASE = "employees/work-schedules/"; // <-- corrigé

export const getWorkSchedules = async (filters = {}) => {
  const { data } = await hrClient.get(BASE, { params: { page_size: 500, ...filters } });
  return Array.isArray(data) ? data : data.results || [];
};

export const createWorkSchedule = async (payload) => {
  const { data } = await hrClient.post(BASE, payload);
  return data;
};

export const updateWorkSchedule = async (id, payload) => {
  const { data } = await hrClient.patch(`${BASE}${id}/`, payload);
  return data;
};

export const deleteWorkSchedule = async (id) => {
  await hrClient.delete(`${BASE}${id}/`);
};

export const assignWorkSchedule = async (payload) => {
  const { data } = await hrClient.post(`${BASE}assign/`, payload);
  return data;
};