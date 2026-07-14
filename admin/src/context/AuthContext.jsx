import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);
  const [token, setToken]   = useState(() => localStorage.getItem('admin_token'));
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    if (!token) { setLoading(false); return; }

    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    axios
      .get(`${API_BASE}/auth/me`)
      .then(({ data }) => {
        // The admin studio is admins-only; owners use the client dashboard
        if (data.role !== 'admin') throw new Error('not admin');
        setUser(data);
      })
      .catch(() => {
        // Token expired or invalid — clear it
        localStorage.removeItem('admin_token');
        delete axios.defaults.headers.common['Authorization'];
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const login = async (email, password) => {
    const { data } = await axios.post(`${API_BASE}/auth/login`, { email, password });
    if (data.user?.role !== 'admin') {
      const err = new Error('This panel is for administrators only.');
      err.response = { data: { message: err.message } };
      throw err;
    }
    localStorage.setItem('admin_token', data.token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
