import hrClient from "../../../api/hrClient";

// transportService.js
export const transportService = {
  async createTransportList(transportDate, heureFin, employeeIds) {
    const res = await hrClient.post("employees/transport-lists/", {
      transport_date: transportDate,
      heure_fin: heureFin,
      employee_ids: employeeIds,
    });
    return res.data;
  },

  async getTransportLists(date) {
    const params = date ? { date } : {};
    const res = await hrClient.get("employees/transport-lists/", { params });
    return res.data.results ?? res.data;
  },
};