import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { projectApi, mediaApi } from "../api/projectApi.js";
import { adminApi } from "../api/adminApi.js";
import { SearchInput, Pager, useDebounced } from "../components/ui/ListControls.jsx";
import AccountControls from "../components/Auth/AccountControls.jsx";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaGlobe,
  FaSyncAlt,
  FaDownload,
  FaBan,
  FaPlay,
} from "react-icons/fa";

// Compact public-access controls on each project card: suspend toggle +
// expiry mode (owner subscription + 3-month grace / fixed date / lifetime).
function AccessControls({ project, onChanged }) {
  const mode = project.expiry?.mode || "subscription";
  const [saving, setSaving] = useState(false);
  const [pickingDate, setPickingDate] = useState(false);
  const [dateDraft, setDateDraft] = useState(
    project.expiry?.date ? project.expiry.date.slice(0, 10) : "",
  );

  const apply = async (payload) => {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await adminApi.setProjectAccess(project._id, payload);
      onChanged(updated);
      setPickingDate(false);
    } catch (err) {
      window.alert(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleModeChange = (value) => {
    if (value === "date") {
      setPickingDate(true);
      return;
    }
    setPickingDate(false);
    apply({ expiryMode: value });
  };

  const handleToggleSuspend = () => {
    if (
      !project.suspended &&
      !window.confirm(
        `Suspend "${project.info?.title}"? Visitors will no longer be able to open this tour.`,
      )
    )
      return;
    apply({ suspended: !project.suspended });
  };

  const showDateInput = pickingDate || mode === "date";

  return (
    <div className="flex flex-col gap-2 border-t border-gray-800 pt-2">
      <div className="flex items-center gap-2">
        <select
          className="admin-input text-xs py-1 flex-1"
          disabled={saving}
          value={pickingDate ? "date" : mode}
          onChange={(e) => handleModeChange(e.target.value)}
          title="When does public access to this tour expire?"
        >
          <option value="subscription">Owner subscription + 3 months</option>
          <option value="date">Specific date…</option>
          <option value="lifetime">Lifetime</option>
        </select>
        <button
          onClick={handleToggleSuspend}
          disabled={saving}
          title={project.suspended ? "Resume public access" : "Suspend public access"}
          className={`admin-btn-secondary text-xs py-1.5 flex items-center gap-1.5 ${
            project.suspended ? "text-emerald-400" : "text-amber-400"
          }`}
        >
          {saving ? (
            <FaSyncAlt size={11} className="animate-spin" />
          ) : project.suspended ? (
            <>
              <FaPlay size={11} /> Resume
            </>
          ) : (
            <>
              <FaBan size={11} /> Suspend
            </>
          )}
        </button>
      </div>
      {showDateInput && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="admin-input text-xs py-1 flex-1"
            value={dateDraft}
            onChange={(e) => setDateDraft(e.target.value)}
          />
          <button
            onClick={() => dateDraft && apply({ expiryMode: "date", expiryDate: dateDraft })}
            disabled={saving || !dateDraft}
            className="admin-btn-secondary text-xs py-1.5"
          >
            Set
          </button>
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 12;

export default function ProjectsPage() {
  const { isAdmin } = useAuth();
  const [projects, setProjects] = useState([]);
  const [pageInfo, setPageInfo] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(search);

  const fetchProjects = async (targetPage = page) => {
    setLoading(true);
    try {
      const data = await projectApi.list({ q, page: targetPage, limit: PAGE_SIZE });
      setProjects(data.items);
      setPageInfo({ total: data.total, page: data.page, pages: data.pages });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // New search always restarts from page 1
  useEffect(() => {
    setPage(1);
  }, [q]);

  useEffect(() => {
    fetchProjects(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, page]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || submitting) return;
    setSubmitting(true);
    try {
      // Upload the client logo first (if provided), then create the project
      let nadirLogoUrl = "";
      if (logoFile) {
        const { url } = await mediaApi.uploadLogo(logoFile);
        nadirLogoUrl = url;
      }
      await projectApi.create({
        title: newTitle.trim(),
        nadirLogoUrl,
      });
      setNewTitle("");
      setLogoFile(null);
      setCreating(false);
      setPage(1);
      await fetchProjects(1); // newest-first: the new project is on page 1
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
      await adminApi.exportProject(
        project._id,
        `${project.info?.title || "tour"}-export.zip`,
      );
    } catch (err) {
      // Blob error responses need decoding to show the server's message
      let message = err.message;
      try {
        message = JSON.parse(await err.response.data.text()).message;
      } catch {
        /* keep */
      }
      window.alert(`Export failed: ${message}`);
    } finally {
      setExportingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (
      !window.confirm(
        "Delete this project and all its data? This cannot be undone.",
      )
    )
      return;
    await projectApi.delete(id);
    // Refetch so totals/pages stay right; step back if the page just emptied
    if (projects.length === 1 && page > 1) setPage(page - 1);
    else await fetchProjects(page);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FaGlobe className="text-blue-400" size={22} />
          <h1 className="text-lg font-bold text-white">360 Tour Admin</h1>
          <nav className="ml-6 flex items-center gap-4 text-sm">
            <Link to="/projects" className="text-white font-medium">
              Projects
            </Link>
            {isAdmin && (
              <>
                <Link
                  to="/clients"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Clients
                </Link>
                <Link
                  to="/employees"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Employees
                </Link>
              </>
            )}
          </nav>
        </div>
        <AccountControls />
      </header>

      <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
        {/* Page title + create button */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">
            {isAdmin ? "Your Projects" : "Assigned Projects"}
            {pageInfo.total > 0 && (
              <span className="text-gray-500 font-normal text-sm ml-2">
                ({pageInfo.total})
              </span>
            )}
          </h2>
          {isAdmin && (
            <button
              onClick={() => setCreating((v) => !v)}
              className="admin-btn-primary flex items-center gap-2"
            >
              <FaPlus size={12} />
              New Project
            </button>
          )}
        </div>

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search projects by title…"
          className="mb-6 max-w-sm"
        />

        {/* Create form */}
        {creating && (
          <form
            onSubmit={handleCreate}
            className="admin-card mb-6 flex flex-col gap-3"
          >
            <input
              autoFocus
              className="admin-input"
              placeholder="Project title…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <div>
              <label className="admin-label">
                Client Logo (shown at the bottom of every sphere — leave empty
                to use the Gateverse logo)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="admin-input text-gray-400 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-blue-600 file:text-white cursor-pointer"
                onChange={(e) => setLogoFile(e.target.files[0] || null)}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="admin-btn-primary flex items-center gap-2"
              >
                {submitting && <FaSyncAlt size={12} className="animate-spin" />}
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setLogoFile(null);
                }}
                className="admin-btn-secondary"
              >
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
            <p>
              {q
                ? `No projects match “${q}”.`
                : isAdmin
                  ? "No projects yet. Create your first virtual tour."
                  : "No projects assigned to you yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div
                key={project._id}
                className="admin-card flex flex-col gap-3 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-white truncate flex items-center gap-2">
                      {project.info?.title}
                      {project.suspended && (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-900/40 text-red-400 font-normal">
                          Suspended
                        </span>
                      )}
                    </h3>
                    <p className="text-gray-500 text-xs mt-1">
                      {new Date(project.createdAt).toLocaleDateString()}
                      {project.expiry?.mode === "lifetime" && " · lifetime"}
                      {project.expiry?.mode === "date" &&
                        project.expiry?.date &&
                        ` · until ${new Date(project.expiry.date).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                {isAdmin && (
                  <AccessControls
                    project={project}
                    onChanged={(updated) =>
                      setProjects((prev) =>
                        prev.map((p) =>
                          p._id === updated._id
                            ? {
                                ...p,
                                suspended: updated.suspended,
                                expiry: updated.expiry,
                              }
                            : p,
                        ),
                      )
                    }
                  />
                )}
                <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-800">
                  <Link
                    to={`/projects/${project._id}`}
                    className="admin-btn-primary flex items-center gap-1.5 text-xs py-1.5 flex-1 justify-center"
                  >
                    <FaEdit size={11} />
                    Edit
                  </Link>
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => handleExport(project)}
                        disabled={exportingId === project._id}
                        title="Export self-hosted tour (zip)"
                        className="admin-btn-secondary flex items-center gap-1.5 text-xs py-1.5"
                      >
                        {exportingId === project._id ? (
                          <FaSyncAlt size={11} className="animate-spin" />
                        ) : (
                          <FaDownload size={11} />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(project._id)}
                        className="admin-btn-danger flex items-center gap-1.5 text-xs py-1.5"
                      >
                        <FaTrash size={11} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Pager
          page={pageInfo.page}
          pages={pageInfo.pages}
          onPage={setPage}
          className="mt-6"
        />
      </main>
    </div>
  );
}
