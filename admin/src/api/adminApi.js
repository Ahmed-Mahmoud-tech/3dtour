import axios from "axios";

const BASE = "/api/admin";

// Platform-admin endpoints: client (tour owner) accounts, their
// subscriptions, and tour assignment.
export const adminApi = {
  // Owners
  listOwners: () => axios.get(`${BASE}/owners`).then((r) => r.data),
  createOwner: (payload) => axios.post(`${BASE}/owners`, payload).then((r) => r.data),
  updateOwner: (id, payload) => axios.put(`${BASE}/owners/${id}`, payload).then((r) => r.data),
  resetOwnerPassword: (id, password) =>
    axios.put(`${BASE}/owners/${id}/password`, { password }).then((r) => r.data),
  deleteOwner: (id) => axios.delete(`${BASE}/owners/${id}`).then((r) => r.data),

  // Subscriptions
  upsertSubscription: (ownerId, payload) =>
    axios.post(`${BASE}/owners/${ownerId}/subscription`, payload).then((r) => r.data),
  setSubscriptionStatus: (ownerId, status) =>
    axios.put(`${BASE}/owners/${ownerId}/subscription`, { status }).then((r) => r.data),

  // Tour assignment
  assignProject: (projectId, ownerId) =>
    axios.put(`${BASE}/projects/${projectId}/assign`, { ownerId }).then((r) => r.data),

  // Self-hosted tour export — downloads a zip (auth header required, so no plain <a href>)
  exportProject: async (projectId, filename = 'tour-export.zip') => {
    const { data } = await axios.get(`${BASE}/projects/${projectId}/export`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};
