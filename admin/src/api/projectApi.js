import axios from "axios";

const BASE = "/api";

// ─── Projects ─────────────────────────────────────────────────────────────────
export const projectApi = {
  // params: { q, page, limit, noOwner, noEmployee } — with `page` the server
  // returns { items, total, page, pages }; without it, the legacy array.
  list: (params) => axios.get(`${BASE}/projects`, { params }).then((r) => r.data),
  get: (id) => axios.get(`${BASE}/projects/${id}`).then((r) => r.data),
  create: (payload) =>
    axios.post(`${BASE}/projects`, payload).then((r) => r.data),
  update: (id, data) =>
    axios.put(`${BASE}/projects/${id}`, data).then((r) => r.data),
  delete: (id) => axios.delete(`${BASE}/projects/${id}`).then((r) => r.data),
};

// ─── Nodes ────────────────────────────────────────────────────────────────────
export const nodeApi = {
  add: (pid, data) =>
    axios.post(`${BASE}/projects/${pid}/nodes`, data).then((r) => r.data),
  update: (pid, nid, data) =>
    axios.put(`${BASE}/projects/${pid}/nodes/${nid}`, data).then((r) => r.data),
  delete: (pid, nid) =>
    axios.delete(`${BASE}/projects/${pid}/nodes/${nid}`).then((r) => r.data),
};

// ─── Hotspots ─────────────────────────────────────────────────────────────────
export const hotspotApi = {
  add: (pid, nid, data) =>
    axios
      .post(`${BASE}/projects/${pid}/nodes/${nid}/hotspots`, data)
      .then((r) => r.data),
  update: (pid, nid, hid, data) =>
    axios
      .put(`${BASE}/projects/${pid}/nodes/${nid}/hotspots/${hid}`, data)
      .then((r) => r.data),
  delete: (pid, nid, hid) =>
    axios
      .delete(`${BASE}/projects/${pid}/nodes/${nid}/hotspots/${hid}`)
      .then((r) => r.data),
};

// ─── Signs ────────────────────────────────────────────────────────────────────
export const signApi = {
  add: (pid, nid, data) =>
    axios
      .post(`${BASE}/projects/${pid}/nodes/${nid}/signs`, data)
      .then((r) => r.data),
  update: (pid, nid, sid, data) =>
    axios
      .put(`${BASE}/projects/${pid}/nodes/${nid}/signs/${sid}`, data)
      .then((r) => r.data),
  delete: (pid, nid, sid) =>
    axios
      .delete(`${BASE}/projects/${pid}/nodes/${nid}/signs/${sid}`)
      .then((r) => r.data),
};

// ─── Media ────────────────────────────────────────────────────────────────────
export const mediaApi = {
  uploadPanorama: (file) => {
    const fd = new FormData();
    fd.append("panorama", file);
    return axios.post(`${BASE}/media/panorama`, fd).then((r) => r.data);
  },
  uploadAudio: (file) => {
    const fd = new FormData();
    fd.append("audio", file);
    return axios.post(`${BASE}/media/audio`, fd).then((r) => r.data);
  },
  uploadImage: (file) => {
    const fd = new FormData();
    fd.append("image", file);
    return axios.post(`${BASE}/media/image`, fd).then((r) => r.data);
  },
  uploadVideo: (projectId, transitionId, file) => {
    const fd = new FormData();
    fd.append("video", file);
    fd.append("transitionId", transitionId);
    return axios
      .post(`${BASE}/media/video/${projectId}`, fd, {
        onUploadProgress: (e) => e, // Caller can pass custom onUploadProgress via interceptor
      })
      .then((r) => r.data);
  },
};
