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