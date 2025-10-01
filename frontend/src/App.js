import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import './App.css';

// Import Components
import LoginPage from './components/LoginPage';
import ManagerDashboard from './components/ManagerDashboard';
import CollaboratorDashboard from './components/CollaboratorDashboard';
import TaskDetails from './components/TaskDetails';
import LoadingSpinner from './components/LoadingSpinner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext();

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, loading: true, error: null };
    case 'LOGIN_SUCCESS':
      localStorage.setItem('token', action.payload.access_token);
      localStorage.setItem('user', JSON.stringify(action.payload.user));
      return {
        ...state,
        loading: false,
        isAuthenticated: true,
        user: action.payload.user,
        token: action.payload.access_token,
        error: null
      };
    case 'LOGIN_ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'LOGOUT':
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        token: null,
        error: null
      };
    case 'LOAD_USER':
      const token = localStorage.getItem('token');
      const user = localStorage.getItem('user');
      if (token && user) {
        return {
          ...state,
          isAuthenticated: true,
          user: JSON.parse(user),
          token: token,
          loading: false
        };
      }
      return { ...state, loading: false };
    default:
      return state;
  }
};

const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, {
    isAuthenticated: false,
    user: null,
    token: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    dispatch({ type: 'LOAD_USER' });
  }, []);

  const login = async (email, password) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      const response = await axios.post(`${API}/auth/login`, {
        email,
        password
      });
      dispatch({ type: 'LOGIN_SUCCESS', payload: response.data });
      toast.success('Login successful!');
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Login failed';
      dispatch({ type: 'LOGIN_ERROR', payload: errorMessage });
      toast.error(errorMessage);
      throw error;
    }
  };

  const register = async (email, password, fullName, role) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      const response = await axios.post(`${API}/auth/register`, {
        email,
        password,
        full_name: fullName,
        role
      });
      dispatch({ type: 'LOGIN_SUCCESS', payload: response.data });
      toast.success('Registration successful!');
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Registration failed';
      dispatch({ type: 'LOGIN_ERROR', payload: errorMessage });
      toast.error(errorMessage);
      throw error;
    }
  };

  const logout = () => {
    dispatch({ type: 'LOGOUT' });
    toast.success('Logged out successfully');
  };

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Configure axios interceptor for auth
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, user, loading } = useAuth();
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  
  return children;
};

// Main App Component
const AppContent = () => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="App min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Routes>
        {!isAuthenticated ? (
          <>
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          <>
            {user?.role === 'manager' ? (
              <>
                <Route path="/dashboard" element={
                  <ProtectedRoute allowedRoles={['manager']}>
                    <ManagerDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/tasks/:taskId" element={
                  <ProtectedRoute allowedRoles={['manager']}>
                    <TaskDetails />
                  </ProtectedRoute>
                } />
              </>
            ) : (
              <>
                <Route path="/dashboard" element={
                  <ProtectedRoute allowedRoles={['collaborator']}>
                    <CollaboratorDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/tasks/:taskId" element={
                  <ProtectedRoute allowedRoles={['collaborator']}>
                    <TaskDetails />
                  </ProtectedRoute>
                } />
              </>
            )}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/unauthorized" element={
              <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
                  <p className="text-gray-600">You don't have permission to access this page.</p>
                </div>
              </div>
            } />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </>
        )}
      </Routes>
      <Toaster position="top-right" />
    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export { useAuth, API };
export default App;