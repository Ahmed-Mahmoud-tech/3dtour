import axios from "axios";

const BASE = "/api/admin";

// Platform-admin endpoints: client (tour owner) accounts, their
// subscriptions, and tour assignment.
export const adminApi = {
  // Owners — params: { q, page, limit } → { items, total, page, pages }
  listOwners: (params) => axios.get(`${BASE}/owners`, { params }).then((r) => r.data),
  createOwner: (payload) => axios.post(`${BASE}/owners`, payload).then((r) => r.data),
  updateOwner: (id, payload) => axios.put(`${BASE}/owners/${id}`, payload).then((r) => r.data),
  resetOwnerPassword: (id, password) =>
    axios.put(`${BASE}/owners/${id}/password`, { password }).then((r) => r.data),
  deleteOwner: (id) => axios.delete(`${BASE}/owners/${id}`).then((r) => r.data),

  // Subscriptions — per PROJECT: each tour is sold/renewed on its own
  upsertSubscription: (projectId, payload) =>
    axios.post(`${BASE}/projects/${projectId}/subscription`, payload).then((r) => r.data),
  setSubscriptionStatus: (projectId, status) =>
    axios.put(`${BASE}/projects/${projectId}/subscription`, { status }).then((r) => r.data),

  // Employees (staff accounts scoped to their assigned projects)
  // params: { q, page, limit } → { items, total, page, pages }
  listEmployees: (params) => axios.get(`${BASE}/employees`, { params }).then((r) => r.data),
  createEmployee: (payload) => axios.post(`${BASE}/employees`, payload).then((r) => r.data),
  updateEmployee: (id, payload) => axios.put(`${BASE}/employees/${id}`, payload).then((r) => r.data),
  resetEmployeePassword: (id, password) =>
    axios.put(`${BASE}/employees/${id}/password`, { password }).then((r) => r.data),
  deleteEmployee: (id) => axios.delete(`${BASE}/employees/${id}`).then((r) => r.data),

  // Public-access control: suspend/unsuspend and expiry mode
  // payload: { suspended?, expiryMode?, expiryDate? }
  setProjectAccess: (projectId, payload) =>
    axios.put(`${BASE}/projects/${projectId}/access`, payload).then((r) => r.data),

  // Tour assignment
  assignProject: (projectId, ownerId) =>
    axios.put(`${BASE}/projects/${projectId}/assign`, { ownerId }).then((r) => r.data),
  assignProjectEmployee: (projectId, employeeId) =>
    axios.put(`${BASE}/projects/${projectId}/assign-employee`, { employeeId }).then((r) => r.data),

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
