import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { projectApi, mediaApi } from '../api/projectApi.js';
import { adminApi } from '../api/adminApi.js';
import { FaPlus, FaEdit, FaTrash, FaGlobe, FaSignOutAlt, FaSyncAlt, FaDownload } from 'react-icons/fa';

export default function ProjectsPage() {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const data = await projectApi.list();
      setProjects(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || submitting) return;
    setSubmitting(true);
    try {
      // Upload the client logo first (if provided), then create the project
      let nadirLogoUrl = '';
      if (logoFile) {
        const { url } = await mediaApi.uploadImage(logoFile);
        nadirLogoUrl = url;
      }
      const project = await projectApi.create({ title: newTitle.trim(), nadirLogoUrl });
      setProjects((prev) => [project, ...prev]);
      setNewTitle('');
      setLogoFile(null);
      setCreating(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const [exportingId, setExportingId] = useState(null);
  const handleExport = async (project) => {
    if (exportingId) return;
    setExportingId(project._id);
    try {
      await adminApi.exportProject(project._id, `${project.info?.title || 'tour'}-export.zip`);
    } catch (err) {
      // Blob error responses need decoding to show the server's message
      let message = err.message;
      try { message = JSON.parse(await err.response.data.text()).message; } catch { /* keep */ }
      window.alert(`Export failed: ${message}`);
    } finally {
      setExportingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this project and all its data? This cannot be undone.')) return;
    await projectApi.delete(id);
    setProjects((prev) => prev.filter((p) => p._id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FaGlobe className="text-blue-400" size={22} />
          <h1 className="text-lg font-bold text-white">360 Tour Admin</h1>
          <nav className="ml-6 flex items-center gap-4 text-sm">
            <Link to="/projects" className="text-white font-medium">Projects</Link>
            <Link to="/clients" className="text-gray-400 hover:text-white transition-colors">Clients</Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">{user?.name}</span>
          <button onClick={logout} className="flex items-center gap-2 text-gray-500 hover:text-white text-sm transition-colors">
            <FaSignOutAlt size={14} />
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
        {/* Page title + create button */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Your Projects</h2>
          <button
            onClick={() => setCreating((v) => !v)}
            className="admin-btn-primary flex items-center gap-2"
          >
            <FaPlus size={12} />
            New Project
          </button>
        </div>

        {/* Create form */}
        {creating && (
          <form onSubmit={handleCreate} className="admin-card mb-6 flex flex-col gap-3">
            <input
              autoFocus
              className="admin-input"
              placeholder="Project title…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <div>
              <label className="admin-label">
                Client Logo (shown at the bottom of every sphere — leave empty to use the Gateverse logo)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="admin-input text-gray-400 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-blue-600 file:text-white cursor-pointer"
                onChange={(e) => setLogoFile(e.target.files[0] || null)}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button type="submit" disabled={submitting} className="admin-btn-primary flex items-center gap-2">
                {submitting && <FaSyncAlt size={12} className="animate-spin" />}
                Create
              </button>
              <button type="button" onClick={() => { setCreating(false); setLogoFile(null); }} className="admin-btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Project grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <FaGlobe size={48} className="mx-auto mb-4 opacity-30" />
            <p>No projects yet. Create your first virtual tour.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div key={project._id} className="admin-card flex flex-col gap-3 hover:border-gray-700 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-white truncate">{project.info?.title}</h3>
                    <p className="text-gray-500 text-xs mt-1">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-800">
                  <Link
                    to={`/projects/${project._id}`}
                    className="admin-btn-primary flex items-center gap-1.5 text-xs py-1.5 flex-1 justify-center"
                  >
                    <FaEdit size={11} />
                    Edit
                  </Link>
                  <button
                    onClick={() => handleExport(project)}
                    disabled={exportingId === project._id}
                    title="Export self-hosted tour (zip)"
                    className="admin-btn-secondary flex items-center gap-1.5 text-xs py-1.5"
                  >
                    {exportingId === project._id
                      ? <FaSyncAlt size={11} className="animate-spin" />
                      : <FaDownload size={11} />}
                  </button>
                  <button
                    onClick={() => handleDelete(project._id)}
                    className="admin-btn-danger flex items-center gap-1.5 text-xs py-1.5"
                  >
                    <FaTrash size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
