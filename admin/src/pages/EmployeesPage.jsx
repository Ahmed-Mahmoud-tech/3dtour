import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../api/adminApi.js";
import { projectApi } from "../api/projectApi.js";
import {
  SearchInput,
  Pager,
  AssignPicker,
  useDebounced,
} from "../components/ui/ListControls.jsx";
import AccountControls from "../components/Auth/AccountControls.jsx";
import {
  FaPlus,
  FaTrash,
  FaGlobe,
  FaSyncAlt,
  FaKey,
  FaUserSlash,
  FaUserCheck,
  FaLink,
} from "react-icons/fa";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

const PAGE_SIZE = 10;

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [pageInfo, setPageInfo] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(search);

  const refresh = async (targetPage = page) => {
    setLoading(true);
    try {
      const data = await adminApi.listEmployees({ q, page: targetPage, limit: PAGE_SIZE });
      setEmployees(data.items);
      setPageInfo({ total: data.total, page: data.page, pages: data.pages });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [q]);

  useEffect(() => {
    refresh(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, page]);

  // Projects with no employee yet, for the assign picker (searchable, paged)
  const fetchAssignableProjects = useCallback(
    ({ q: pickerQ, page: pickerPage }) =>
      projectApi.list({ q: pickerQ, page: pickerPage, limit: 8, noEmployee: 1 }),
    [],
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await adminApi.createEmployee(form);
      setForm({ name: "", email: "", password: "" });
      setCreating(false);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (employee) => {
    const password = window.prompt(
      `New password for ${employee.name} (min 8 chars):`,
    );
    if (!password) return;
    try {
      await adminApi.resetEmployeePassword(employee._id, password);
      window.alert(
        "Password reset. The employee must choose a new password on their next login.",
      );
    } catch (err) {
      window.alert(err.response?.data?.message || err.message);
    }
  };

  const handleToggleStatus = async (employee) => {
    const next = employee.status === "suspended" ? "active" : "suspended";
    if (
      next === "suspended" &&
      !window.confirm(
        `Suspend ${employee.name}? They will not be able to log in.`,
      )
    )
      return;
    await adminApi.updateEmployee(employee._id, { status: next });
    await refresh();
  };

  const handleDelete = async (employee) => {
    if (
      !window.confirm(
        `Delete ${employee.name}'s account? Their projects become unassigned. This cannot be undone.`,
      )
    )
      return;
    await adminApi.deleteEmployee(employee._id);
    // Step back if we just emptied the current page
    if (employees.length === 1 && page > 1) setPage(page - 1);
    else await refresh();
  };

  const handleAssign = async (employee, projectId) => {
    if (!projectId) return;
    await adminApi.assignProjectEmployee(projectId, employee._id);
    await refresh();
  };

  const handleUnassign = async (projectId) => {
    await adminApi.assignProjectEmployee(projectId, null);
    await refresh();
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FaGlobe className="text-blue-400" size={22} />
          <h1 className="text-lg font-bold text-white">360 Tour Admin</h1>
          <nav className="ml-6 flex items-center gap-4 text-sm">
            <Link
              to="/projects"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Projects
            </Link>
            <Link
              to="/clients"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Clients
            </Link>
            <Link to="/employees" className="text-white font-medium">
              Employees
            </Link>
          </nav>
        </div>
        <AccountControls />
      </header>

      <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">
            Employees
            {pageInfo.total > 0 && (
              <span className="text-gray-500 font-normal text-sm ml-2">
                ({pageInfo.total})
              </span>
            )}
          </h2>
          <button
            onClick={() => setCreating((v) => !v)}
            className="admin-btn-primary flex items-center gap-2"
          >
            <FaPlus size={12} />
            New Employee
          </button>
        </div>

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search employees by name or email…"
          className="mb-6 max-w-sm"
        />

        {/* Create form */}
        {creating && (
          <form
            onSubmit={handleCreate}
            className="admin-card mb-6 flex flex-col gap-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                autoFocus
                className="admin-input"
                placeholder="Employee name…"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                className="admin-input"
                type="email"
                placeholder="Email (login)…"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <input
                className="admin-input"
                placeholder="Password (min 8 chars)…"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <p className="text-gray-500 text-xs">
              The employee logs into this admin panel with this email/password
              and only sees the projects you assign to them.
            </p>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex justify-end gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="admin-btn-primary flex items-center gap-2"
              >
                {submitting && <FaSyncAlt size={12} className="animate-spin" />}
                Create employee
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="admin-btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Employee list */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <FaGlobe size={48} className="mx-auto mb-4 opacity-30" />
            <p>
              {q
                ? `No employees match “${q}”.`
                : "No employees yet. Create a staff account and assign projects to it."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {employees.map((employee) => {
              return (
                <div
                  key={employee._id}
                  className="admin-card flex flex-col gap-3"
                >
                  <div className="flex flex-wrap items-center gap-3 justify-between">
                    <div>
                      <h3 className="font-semibold text-white flex items-center gap-2">
                        {employee.name}
                        {employee.status === "suspended" && (
                          <span className="text-xs px-2 py-0.5 rounded bg-red-900/40 text-red-400">
                            Suspended
                          </span>
                        )}
                      </h3>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {employee.email} · created {fmtDate(employee.createdAt)}{" "}
                        · last login {fmtDate(employee.lastLoginAt)}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400">
                      {employee.projects.length} project
                      {employee.projects.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {/* Assigned projects */}
                  <div className="border-t border-gray-800 pt-3">
                    <p className="admin-label mb-2">Assigned projects</p>
                    {employee.projects.length === 0 ? (
                      <p className="text-gray-600 text-xs mb-2">
                        No project assigned yet.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-1.5 mb-2">
                        {employee.projects.map((p) => (
                          <li
                            key={p._id}
                            className="flex items-center gap-3 text-sm text-gray-300"
                          >
                            <FaLink size={10} className="text-gray-600" />
                            <span className="truncate">{p.title}</span>
                            <Link
                              to={`/projects/${p._id}`}
                              className="text-blue-400 hover:text-blue-300 text-xs"
                            >
                              open
                            </Link>
                            <button
                              onClick={() => handleUnassign(p._id)}
                              className="text-gray-600 hover:text-red-400 text-xs ml-auto"
                            >
                              unassign
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <AssignPicker
                      buttonLabel="Assign a project…"
                      placeholder="Search unassigned projects…"
                      fetchPage={fetchAssignableProjects}
                      getLabel={(p) => p.info?.title || "Untitled"}
                      onPick={(p) => handleAssign(employee, p._id)}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 border-t border-gray-800 pt-3">
                    <span className="flex-1" />
                    <button
                      onClick={() => handleResetPassword(employee)}
                      className="admin-btn-secondary text-xs py-1.5 flex items-center gap-1.5"
                    >
                      <FaKey size={11} /> Reset password
                    </button>
                    <button
                      onClick={() => handleToggleStatus(employee)}
                      className="admin-btn-secondary text-xs py-1.5 flex items-center gap-1.5"
                    >
                      {employee.status === "suspended" ? (
                        <>
                          <FaUserCheck size={11} /> Reactivate
                        </>
                      ) : (
                        <>
                          <FaUserSlash size={11} /> Suspend
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(employee)}
                      className="admin-btn-danger text-xs py-1.5 flex items-center gap-1.5"
                    >
                      <FaTrash size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
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
