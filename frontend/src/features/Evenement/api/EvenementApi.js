import hrClient from "../../../api/hrClient";

export const eventService = {
  // =============================
  // LEAVE REQUESTS
  // =============================

  async getRequests(params = {}) {
    const response = await hrClient.get(
      "leaves/requests/",
      { params }
    );

    return response.data.results ?? response.data;
  },

  async createRequest(data) {
    const response = await hrClient.post(
      "leaves/requests/",
      data
    );

    return response.data;
  },

  async approveReject(id, payload) {
    const response = await hrClient.post(
      `leaves/requests/${id}/approve_reject/`,
      payload
    );

    return response.data;
  },

  async exportRequests(params = {}) {
    const response = await hrClient.get(
      "leaves/requests/export/",
      { params, responseType: "blob" }
    );

    const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `evenements_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  // =============================
  // TYPES
  // =============================

  async getTypes() {
    const response = await hrClient.get(
      "leaves/types/?page_size=100"
    );

    return response.data.results ?? response.data;
  },

  async createType(data) {
    const response = await hrClient.post(
      "leaves/types/",
      data
    );

    return response.data;
  },

  async updateType(id, data) {
    const response = await hrClient.patch(
      `leaves/types/${id}/`,
      data
    );

    return response.data;
  },
};