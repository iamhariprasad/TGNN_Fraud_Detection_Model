import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, BarChart, PieChart, Line, Bar, Pie, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, AreaChart, Area
} from 'recharts';
import axios from 'axios';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } }
};

const slideIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } }
};

const slideInLeft = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5 } }
};

const slideInRight = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5 } }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const pulse = {
  animate: {
    scale: [1, 1.05, 1],
    opacity: [1, 0.8, 1],
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' }
  }
};

const float = {
  animate: {
    y: [0, -5, 0],
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' }
  }
};

const shake = {
  animate: {
    x: [0, -5, 5, -5, 5, 0],
    transition: { duration: 0.5, type: 'spring' }
  }
};

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = 'http://localhost:8080/api';
const WS_URL = 'http://localhost:8080/ws';

// Enhanced color palette
const COLORS = {
  primary: '#2563EB',
  primaryLight: '#3B82F6',
  primaryDark: '#1D4ED8',
  secondary: '#10B981',
  secondaryLight: '#34D399',
  danger: '#EF4444',
  dangerLight: '#F87171',
  warning: '#F59E0B',
  warningLight: '#FBBF24',
  info: '#06B6D4',
  infoLight: '#22D3EE',
  dark: '#1F2937',
  darkLight: '#374151',
  light: '#F9FAFB',
  gray: '#6B7280',
  border: '#E5E7EB',
  fraud: '#DC2626',
  legit: '#10B981',
  gradient: {
    primary: 'bg-gradient-to-r from-blue-600 to-blue-800',
    danger: 'bg-gradient-to-r from-red-600 to-red-800',
    success: 'bg-gradient-to-r from-green-600 to-green-800',
    warning: 'bg-gradient-to-r from-yellow-600 to-orange-600'
  }
};

// Risk level styling with animations
const RISK_STYLES = {
  CRITICAL: {
    bg: 'bg-gradient-to-r from-red-600 to-red-800',
    text: 'text-white',
    border: 'border-red-500',
    pulse: true
  },
  HIGH: {
    bg: 'bg-gradient-to-r from-orange-600 to-orange-800',
    text: 'text-white',
    border: 'border-orange-500',
    pulse: false
  },
  MEDIUM: {
    bg: 'bg-gradient-to-r from-yellow-600 to-yellow-800',
    text: 'text-black',
    border: 'border-yellow-500',
    pulse: false
  },
  LOW: {
    bg: 'bg-gradient-to-r from-blue-600 to-blue-800',
    text: 'text-white',
    border: 'border-blue-500',
    pulse: false
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatDateShort = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric'
  });
};

const formatTime = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

// ============================================================================
// API SERVICE
// ============================================================================

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

api.interceptors.response.use((response) => {
  if (response.data && response.data.success === true && response.data.hasOwnProperty('data')) {
    response.data = response.data.data;
  }
  return response;
}, (error) => Promise.reject(error));

export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData)
};

export const userApi = {
  getAll: () => api.get('/users'),
  getById: (id) => api.get(`/users/${id}`)
};

export const accountApi = {
  getAll: () => api.get('/accounts'),
  getById: (id) => api.get(`/accounts/${id}`),
  getByUser: (userId) => api.get(`/accounts/user/${userId}`),
  create: (accountData) => api.post('/accounts', accountData)
};

export const transactionApi = {
  getAll: (page = 0, size = 10) => api.get(`/transactions?page=${page}&size=${size}`),
  getById: (id) => api.get(`/transactions/${id}`),
  getByAccount: (accountId, page = 0, size = 10) => api.get(`/transactions/account/${accountId}?page=${page}&size=${size}`),
  getFraudulent: () => api.get('/transactions/fraudulent'),
  getRecent: (limit = 10) => api.get(`/transactions/recent?limit=${limit}`),
  create: (transactionData) => api.post('/transactions', transactionData),
  updateStatus: (id, status) => api.patch(`/transactions/${id}/status?status=${status}`)
};

export const alertApi = {
  getAll: (page = 0, size = 10) => api.get(`/alerts?page=${page}&size=${size}`),
  getById: (id) => api.get(`/alerts/${id}`),
  getNew: (page = 0, size = 10) => api.get(`/alerts/status/NEW?page=${page}&size=${size}`),
  assign: (alertId, userId) => api.put(`/alerts/${alertId}/status?status=INVESTIGATING`),
  resolve: (alertId, notes) => api.put(`/alerts/${alertId}/status?status=RESOLVED`),
  markFalseAlarm: (alertId) => api.put(`/alerts/${alertId}/status?status=FALSE_ALARM`)
};

// ============================================================================
// WEBSOCKET SERVICE
// ============================================================================

let stompClient = null;
let alertSubscribers = [];

export const connectWebSocket = (onAlert) => {
  if (stompClient && stompClient.connected) {
    return;
  }

  const socket = new SockJS(WS_URL);
  stompClient = Stomp.over(socket);

  stompClient.connect({}, () => {
    console.log('✅ WebSocket connected');
    const subscription = stompClient.subscribe('/topic/fraud-alerts', (message) => {
      const alert = JSON.parse(message.body);
      onAlert(alert);
    });
    alertSubscribers.push(subscription);
  }, (error) => {
    console.error('❌ WebSocket connection error:', error);
    setTimeout(() => connectWebSocket(onAlert), 5000);
  });
};

export const disconnectWebSocket = () => {
  if (stompClient) {
    stompClient.disconnect();
    stompClient = null;
  }
  alertSubscribers = [];
};

// ============================================================================
// CONTEXTS
// ============================================================================

const ThemeContext = React.createContext();

export const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => React.useContext(ThemeContext);

const AuthContext = React.createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    try {
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (token) {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch (e) {
          localStorage.removeItem('user');
        }
      }
    }
  }, [token]);

  const login = async (credentials) => {
    setLoading(true);
    try {
      // Fetch active users from backend to validate username
      const response = await userApi.getAll();
      const usersList = response.data || [];
      const foundUser = usersList.find(
        u => u.username.toLowerCase() === credentials.username.toLowerCase()
      );

      if (foundUser) {
        const dummyToken = 'mock-jwt-token-tgnn-12345';
        localStorage.setItem('token', dummyToken);
        localStorage.setItem('user', JSON.stringify(foundUser));
        setToken(dummyToken);
        setUser(foundUser);
        const from = location.state?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
        return { success: true };
      }
      return { success: false, message: 'Invalid username' };
    } catch (error) {
      return { success: false, message: 'Authentication service unavailable' };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    disconnectWebSocket();
    setToken(null);
    setUser(null);
    navigate('/login');
  };

  const value = { user, token, loading, login, logout, isAuthenticated: !!token };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => React.useContext(AuthContext);

const AlertContext = React.createContext();

export const AlertProvider = ({ children }) => {
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    loadAlerts();
    connectWebSocket((newAlert) => {
      setAlerts(prev => [newAlert, ...prev]);
      setUnreadCount(prev => prev + 1);
    });
    setIsConnected(true);
    return () => disconnectWebSocket();
  }, []);

  const loadAlerts = async (page = 0, size = 10) => {
    try {
      const response = await alertApi.getNew(page, size);
      setAlerts(response.data.content || []);
      setUnreadCount(response.data.content?.length || 0);
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  };

  const markAlertAsRead = (alertId) => {
    setAlerts(prev => prev.map(alert =>
      alert.id === alertId ? { ...alert, status: 'INVESTIGATING' } : alert
    ));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const value = { alerts, unreadCount, isConnected, loadAlerts, markAlertAsRead };

  return (
    <AlertContext.Provider value={value}>
      {children}
    </AlertContext.Provider>
  );
};

export const useAlerts = () => React.useContext(AlertContext);

// ============================================================================
// COMPONENTS
// ============================================================================

// Animated Button
const AnimatedButton = ({
  children,
  onClick,
  type = 'button',
  disabled = false,
  className = '',
  variant = 'primary',
  size = 'md'
}) => {
  const variants = {
    primary: `${COLORS.gradient.primary} hover:opacity-90`,
    secondary: `${COLORS.gradient.success} hover:opacity-90`,
    danger: `${COLORS.gradient.danger} hover:opacity-90`,
    outline: 'border-2 border-blue-500 text-blue-500 hover:bg-blue-50',
    ghost: 'text-gray-600 hover:bg-gray-100'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg font-medium text-white shadow-lg ${variants[variant]} ${sizes[size]} ${className} transition-all duration-300 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      initial="hidden"
      animate="visible"
      variants={scaleIn}
    >
      {children}
    </motion.button>
  );
};

// Animated Input
const AnimatedInput = ({
  label,
  type = 'text',
  value,
  onChange,
  name,
  placeholder = '',
  error = '',
  className = '',
  icon
}) => {
  return (
    <motion.div
      className={`mb-4 ${className}`}
      initial="hidden"
      animate="visible"
      variants={slideIn}
    >
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={onChange}
          name={name}
          placeholder={placeholder}
          className={`w-full ${icon ? 'pl-10' : 'pl-3'} pr-3 py-2 border-2 border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 ${error ? 'border-red-500' : 'hover:border-gray-300'}`}
        />
      </div>
      {error && (
        <motion.p
          className="mt-1 text-sm text-red-600"
          initial="hidden"
          animate="visible"
          variants={fadeIn}
        >
          {error}
        </motion.p>
      )}
    </motion.div>
  );
};

// Animated Badge
const AnimatedBadge = ({
  children,
  color = 'blue',
  className = '',
  pulse = false
}) => {
  const colors = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    orange: 'bg-orange-500',
    purple: 'bg-purple-500'
  };

  return (
    <motion.span
      className={`px-2.5 py-1 rounded-full text-xs font-bold text-white ${colors[color]} ${className}`}
      initial="hidden"
      animate="visible"
      variants={scaleIn}
      {...(pulse && { animate: { scale: [1, 1.1, 1] }, transition: { duration: 2, repeat: Infinity } })}
    >
      {children}
    </motion.span>
  );
};

// Risk Badge with Animation
const RiskBadge = ({ riskLevel }) => {
  const style = RISK_STYLES[riskLevel] || RISK_STYLES.LOW;

  return (
    <motion.span
      className={`px-2.5 py-1 rounded-full text-xs font-bold ${style.text} ${style.bg} border-2 ${style.border} shadow-md`}
      initial="hidden"
      animate="visible"
      variants={scaleIn}
      {...(style.pulse && pulse)}
    >
      {riskLevel}
    </motion.span>
  );
};

// Status Badge
const StatusBadge = ({ status }) => {
  const getStatusStyle = (status) => {
    switch (status) {
      case 'FLAGGED': return { bg: 'bg-red-500', text: 'text-white' };
      case 'COMPLETED': return { bg: 'bg-green-500', text: 'text-white' };
      case 'PENDING': return { bg: 'bg-yellow-500', text: 'text-black' };
      case 'FAILED': return { bg: 'bg-gray-500', text: 'text-white' };
      default: return { bg: 'bg-blue-500', text: 'text-white' };
    }
  };

  const style = getStatusStyle(status);

  return (
    <motion.span
      className={`px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text} shadow-md`}
      initial="hidden"
      animate="visible"
      variants={scaleIn}
    >
      {status}
    </motion.span>
  );
};

// Alert Badge
const AlertBadge = ({ status }) => {
  const getAlertStyle = (status) => {
    switch (status) {
      case 'NEW': return { bg: 'bg-red-500', text: 'text-white', pulse: true };
      case 'INVESTIGATING': return { bg: 'bg-yellow-500', text: 'text-black', pulse: false };
      case 'RESOLVED': return { bg: 'bg-green-500', text: 'text-white', pulse: false };
      case 'FALSE_ALARM': return { bg: 'bg-gray-500', text: 'text-white', pulse: false };
      default: return { bg: 'bg-blue-500', text: 'text-white', pulse: false };
    }
  };

  const style = getAlertStyle(status);

  return (
    <motion.span
      className={`px-2.5 py-1 rounded-full text-xs font-bold ${style.bg} ${style.text} shadow-md`}
      initial="hidden"
      animate="visible"
      variants={scaleIn}
      {...(style.pulse && pulse)}
    >
      {status}
    </motion.span>
  );
};

// Animated Card
const AnimatedCard = ({
  children,
  className = '',
  hoverEffect = true,
  delay = 0
}) => {
  return (
    <motion.div
      className={`bg-white rounded-xl shadow-lg p-6 ${className}`}
      initial="hidden"
      animate="visible"
      variants={slideIn}
      transition={{ delay }}
      whileHover={hoverEffect ? { y: -5, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' } : {}}
    >
      {children}
    </motion.div>
  );
};

// Loading Spinner with Animation
const LoadingSpinner = ({ size = 'md', message = 'Loading...' }) => {
  const sizes = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-4',
    lg: 'w-16 h-16 border-6'
  };

  return (
    <motion.div
      className="flex flex-col items-center justify-center"
      initial="hidden"
      animate="visible"
      variants={fadeIn}
    >
      <motion.div
        className={`animate-spin rounded-full border-blue-500 border-t-transparent ${sizes[size]}`}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      <motion.p
        className="mt-2 text-sm text-gray-500"
        initial="hidden"
        animate="visible"
        variants={fadeIn}
        transition={{ delay: 0.2 }}
      >
        {message}
      </motion.p>
    </motion.div>
  );
};

// Empty State with Animation
const EmptyState = ({ message, icon, subtitle }) => {
  return (
    <motion.div
      className="text-center py-16"
      initial="hidden"
      animate="visible"
      variants={fadeIn}
    >
      <motion.div
        className="text-8xl mb-4"
        animate={float}
      >
        {icon}
      </motion.div>
      <motion.h3
        className="text-xl font-bold text-gray-900"
        initial="hidden"
        animate="visible"
        variants={slideIn}
        transition={{ delay: 0.2 }}
      >
        {message}
      </motion.h3>
      {subtitle && (
        <motion.p
          className="text-gray-500 mt-2"
          initial="hidden"
          animate="visible"
          variants={fadeIn}
          transition={{ delay: 0.4 }}
        >
          {subtitle}
        </motion.p>
      )}
    </motion.div>
  );
};

// Modal with Animation
const AnimatedModal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    full: 'max-w-full'
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className={`bg-white rounded-2xl shadow-2xl w-full ${sizes[size]} max-h-[90vh] overflow-y-auto`}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 500 }}
          >
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <motion.h3
                className="text-xl font-bold text-gray-900"
                initial="hidden"
                animate="visible"
                variants={slideIn}
              >
                {title}
              </motion.h3>
              <motion.button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-1"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.button>
            </div>
            <motion.div
              className="p-6"
              initial="hidden"
              animate="visible"
              variants={fadeIn}
            >
              {children}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Toast Notification
const Toast = ({ message, type = 'success', onClose }) => {
  const types = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500'
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      className={`fixed bottom-6 right-6 text-white px-4 py-3 rounded-lg shadow-xl ${types[type]} flex items-center space-x-2 z-50`}
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ type: 'spring', damping: 25, stiffness: 500 }}
    >
      <span>{message}</span>
      <button onClick={onClose} className="text-white hover:text-gray-200">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </motion.div>
  );
};

// Toast Provider
const ToastContext = React.createContext();

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <AnimatePresence>
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </AnimatePresence>
    </ToastContext.Provider>
  );
};

export const useToast = () => React.useContext(ToastContext);

// ============================================================================
// LAYOUT COMPONENTS
// ============================================================================

// Animated Sidebar
const AnimatedSidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/transactions', label: 'Transactions', icon: '💰' },
    { path: '/alerts', label: 'Fraud Alerts', icon: '🚨', roles: ['ADMIN', 'ANALYST'] },
    { path: '/accounts', label: 'Accounts', icon: '🏦' },
    { path: '/analytics', label: 'Analytics', icon: '📈', roles: ['ADMIN', 'ANALYST'] },
    { path: '/network', label: 'Network Graph', icon: '🔗', roles: ['ADMIN', 'ANALYST'] },
    { path: '/transactions/new', label: 'New Transaction', icon: '➕' }
  ].filter(item => !item.roles || item.roles.includes(user?.role));

  return (
    <motion.div
      className="fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-gray-800 to-gray-900 text-white z-40 shadow-2xl"
      initial={{ x: -250 }}
      animate={{ x: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
    >
      <motion.div
        className="p-4 border-b border-gray-700"
        initial="hidden"
        animate="visible"
        variants={slideIn}
      >
        <motion.h1
          className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400"
          animate={pulse}
        >
          Fraud Shield
        </motion.h1>
      </motion.div>

      <motion.nav
        className="mt-4"
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
      >
        {navItems.map((item, index) => (
          <motion.div key={item.path} variants={staggerItem}>
            <Link
              to={item.path}
              className={`flex items-center px-4 py-3 text-sm font-medium transition-all duration-300 ${location.pathname === item.path
                  ? 'bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              whileHover={{ x: 5 }}
            >
              <motion.span
                className="mr-3 text-xl"
                whileHover={{ scale: 1.2 }}
              >
                {item.icon}
              </motion.span>
              {item.label}
            </Link>
          </motion.div>
        ))}
      </motion.nav>

      <motion.div
        className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700"
        initial="hidden"
        animate="visible"
        variants={slideIn}
        transition={{ delay: 0.5 }}
      >
        <motion.div
          className="flex items-center"
          whileHover={{ scale: 1.02 }}
        >
          <motion.div
            className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg"
            animate={pulse}
          >
            {user?.firstName?.charAt(0) || 'U'}
          </motion.div>
          <div className="ml-3">
            <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-gray-400">{user?.role}</p>
          </div>
        </motion.div>
        <motion.div
          className="mt-4"
          initial="hidden"
          animate="visible"
          variants={slideIn}
          transition={{ delay: 0.6 }}
        >
          <AnimatedButton
            onClick={logout}
            className="w-full"
            variant="outline"
          >
            <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </AnimatedButton>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

// Animated Header
const AnimatedHeader = () => {
  const { unreadCount } = useAlerts();
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <motion.header
      className="fixed top-0 left-64 right-0 bg-white border-b border-gray-200 z-30 shadow-sm"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
    >
      <div className="flex items-center justify-between p-4">
        <motion.div
          className="flex items-center"
          initial="hidden"
          animate="visible"
          variants={slideInLeft}
        >
          <motion.h2
            className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600"
            animate={pulse}
          >
            Fraud Detection System
          </motion.h2>
        </motion.div>

        <motion.div
          className="flex items-center space-x-4"
          initial="hidden"
          animate="visible"
          variants={slideInRight}
        >
          {/* Dark Mode Toggle */}
          <motion.div
            className="relative"
            whileHover={{ scale: 1.1 }}
          >
            <motion.button
              onClick={toggleDarkMode}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full cursor-pointer relative outline-none border-none flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
              title="Toggle Theme"
            >
              {darkMode ? (
                <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M14 12a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </motion.button>
          </motion.div>

          <motion.div
            className="relative"
            whileHover={{ scale: 1.1 }}
          >
            <Link to="/alerts" className="flex items-center space-x-1">
              <motion.div
                className="relative"
                animate={unreadCount > 0 ? pulse : {}}
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <motion.span
                    className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  >
                    {unreadCount}
                  </motion.span>
                )}
              </motion.div>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </motion.header>
  );
};

// Main Layout with Animations
const AnimatedLayout = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <AnimatedSidebar />
      <div className="ml-64">
        <AnimatedHeader />
        <motion.main
          className="p-6 pt-20"
          initial="hidden"
          animate="visible"
          variants={fadeIn}
          transition={{ delay: 0.2 }}
        >
          <Outlet />
        </motion.main>
      </div>
    </motion.div>
  );
};

// ============================================================================
// PAGES
// ============================================================================

// Animated Login Page
const AnimatedLoginPage = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await login(formData);

    if (!result.success) {
      setErrors({ general: 'Invalid username or password' });
      // Shake animation for error
    }

    setIsLoading(false);
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="sm:mx-auto sm:w-full sm:max-w-md"
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
      >
        <motion.div
          className="text-center"
          variants={staggerItem}
        >
          <motion.div
            className="mx-auto w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-2xl mb-6"
            animate={float}
          >
            <span className="text-4xl">🔒</span>
          </motion.div>
          <motion.h2
            className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600"
            variants={staggerItem}
          >
            Fraud Shield
          </motion.h2>
          <motion.p
            className="mt-2 text-sm text-gray-600"
            variants={staggerItem}
          >
            AI-Powered Fraud Detection System
          </motion.p>
        </motion.div>

        <motion.div
          className="mt-8 sm:mx-auto sm:w-full sm:max-w-md"
          variants={staggerItem}
        >
          <motion.div
            className="bg-white py-8 px-4 shadow-2xl rounded-2xl sm:px-10"
            initial="hidden"
            animate="visible"
            variants={slideIn}
          >
            {errors.general && (
              <motion.div
                className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded-lg"
                initial="hidden"
                animate="visible"
                variants={shake}
              >
                <p className="text-red-700">{errors.general}</p>
              </motion.div>
            )}

            <form className="space-y-6" onSubmit={handleSubmit}>
              <AnimatedInput
                label="Username"
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Enter your username"
                icon="👤"
                required
              />

              <AnimatedInput
                label="Password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                icon="🔑"
                required
              />

              <motion.div
                initial="hidden"
                animate="visible"
                variants={slideIn}
                transition={{ delay: 0.2 }}
              >
                <AnimatedButton
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  size="lg"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <LoadingSpinner size="sm" />
                      <span className="ml-2">Signing in...</span>
                    </span>
                  ) : (
                    'Sign in'
                  )}
                </AnimatedButton>
              </motion.div>
            </form>

            <motion.div
              className="mt-6 text-center text-sm text-gray-500"
              initial="hidden"
              animate="visible"
              variants={fadeIn}
              transition={{ delay: 0.4 }}
            >
              <p>Don't have an account? Contact administrator</p>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Floating elements for visual appeal */}
      <motion.div
        className="fixed bottom-10 left-10 w-16 h-16 bg-blue-200 rounded-full opacity-50"
        animate={float}
        transition={{ delay: 0.5 }}
      />
      <motion.div
        className="fixed bottom-20 right-20 w-24 h-24 bg-purple-200 rounded-full opacity-50"
        animate={float}
        transition={{ delay: 1 }}
      />
      <motion.div
        className="fixed top-20 right-10 w-12 h-12 bg-indigo-200 rounded-full opacity-50"
        animate={float}
        transition={{ delay: 1.5 }}
      />
    </motion.div>
  );
};

// Animated Dashboard Page
const AnimatedDashboardPage = () => {
  const [stats, setStats] = useState({
    totalTransactions: 0,
    fraudulent: 0,
    flagged: 0,
    newAlerts: 0
  });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [fraudByDay, setFraudByDay] = useState([]);
  const [riskDistribution, setRiskDistribution] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const [transactionsRes, fraudRes, alertsRes] = await Promise.all([
        transactionApi.getRecent(10),
        transactionApi.getFraudulent(),
        alertApi.getNew(0, 5)
      ]);

      setRecentTransactions(transactionsRes.data.slice(0, 5));
      setRecentAlerts(alertsRes.data.content.slice(0, 5));

      // Mock stats for demo
      setStats({
        totalTransactions: 12453,
        fraudulent: fraudRes.data.length,
        flagged: 42,
        newAlerts: alertsRes.data.content.length
      });

      // Chart data
      setFraudByDay([
        { name: 'Mon', fraud: 4, legit: 120 },
        { name: 'Tue', fraud: 3, legit: 150 },
        { name: 'Wed', fraud: 6, legit: 140 },
        { name: 'Thu', fraud: 2, legit: 130 },
        { name: 'Fri', fraud: 5, legit: 160 },
        { name: 'Sat', fraud: 1, legit: 90 },
        { name: 'Sun', fraud: 2, legit: 80 }
      ]);

      setRiskDistribution([
        { name: 'Low', value: 65, color: COLORS.lowRisk },
        { name: 'Medium', value: 20, color: COLORS.warning },
        { name: 'High', value: 10, color: COLORS.highRisk },
        { name: 'Critical', value: 5, color: COLORS.danger }
      ]);

      // Show welcome toast
      addToast('Welcome to Fraud Shield! Your system is ready.', 'success');

    } catch (error) {
      console.error('Error loading dashboard:', error);
      addToast('Error loading dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <motion.div
        className="flex justify-center items-center h-96"
        initial="hidden"
        animate="visible"
        variants={fadeIn}
      >
        <LoadingSpinner size="lg" message="Loading dashboard..." />
      </motion.div>
    );
  }

  return (
    <motion.div
      className="space-y-8"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      {/* Animated Stats Cards */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        variants={staggerContainer}
      >
        {[
          { title: 'Total Transactions', value: stats.totalTransactions.toLocaleString(), icon: '💰', color: 'blue', trend: 'up', trendValue: '12%' },
          { title: 'Fraudulent', value: stats.fraudulent, icon: '🚨', color: 'red', trend: 'down', trendValue: '5%' },
          { title: 'Flagged', value: stats.flagged, icon: '🔴', color: 'orange', trend: 'up', trendValue: '8%' },
          { title: 'New Alerts', value: stats.newAlerts, icon: '🔔', color: 'yellow', trend: 'up', trendValue: '3' }
        ].map((stat, index) => (
          <motion.div key={stat.title} variants={staggerItem}>
            <AnimatedStatCard {...stat} delay={index * 0.1} />
          </motion.div>
        ))}
      </motion.div>

      {/* Animated Charts Row */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
      >
        <motion.div variants={staggerItem}>
          <AnimatedChartCard title="Fraud vs Legitimate Transactions">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={fraudByDay}>
                <defs>
                  <linearGradient id="fraudGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.danger} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={COLORS.danger} stopOpacity={0.2} />
                  </linearGradient>
                  <linearGradient id="legitGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.secondary} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={COLORS.secondary} stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: '10px' }}
                  itemStyle={{ color: 'white' }}
                />
                <Legend wrapperStyle={{ color: '#666' }} />
                <Bar dataKey="fraud" name="Fraud" stackId="a" fill="url(#fraudGradient)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="legit" name="Legitimate" stackId="a" fill="url(#legitGradient)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </AnimatedChartCard>
        </motion.div>

        <motion.div variants={staggerItem}>
          <AnimatedChartCard title="Risk Distribution">
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={riskDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  innerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  paddingAngle={5}
                >
                  {riskDistribution.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      stroke="white"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: '10px' }}
                  itemStyle={{ color: 'white' }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '20px' }}
                  formatter={(value) => <span style={{ color: '#666' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </AnimatedChartCard>
        </motion.div>
      </motion.div>

      {/* Animated Recent Activity */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
      >
        <motion.div variants={staggerItem}>
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">💰</span>
            Recent Transactions
          </h3>
          <AnimatedCard>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sender → Receiver</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentTransactions.map((tx, index) => (
                    <motion.tr
                      key={tx.id}
                      className="hover:bg-gray-50"
                      initial="hidden"
                      animate="visible"
                      variants={slideIn}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ backgroundColor: '#f9fafb' }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {tx.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        Acc-{tx.senderId} → Acc-{tx.receiverId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <RiskBadge riskLevel={tx.riskLevel || 'LOW'} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={tx.status || 'COMPLETED'} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatTime(tx.createdAt)}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {recentTransactions.length === 0 && (
                <EmptyState message="No recent transactions" icon="💰" subtitle="Create a transaction to see it here" />
              )}
            </div>
          </AnimatedCard>
        </motion.div>

        <motion.div variants={staggerItem}>
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">🚨</span>
            Recent Fraud Alerts
          </h3>
          <AnimatedCard>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentAlerts.map((alert, index) => (
                    <motion.tr
                      key={alert.id}
                      className={`hover:bg-gray-50 ${alert.status === 'NEW' ? 'bg-red-50' : ''}`}
                      initial="hidden"
                      animate="visible"
                      variants={slideIn}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ backgroundColor: '#fef2f2' }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {alert.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        TX-{alert.transactionId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <AnimatedBadge color={alert.severity === 'CRITICAL' ? 'red' : alert.severity === 'HIGH' ? 'orange' : 'yellow'}>
                          {alert.severity}
                        </AnimatedBadge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <AlertBadge status={alert.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatTime(alert.createdAt)}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {recentAlerts.length === 0 && (
                <EmptyState message="No recent alerts" icon="🚨" subtitle="Fraud alerts will appear here in real-time" />
              )}
            </div>
          </AnimatedCard>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

// Animated Stat Card
const AnimatedStatCard = ({ title, value, icon, color, trend, trendValue, delay = 0 }) => {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-700',
    red: 'from-red-500 to-red-700',
    orange: 'from-orange-500 to-orange-700',
    yellow: 'from-yellow-500 to-yellow-700',
    green: 'from-green-500 to-green-700'
  };

  const trendColor = trend === 'up' ? 'text-green-500' : 'text-red-500';
  const trendIcon = trend === 'up' ? '↑' : '↓';

  return (
    <motion.div
      className="bg-white overflow-hidden rounded-2xl shadow-lg relative"
      initial="hidden"
      animate="visible"
      variants={slideIn}
      transition={{ delay }}
      whileHover={{ y: -10, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
    >
      <motion.div
        className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colorClasses[color]} rounded-full -mr-16 -mt-16 opacity-20`}
        animate={float}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="p-6 relative z-10">
        <div className="flex items-center">
          <motion.div
            className={`rounded-xl p-4 mr-4 bg-gradient-to-br ${colorClasses[color]} shadow-lg`}
            animate={pulse}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <span className="text-3xl">{icon}</span>
          </motion.div>
          <div>
            <motion.p
              className="text-sm font-medium text-gray-500"
              initial="hidden"
              animate="visible"
              variants={slideIn}
              transition={{ delay: 0.1 }}
            >
              {title}
            </motion.p>
            <motion.p
              className="text-3xl font-bold text-gray-900 mt-1"
              initial="hidden"
              animate="visible"
              variants={slideIn}
              transition={{ delay: 0.2 }}
            >
              {value}
            </motion.p>
          </div>
        </div>
      </div>

      <motion.div
        className={`bg-gray-50 px-6 py-3 flex items-center ${trendColor}`}
        initial="hidden"
        animate="visible"
        variants={slideIn}
        transition={{ delay: 0.3 }}
      >
        <span className="text-xs font-medium">{trendIcon} {trendValue}</span>
      </motion.div>
    </motion.div>
  );
};

// Animated Chart Card
const AnimatedChartCard = ({ title, children }) => {
  return (
    <motion.div
      className="bg-white rounded-2xl shadow-lg p-6"
      initial="hidden"
      animate="visible"
      variants={slideIn}
      whileHover={{ y: -5, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}
    >
      <motion.h3
        className="text-lg font-bold text-gray-900 mb-1 flex items-center"
        initial="hidden"
        animate="visible"
        variants={slideIn}
      >
        <span className="mr-2">📊</span>
        {title}
      </motion.h3>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeIn}
        transition={{ delay: 0.1 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
};

// Animated Transactions Page
const AnimatedTransactionsPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [filters, setFilters] = useState({
    status: '',
    isFraud: '',
    riskLevel: '',
    search: ''
  });
  const [showModal, setShowModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const { addToast } = useToast();

  useEffect(() => {
    loadTransactions();
  }, [page, size, filters]);

  const loadTransactions = async () => {
    try {
      setLoading(true);

      let endpoint = `/transactions?page=${page}&size=${size}`;

      if (filters.status) endpoint += `&status=${filters.status}`;
      if (filters.isFraud) endpoint += `&isFraud=${filters.isFraud}`;
      if (filters.riskLevel) endpoint += `&riskLevel=${filters.riskLevel}`;
      if (filters.search) endpoint += `&search=${filters.search}`;

      const response = await api.get(endpoint);
      setTransactions(response.data.content || []);
      setTotalPages(response.data.totalPages || 0);

    } catch (error) {
      console.error('Error loading transactions:', error);
      addToast('Error loading transactions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
    setPage(0);
  };

  const viewDetails = (transaction) => {
    setSelectedTransaction(transaction);
    setShowModal(true);
  };

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      <motion.div
        className="flex flex-col md:flex-row justify-between items-center"
        variants={staggerItem}
      >
        <motion.h1
          className="text-2xl font-bold text-gray-900"
          initial="hidden"
          animate="visible"
          variants={slideInLeft}
        >
          Transaction History
        </motion.h1>
        <motion.div
          className="flex space-x-2 mt-4 md:mt-0"
          initial="hidden"
          animate="visible"
          variants={slideInRight}
        >
          <AnimatedButton onClick={() => loadTransactions()}>
            <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h5M20 20v-5h-5M4 20h5v-5M20 4h-5v5" />
            </svg>
            Refresh
          </AnimatedButton>
          <Link to="/transactions/new">
            <AnimatedButton variant="secondary">
              <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              New Transaction
            </AnimatedButton>
          </Link>
        </motion.div>
      </motion.div>

      {/* Animated Filters */}
      <motion.div
        className="bg-white rounded-2xl shadow-lg p-6"
        initial="hidden"
        animate="visible"
        variants={slideIn}
      >
        <motion.h3
          className="text-lg font-semibold text-gray-900 mb-4"
          initial="hidden"
          animate="visible"
          variants={slideIn}
        >
          Filters
        </motion.h3>
        <motion.div
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          {[
            { name: 'status', label: 'Status', options: ['', 'PENDING', 'COMPLETED', 'FLAGGED', 'FAILED'] },
            { name: 'isFraud', label: 'Type', options: ['', 'true', 'false'] },
            { name: 'riskLevel', label: 'Risk Level', options: ['', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
            { name: 'search', label: 'Search', type: 'text' }
          ].map((filter, index) => (
            <motion.div key={filter.name} variants={staggerItem}>
              {filter.type === 'text' ? (
                <AnimatedInput
                  label={filter.label}
                  type="text"
                  name={filter.name}
                  value={filters[filter.name]}
                  onChange={handleFilterChange}
                  placeholder={`Search ${filter.label.toLowerCase()}...`}
                />
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{filter.label}</label>
                  <select
                    name={filter.name}
                    value={filters[filter.name]}
                    onChange={handleFilterChange}
                    className="block w-full px-3 py-2 border-2 border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                  >
                    {filter.options.map(option => (
                      <option key={option} value={option}>
                        {option || `All ${filter.label}s`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Animated Transactions Table */}
      <motion.div
        className="bg-white rounded-2xl shadow-lg overflow-hidden"
        initial="hidden"
        animate="visible"
        variants={slideIn}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fraud Score</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <motion.tr initial="hidden" animate="visible" variants={fadeIn}>
                  <td colSpan="8" className="px-6 py-4 text-center">
                    <LoadingSpinner size="md" />
                  </td>
                </motion.tr>
              ) : transactions.length === 0 ? (
                <motion.tr initial="hidden" animate="visible" variants={fadeIn}>
                  <td colSpan="8">
                    <EmptyState
                      message="No transactions found"
                      icon="💰"
                      subtitle="Try adjusting your filters"
                    />
                  </td>
                </motion.tr>
              ) : (
                transactions.map((tx, index) => (
                  <motion.tr
                    key={tx.id}
                    className="hover:bg-gray-50"
                    initial="hidden"
                    animate="visible"
                    variants={slideIn}
                    transition={{ delay: index * 0.03 }}
                    whileHover={{ backgroundColor: '#f9fafb' }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {tx.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      Acc-{tx.senderId} → Acc-{tx.receiverId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center">
                        <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                          <motion.div
                            className="bg-red-500 h-2 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${(tx.fraudScore || 0) * 100}%` }}
                            transition={{ duration: 0.5, delay: index * 0.05 }}
                          />
                        </div>
                        <span className="text-xs font-medium">
                          {(tx.fraudScore || 0) * 100}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <RiskBadge riskLevel={tx.riskLevel || 'LOW'} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={tx.status || 'COMPLETED'} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(tx.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <motion.button
                        onClick={() => viewDetails(tx)}
                        className="text-blue-600 hover:text-blue-900"
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </motion.button>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Pagination */}
      {totalPages > 0 && (
        <motion.div
          className="flex items-center justify-between"
          initial="hidden"
          animate="visible"
          variants={slideIn}
        >
          <motion.div
            className="text-sm text-gray-500"
            initial="hidden"
            animate="visible"
            variants={slideInLeft}
          >
            Showing {page * size + 1}-{Math.min((page + 1) * size, transactions.length)} of {transactions.length}
          </motion.div>
          <motion.div
            className="flex space-x-2"
            initial="hidden"
            animate="visible"
            variants={slideInRight}
          >
            <AnimatedButton
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              variant="outline"
            >
              Previous
            </AnimatedButton>
            <motion.span
              className="px-4 py-2 text-sm font-medium"
              initial="hidden"
              animate="visible"
              variants={scaleIn}
            >
              Page {page + 1} of {totalPages}
            </motion.span>
            <AnimatedButton
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              variant="outline"
            >
              Next
            </AnimatedButton>
          </motion.div>
        </motion.div>
      )}

      {/* Transaction Details Modal */}
      <AnimatedModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={`Transaction #${selectedTransaction?.id}`}
        size="lg"
      >
        {selectedTransaction && (
          <motion.div
            className="space-y-6"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
              variants={staggerItem}
            >
              <motion.div variants={staggerItem}>
                <p className="text-sm font-medium text-gray-500 mb-1">Sender Account</p>
                <p className="text-xl font-bold text-blue-600">Acc-{selectedTransaction.senderId}</p>
              </motion.div>
              <motion.div variants={staggerItem}>
                <p className="text-sm font-medium text-gray-500 mb-1">Receiver Account</p>
                <p className="text-xl font-bold text-blue-600">Acc-{selectedTransaction.receiverId}</p>
              </motion.div>
              <motion.div variants={staggerItem}>
                <p className="text-sm font-medium text-gray-500 mb-1">Amount</p>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(selectedTransaction.amount)}
                </p>
              </motion.div>
              <motion.div variants={staggerItem}>
                <p className="text-sm font-medium text-gray-500 mb-1">Currency</p>
                <p className="text-xl font-bold">{selectedTransaction.currency || 'USD'}</p>
              </motion.div>
            </motion.div>

            <motion.div
              className="border-t border-gray-200 pt-6"
              variants={staggerItem}
            >
              <motion.div
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
                variants={staggerContainer}
              >
                <motion.div variants={staggerItem}>
                  <p className="text-sm font-medium text-gray-500 mb-2">Fraud Probability</p>
                  <div className="flex items-center">
                    <div className="w-full bg-gray-200 rounded-full h-3 mr-3">
                      <motion.div
                        className="bg-gradient-to-r from-red-500 to-pink-500 h-3 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${(selectedTransaction.fraudScore || 0) * 100}%` }}
                        transition={{ duration: 0.8, type: 'spring' }}
                      />
                    </div>
                    <motion.span
                      className="text-lg font-bold text-red-600"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      {(selectedTransaction.fraudScore || 0) * 100}%
                    </motion.span>
                  </div>
                </motion.div>
                <motion.div variants={staggerItem}>
                  <p className="text-sm font-medium text-gray-500 mb-2">Risk Level</p>
                  <RiskBadge riskLevel={selectedTransaction.riskLevel || 'LOW'} />
                </motion.div>
                <motion.div variants={staggerItem}>
                  <p className="text-sm font-medium text-gray-500 mb-2">Status</p>
                  <StatusBadge status={selectedTransaction.status || 'COMPLETED'} />
                </motion.div>
              </motion.div>
            </motion.div>

            <motion.div
              className="border-t border-gray-200 pt-6"
              variants={staggerItem}
            >
              <p className="text-sm font-medium text-gray-500 mb-2">Description</p>
              <p className="text-gray-700">
                {selectedTransaction.description || 'No description provided'}
              </p>
            </motion.div>

            <motion.div
              className="border-t border-gray-200 pt-6"
              variants={staggerItem}
            >
              <p className="text-sm font-medium text-gray-500 mb-2">Created At</p>
              <p className="text-gray-700">{formatDate(selectedTransaction.createdAt)}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatedModal>
    </motion.div>
  );
};

// Animated Alerts Page
const AnimatedAlertsPage = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const { unreadCount, markAlertAsRead, loadAlerts: loadContextAlerts } = useAlerts();
  const { addToast } = useToast();

  useEffect(() => {
    loadAlerts();
  }, [page, size]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const response = await alertApi.getNew(page, size);
      setAlerts(response.data.content || []);
      setTotalPages(response.data.totalPages || 0);
    } catch (error) {
      console.error('Error loading alerts:', error);
      addToast('Error loading alerts', 'error');
    } finally {
      setLoading(false);
    }
  };

  const viewDetails = (alert) => {
    setSelectedAlert(alert);
    setShowModal(true);
    markAlertAsRead(alert.id);
  };

  const handleAssign = async (alertId) => {
    try {
      await alertApi.assign(alertId, 1);
      loadAlerts();
      loadContextAlerts();
      addToast('Alert assigned to you', 'success');
    } catch (error) {
      console.error('Error assigning alert:', error);
      addToast('Error assigning alert', 'error');
    }
  };

  const handleResolve = async (alertId, notes) => {
    try {
      await alertApi.resolve(alertId, notes);
      loadAlerts();
      loadContextAlerts();
      setShowModal(false);
      addToast('Alert resolved', 'success');
    } catch (error) {
      console.error('Error resolving alert:', error);
      addToast('Error resolving alert', 'error');
    }
  };

  const handleFalseAlarm = async (alertId) => {
    try {
      await alertApi.markFalseAlarm(alertId);
      loadAlerts();
      loadContextAlerts();
      setShowModal(false);
      addToast('Marked as false alarm', 'success');
    } catch (error) {
      console.error('Error marking as false alarm:', error);
      addToast('Error marking as false alarm', 'error');
    }
  };

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      <motion.div
        className="flex justify-between items-center"
        variants={staggerItem}
      >
        <motion.h1
          className="text-2xl font-bold text-gray-900"
          initial="hidden"
          animate="visible"
          variants={slideInLeft}
        >
          Fraud Alerts
        </motion.h1>
        <motion.div
          initial="hidden"
          animate="visible"
          variants={slideInRight}
        >
          <AnimatedButton onClick={() => loadAlerts()}>
            <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h5M20 20v-5h-5M4 20h5v-5M20 4h-5v5" />
            </svg>
            Refresh
          </AnimatedButton>
        </motion.div>
      </motion.div>

      {/* Animated Stats */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
      >
        <motion.div variants={staggerItem}>
          <AnimatedStatCard
            title="New Alerts"
            value={unreadCount}
            icon="🔴"
            color="red"
            trend="up"
            trendValue="Live"
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <AnimatedStatCard
            title="Investigating"
            value={alerts.filter(a => a.status === 'INVESTIGATING').length}
            icon="🔍"
            color="yellow"
            trend="up"
            trendValue="Active"
          />
        </motion.div>
        <motion.div variants={staggerItem}>
          <AnimatedStatCard
            title="Resolved"
            value={alerts.filter(a => a.status === 'RESOLVED' || a.status === 'FALSE_ALARM').length}
            icon="✅"
            color="green"
            trend="up"
            trendValue="Closed"
          />
        </motion.div>
      </motion.div>

      {/* Animated Alerts Table */}
      <motion.div
        className="bg-white rounded-2xl shadow-lg overflow-hidden"
        initial="hidden"
        animate="visible"
        variants={slideIn}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <motion.tr initial="hidden" animate="visible" variants={fadeIn}>
                  <td colSpan="7" className="px-6 py-4 text-center">
                    <LoadingSpinner size="md" />
                  </td>
                </motion.tr>
              ) : alerts.length === 0 ? (
                <motion.tr initial="hidden" animate="visible" variants={fadeIn}>
                  <td colSpan="7">
                    <EmptyState
                      message="No fraud alerts"
                      icon="🚨"
                      subtitle="Fraud alerts will appear here in real-time as they are detected"
                    />
                  </td>
                </motion.tr>
              ) : (
                alerts.map((alert, index) => (
                  <motion.tr
                    key={alert.id}
                    className={`hover:bg-gray-50 ${alert.status === 'NEW' ? 'bg-red-50' : ''}`}
                    initial="hidden"
                    animate="visible"
                    variants={slideIn}
                    transition={{ delay: index * 0.03 }}
                    whileHover={{ backgroundColor: '#fef2f2' }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {alert.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      TX-{alert.transactionId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <AnimatedBadge
                        color={alert.severity === 'CRITICAL' ? 'red' : alert.severity === 'HIGH' ? 'orange' : 'yellow'}
                        pulse={alert.severity === 'CRITICAL'}
                      >
                        {alert.severity}
                      </AnimatedBadge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <AlertBadge status={alert.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">
                      {alert.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(alert.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <motion.button
                        onClick={() => viewDetails(alert)}
                        className="text-blue-600 hover:text-blue-900"
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </motion.button>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Pagination */}
      {totalPages > 0 && (
        <motion.div
          className="flex items-center justify-between"
          initial="hidden"
          animate="visible"
          variants={slideIn}
        >
          <motion.div
            className="text-sm text-gray-500"
            initial="hidden"
            animate="visible"
            variants={slideInLeft}
          >
            Showing {page * size + 1}-{Math.min((page + 1) * size, alerts.length)} of {alerts.length}
          </motion.div>
          <motion.div
            className="flex space-x-2"
            initial="hidden"
            animate="visible"
            variants={slideInRight}
          >
            <AnimatedButton
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              variant="outline"
            >
              Previous
            </AnimatedButton>
            <motion.span
              className="px-4 py-2 text-sm font-medium"
              initial="hidden"
              animate="visible"
              variants={scaleIn}
            >
              Page {page + 1} of {totalPages}
            </motion.span>
            <AnimatedButton
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              variant="outline"
            >
              Next
            </AnimatedButton>
          </motion.div>
        </motion.div>
      )}

      {/* Alert Details Modal */}
      <AnimatedModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={`Alert #${selectedAlert?.id}`}
        size="lg"
      >
        {selectedAlert && (
          <motion.div
            className="space-y-6"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
              variants={staggerItem}
            >
              <motion.div variants={staggerItem}>
                <p className="text-sm font-medium text-gray-500 mb-1">Alert ID</p>
                <p className="text-xl font-bold text-gray-900">{selectedAlert.id}</p>
              </motion.div>
              <motion.div variants={staggerItem}>
                <p className="text-sm font-medium text-gray-500 mb-1">Transaction ID</p>
                <p className="text-xl font-bold text-blue-600">TX-{selectedAlert.transactionId}</p>
              </motion.div>
              <motion.div variants={staggerItem}>
                <p className="text-sm font-medium text-gray-500 mb-1">Alert Type</p>
                <AnimatedBadge color="blue">
                  {selectedAlert.alertType}
                </AnimatedBadge>
              </motion.div>
              <motion.div variants={staggerItem}>
                <p className="text-sm font-medium text-gray-500 mb-1">Severity</p>
                <AnimatedBadge
                  color={selectedAlert.severity === 'CRITICAL' ? 'red' : selectedAlert.severity === 'HIGH' ? 'orange' : 'yellow'}
                  pulse={selectedAlert.severity === 'CRITICAL'}
                >
                  {selectedAlert.severity}
                </AnimatedBadge>
              </motion.div>
              <motion.div variants={staggerItem}>
                <p className="text-sm font-medium text-gray-500 mb-1">Status</p>
                <AlertBadge status={selectedAlert.status} />
              </motion.div>
              <motion.div variants={staggerItem}>
                <p className="text-sm font-medium text-gray-500 mb-1">Created</p>
                <p className="text-gray-700">{formatDate(selectedAlert.createdAt)}</p>
              </motion.div>
            </motion.div>

            <motion.div
              className="border-t border-gray-200 pt-6"
              variants={staggerItem}
            >
              <p className="text-sm font-medium text-gray-500 mb-2">Description</p>
              <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                {selectedAlert.description}
              </p>
            </motion.div>

            {selectedAlert.status === 'NEW' && (
              <motion.div
                className="border-t border-gray-200 pt-6 flex space-x-4"
                variants={staggerItem}
              >
                <AnimatedButton
                  onClick={() => handleAssign(selectedAlert.id)}
                  variant="secondary"
                  className="flex-1"
                >
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20H2v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Assign to Me
                </AnimatedButton>
                <AnimatedButton
                  onClick={() => handleFalseAlarm(selectedAlert.id)}
                  variant="outline"
                  className="flex-1"
                >
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  False Alarm
                </AnimatedButton>
              </motion.div>
            )}

            {selectedAlert.status === 'INVESTIGATING' && (
              <motion.div
                className="border-t border-gray-200 pt-6"
                variants={staggerItem}
              >
                <AnimatedButton
                  onClick={() => {
                    const notes = prompt('Enter resolution notes:');
                    if (notes) handleResolve(selectedAlert.id, notes);
                  }}
                  className="w-full"
                >
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Resolve Alert
                </AnimatedButton>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatedModal>
    </motion.div>
  );
};

// Animated Accounts Page
const AnimatedAccountsPage = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    userId: user?.id || '',
    accountType: 'PERSONAL'
  });
  const { addToast } = useToast();

  useEffect(() => {
    if (user) {
      setFormData(prev => ({ ...prev, userId: user.id }));
      loadAccounts();
    }
  }, [user]);

  const loadAccounts = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const response = await accountApi.getByUser(user.id);
      setAccounts(response.data || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
      addToast('Error loading accounts', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (accounts.length >= 5) {
      addToast('Maximum limit of 5 accounts reached.', 'warning');
      return;
    }
    try {
      await accountApi.create({
        ...formData,
        userId: user.id
      });
      setShowModal(false);
      loadAccounts();
      addToast('Account created successfully!', 'success');
    } catch (error) {
      console.error('Error creating account:', error);
      addToast('Error creating account', 'error');
    }
  };

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      <motion.div
        className="flex justify-between items-center"
        variants={staggerItem}
      >
        <motion.h1
          className="text-2xl font-bold text-gray-900"
          initial="hidden"
          animate="visible"
          variants={slideInLeft}
        >
          Account Management
        </motion.h1>
        <motion.div
          initial="hidden"
          animate="visible"
          variants={slideInRight}
        >
          <AnimatedButton
            onClick={() => setShowModal(true)}
            disabled={accounts.length >= 5}
            className={accounts.length >= 5 ? "opacity-50 cursor-not-allowed" : ""}
          >
            <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            {accounts.length >= 5 ? "Account Limit Reached (Max 5)" : "Create Account"}
          </AnimatedButton>
        </motion.div>
      </motion.div>

      {/* Animated Accounts Table */}
      <motion.div
        className="bg-white rounded-2xl shadow-lg overflow-hidden"
        initial="hidden"
        animate="visible"
        variants={slideIn}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account Number</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <motion.tr initial="hidden" animate="visible" variants={fadeIn}>
                  <td colSpan="7" className="px-6 py-4 text-center">
                    <LoadingSpinner size="md" />
                  </td>
                </motion.tr>
              ) : accounts.length === 0 ? (
                <motion.tr initial="hidden" animate="visible" variants={fadeIn}>
                  <td colSpan="7">
                    <EmptyState
                      message="No accounts found"
                      icon="🏦"
                      subtitle="Create your first account to get started"
                    />
                  </td>
                </motion.tr>
              ) : (
                accounts.map((account, index) => (
                  <motion.tr
                    key={account.id}
                    className="hover:bg-gray-50"
                    initial="hidden"
                    animate="visible"
                    variants={slideIn}
                    transition={{ delay: index * 0.03 }}
                    whileHover={{ backgroundColor: '#f9fafb' }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {account.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {account.accountNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      User-{account.userId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <AnimatedBadge color="blue">
                        {account.accountType}
                      </AnimatedBadge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      {formatCurrency(account.balance)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <AnimatedBadge color={account.status === 'ACTIVE' ? 'green' : account.status === 'SUSPENDED' ? 'yellow' : 'gray'}>
                        {account.status}
                      </AnimatedBadge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <motion.button
                        className="text-blue-600 hover:text-blue-900"
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </motion.button>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Create Account Modal */}
      <AnimatedModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Create New Account"
      >
        <motion.form
          onSubmit={handleSubmit}
          className="space-y-6"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.div variants={staggerItem}>
            <AnimatedInput
              label="User Account Owner"
              type="text"
              name="userLabel"
              value={`${user?.firstName} ${user?.lastName} (ID: ${user?.id})`}
              disabled
              required
            />
          </motion.div>

          <motion.div variants={staggerItem}>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
            <select
              name="accountType"
              value={formData.accountType}
              onChange={handleChange}
              className="block w-full px-3 py-2 border-2 border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
              required
            >
              <option value="PERSONAL">Personal</option>
              <option value="BUSINESS">Business</option>
              <option value="MERCHANT">Merchant</option>
            </select>
          </motion.div>

          <motion.div
            className="flex justify-end space-x-4"
            variants={staggerItem}
          >
            <AnimatedButton
              type="button"
              variant="outline"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </AnimatedButton>
            <AnimatedButton type="submit">
              Create Account
            </AnimatedButton>
          </motion.div>
        </motion.form>
      </AnimatedModal>
    </motion.div>
  );
};

// Animated Analytics Page
const AnimatedAnalyticsPage = () => {
  const [fraudByDay, setFraudByDay] = useState([]);
  const [riskDistribution, setRiskDistribution] = useState([]);
  const [fraudByAccount, setFraudByAccount] = useState([]);
  const [fraudTrend, setFraudTrend] = useState([]);
  const [timeRange, setTimeRange] = useState('week');
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      // Mock data for demo
      setFraudByDay([
        { name: 'Mon', fraud: 4, legit: 120 },
        { name: 'Tue', fraud: 3, legit: 150 },
        { name: 'Wed', fraud: 6, legit: 140 },
        { name: 'Thu', fraud: 2, legit: 130 },
        { name: 'Fri', fraud: 5, legit: 160 },
        { name: 'Sat', fraud: 1, legit: 90 },
        { name: 'Sun', fraud: 2, legit: 80 }
      ]);

      setRiskDistribution([
        { name: 'Low', value: 65, color: COLORS.lowRisk },
        { name: 'Medium', value: 20, color: COLORS.warning },
        { name: 'High', value: 10, color: COLORS.highRisk },
        { name: 'Critical', value: 5, color: COLORS.danger }
      ]);

      setFraudByAccount([
        { account: 'Acc-1', fraud: 5, legit: 150 },
        { account: 'Acc-2', fraud: 3, legit: 200 },
        { account: 'Acc-3', fraud: 8, legit: 120 },
        { account: 'Acc-4', fraud: 2, legit: 180 },
        { account: 'Acc-5', fraud: 4, legit: 90 }
      ]);

      setFraudTrend([
        { name: 'Jan', fraud: 12, legit: 1200 },
        { name: 'Feb', fraud: 15, legit: 1300 },
        { name: 'Mar', fraud: 18, legit: 1400 },
        { name: 'Apr', fraud: 14, legit: 1500 },
        { name: 'May', fraud: 20, legit: 1600 },
        { name: 'Jun', fraud: 16, legit: 1700 }
      ]);

    } catch (error) {
      console.error('Error loading analytics:', error);
      addToast('Error loading analytics', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="space-y-8"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      <motion.div
        className="flex justify-between items-center"
        variants={staggerItem}
      >
        <motion.h1
          className="text-2xl font-bold text-gray-900"
          initial="hidden"
          animate="visible"
          variants={slideInLeft}
        >
          Analytics Dashboard
        </motion.h1>
        <motion.div
          className="flex space-x-2"
          initial="hidden"
          animate="visible"
          variants={slideInRight}
        >
          {['week', 'month', 'year'].map(range => (
            <AnimatedButton
              key={range}
              variant={timeRange === range ? 'primary' : 'outline'}
              onClick={() => setTimeRange(range)}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </AnimatedButton>
          ))}
        </motion.div>
      </motion.div>

      {loading ? (
        <motion.div
          className="flex justify-center items-center h-96"
          initial="hidden"
          animate="visible"
          variants={fadeIn}
        >
          <LoadingSpinner size="lg" message="Loading analytics..." />
        </motion.div>
      ) : (
        <>
          {/* Key Metrics Cards */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <motion.div variants={staggerItem}>
              <AnimatedCard>
                <motion.div
                  className="text-center"
                  initial="hidden"
                  animate="visible"
                  variants={staggerContainer}
                >
                  <motion.p
                    className="text-sm font-medium text-gray-500 mb-2"
                    variants={staggerItem}
                  >
                    Model Accuracy
                  </motion.p>
                  <motion.p
                    className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-green-700"
                    variants={staggerItem}
                  >
                    97.25%
                  </motion.p>
                  <motion.p
                    className="text-xs text-gray-400 mt-1"
                    variants={staggerItem}
                  >
                    AUC Score (Industry: 90-95%)
                  </motion.p>
                </motion.div>
              </AnimatedCard>
            </motion.div>

            <motion.div variants={staggerItem}>
              <AnimatedCard>
                <motion.div
                  className="text-center"
                  initial="hidden"
                  animate="visible"
                  variants={staggerContainer}
                >
                  <motion.p
                    className="text-sm font-medium text-gray-500 mb-2"
                    variants={staggerItem}
                  >
                    Detection Rate
                  </motion.p>
                  <motion.p
                    className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-blue-700"
                    variants={staggerItem}
                  >
                    99.76%
                  </motion.p>
                  <motion.p
                    className="text-xs text-gray-400 mt-1"
                    variants={staggerItem}
                  >
                    Fraud cases detected
                  </motion.p>
                </motion.div>
              </AnimatedCard>
            </motion.div>

            <motion.div variants={staggerItem}>
              <AnimatedCard>
                <motion.div
                  className="text-center"
                  initial="hidden"
                  animate="visible"
                  variants={staggerContainer}
                >
                  <motion.p
                    className="text-sm font-medium text-gray-500 mb-2"
                    variants={staggerItem}
                  >
                    Response Time
                  </motion.p>
                  <motion.p
                    className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-purple-700"
                    variants={staggerItem}
                  >
                    {"< 200ms"}
                  </motion.p>
                  <motion.p
                    className="text-xs text-gray-400 mt-1"
                    variants={staggerItem}
                  >
                    Real-time processing
                  </motion.p>
                </motion.div>
              </AnimatedCard>
            </motion.div>
          </motion.div>

          {/* Charts Grid */}
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <motion.div variants={staggerItem}>
              <AnimatedChartCard title="Fraud vs Legitimate Transactions">
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={fraudByDay}>
                    <defs>
                      <linearGradient id="fraudGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.danger} stopOpacity={0.8} />
                        <stop offset="95%" stopColor={COLORS.danger} stopOpacity={0.2} />
                      </linearGradient>
                      <linearGradient id="legitGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.secondary} stopOpacity={0.8} />
                        <stop offset="95%" stopColor={COLORS.secondary} stopOpacity={0.2} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: '10px' }}
                      itemStyle={{ color: 'white' }}
                    />
                    <Legend wrapperStyle={{ color: '#666' }} />
                    <Bar dataKey="fraud" name="Fraud" stackId="a" fill="url(#fraudGradient)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="legit" name="Legitimate" stackId="a" fill="url(#legitGradient)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </AnimatedChartCard>
            </motion.div>

            <motion.div variants={staggerItem}>
              <AnimatedChartCard title="Risk Distribution">
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={riskDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      innerRadius={60}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      paddingAngle={5}
                    >
                      {riskDistribution.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          stroke="white"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: '10px' }}
                      itemStyle={{ color: 'white' }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: '20px' }}
                      formatter={(value) => <span style={{ color: '#666' }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </AnimatedChartCard>
            </motion.div>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <motion.div variants={staggerItem}>
              <AnimatedChartCard title="Fraud by Account">
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={fraudByAccount} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                    <XAxis type="number" />
                    <YAxis dataKey="account" type="category" width={100} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: '10px' }}
                      itemStyle={{ color: 'white' }}
                    />
                    <Legend wrapperStyle={{ color: '#666' }} />
                    <Bar dataKey="fraud" name="Fraud" stackId="a" fill={COLORS.danger} radius={[0, 4, 4, 0]} />
                    <Bar dataKey="legit" name="Legitimate" stackId="a" fill={COLORS.secondary} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </AnimatedChartCard>
            </motion.div>

            <motion.div variants={staggerItem}>
              <AnimatedChartCard title="Fraud Trends Over Time">
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={fraudTrend}>
                    <defs>
                      <linearGradient id="fraudArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.danger} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={COLORS.danger} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="legitArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.secondary} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={COLORS.secondary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: '10px' }}
                      itemStyle={{ color: 'white' }}
                    />
                    <Legend wrapperStyle={{ color: '#666' }} />
                    <Area type="monotone" dataKey="fraud" name="Fraud" stroke={COLORS.danger} strokeWidth={3} fill="url(#fraudArea)" />
                    <Area type="monotone" dataKey="legit" name="Legitimate" stroke={COLORS.secondary} strokeWidth={3} fill="url(#legitArea)" />
                  </AreaChart>
                </ResponsiveContainer>
              </AnimatedChartCard>
            </motion.div>
          </motion.div>
        </>
      )}
    </motion.div>
  );
};

// Animated Network Graph Page
const AnimatedNetworkGraphPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('day');
  const [showStats, setShowStats] = useState(true);
  const containerRef = useRef(null);
  const { addToast } = useToast();

  useEffect(() => {
    loadTransactions();
  }, [timeRange]);

  useEffect(() => {
    if (transactions.length > 0 && !loading) {
      renderGraph();
    }
  }, [transactions, loading]);

  const loadTransactions = async () => {
    try {
      setLoading(true);

      let limit = 50;
      if (timeRange === 'week') limit = 200;
      if (timeRange === 'month') limit = 500;

      const response = await transactionApi.getRecent(limit);
      setTransactions(response.data);

    } catch (error) {
      console.error('Error loading transactions:', error);
      addToast('Error loading transactions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderGraph = () => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = '';

    const nodes = new vis.DataSet([]);
    const edges = new vis.DataSet([]);

    const nodeMap = new Map();
    let nodeId = 0;

    // Add nodes
    transactions.forEach(tx => {
      if (!nodeMap.has(tx.senderId)) {
        nodeMap.set(tx.senderId, nodeId++);
        nodes.add({
          id: tx.senderId,
          label: `Acc-${tx.senderId}`,
          title: `Account ${tx.senderId}\nBalance: ${formatCurrency(tx.senderBalance || 0)}`,
          value: 10 + Math.random() * 10,
          color: {
            background: COLORS.primary,
            border: '#ffffff',
            highlight: {
              background: COLORS.primaryLight,
              border: '#ffffff'
            }
          },
          shape: 'circle'
        });
      }

      if (!nodeMap.has(tx.receiverId)) {
        nodeMap.set(tx.receiverId, nodeId++);
        nodes.add({
          id: tx.receiverId,
          label: `Acc-${tx.receiverId}`,
          title: `Account ${tx.receiverId}\nBalance: ${formatCurrency(tx.receiverBalance || 0)}`,
          value: 10 + Math.random() * 10,
          color: {
            background: COLORS.primary,
            border: '#ffffff',
            highlight: {
              background: COLORS.primaryLight,
              border: '#ffffff'
            }
          },
          shape: 'circle'
        });
      }
    });

    // Add edges
    transactions.forEach(tx => {
      const color = tx.isFraud ? COLORS.danger : COLORS.secondary;
      const width = tx.isFraud ? 4 : 2;
      const dashes = tx.isFraud ? [5, 5] : false;

      edges.add({
        from: tx.senderId,
        to: tx.receiverId,
        title: `Amount: ${formatCurrency(tx.amount)}\nRisk: ${tx.riskLevel || 'LOW'}\nFraud: ${tx.isFraud ? 'YES' : 'NO'}\nTime: ${formatDate(tx.createdAt)}`,
        color: color,
        width: width,
        dashes: dashes,
        arrows: { to: { enabled: true, scaleFactor: 0.5, type: 'arrow' } },
        label: formatCurrency(tx.amount),
        font: { size: 10, align: 'middle' },
        chosen: false
      });
    });

    const data = { nodes, edges };
    const options = {
      nodes: {
        shape: 'circle',
        size: 20,
        font: {
          size: 12,
          color: '#ffffff',
          face: 'Arial',
          bold: { color: '#ffffff', size: 14 }
        },
        shadow: {
          enabled: true,
          size: 10,
          x: 0,
          y: 0
        }
      },
      edges: {
        arrows: {
          to: { enabled: true, scaleFactor: 0.5, type: 'arrow' }
        },
        font: {
          size: 10,
          align: 'middle',
          color: '#666'
        },
        shadow: {
          enabled: true,
          size: 5,
          x: 0,
          y: 0
        }
      },
      physics: {
        enabled: true,
        barnesHut: {
          gravitationalConstant: -80000,
          centralGravity: 0.3,
          springLength: 150,
          springConstant: 0.04,
          damping: 0.09,
          avoidOverlap: 0.1
        },
        minVelocity: 0.75,
        solver: 'barnesHut'
      },
      layout: {
        hierarchical: false
      },
      interaction: {
        hover: true,
        selectable: true,
        zoomView: true,
        dragNodes: true,
        dragView: true
      },
      manipulation: {
        enabled: false
      }
    };

    const network = new vis.Network(containerRef.current, data, options);

    // Handle node click
    network.on('click', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        console.log('Node clicked:', nodeId);
        addToast(`Account ${nodeId} selected`, 'info');
      }
    });

    // Handle edge click
    network.on('click', (params) => {
      if (params.edges.length > 0) {
        const edgeId = params.edges[0];
        console.log('Edge clicked:', edgeId);
      }
    });

    // Cleanup
    return () => {
      if (network) {
        network.destroy();
      }
    };
  };

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      <motion.div
        className="flex justify-between items-center"
        variants={staggerItem}
      >
        <motion.h1
          className="text-2xl font-bold text-gray-900"
          initial="hidden"
          animate="visible"
          variants={slideInLeft}
        >
          Transaction Network Graph
        </motion.h1>
        <motion.div
          className="flex space-x-2"
          initial="hidden"
          animate="visible"
          variants={slideInRight}
        >
          {['day', 'week', 'month'].map(range => (
            <AnimatedButton
              key={range}
              variant={timeRange === range ? 'primary' : 'outline'}
              onClick={() => setTimeRange(range)}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </AnimatedButton>
          ))}
          <AnimatedButton
            onClick={() => setShowStats(!showStats)}
            variant="outline"
          >
            {showStats ? 'Hide Stats' : 'Show Stats'}
          </AnimatedButton>
        </motion.div>
      </motion.div>

      <motion.div
        className="bg-white rounded-2xl shadow-lg p-6"
        initial="hidden"
        animate="visible"
        variants={slideIn}
      >
        <motion.div
          className="flex items-center justify-between mb-6"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.div
            className="flex items-center space-x-6"
            variants={staggerItem}
          >
            <motion.div
              className="flex items-center space-x-2"
              variants={staggerItem}
            >
              <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Legitimate Transaction</span>
            </motion.div>
            <motion.div
              className="flex items-center space-x-2"
              variants={staggerItem}
            >
              <div className="w-4 h-4 bg-red-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Fraudulent Transaction</span>
            </motion.div>
            <motion.div
              className="flex items-center space-x-2"
              variants={staggerItem}
            >
              <div className="w-4 h-4 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full"></div>
              <span className="text-sm text-gray-600">High Risk</span>
            </motion.div>
          </motion.div>

          <motion.div
            className="flex space-x-2"
            variants={staggerItem}
          >
            <AnimatedButton onClick={() => loadTransactions()}>
              <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h5M20 20v-5h-5M4 20h5v-5M20 4h-5v5" />
              </svg>
              Refresh Graph
            </AnimatedButton>
          </motion.div>
        </motion.div>

        <div
          ref={containerRef}
          className="border-2 border-gray-200 rounded-lg h-[600px] relative"
        />

        {loading && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75"
            initial="hidden"
            animate="visible"
            variants={fadeIn}
          >
            <LoadingSpinner size="lg" message="Building network..." />
          </motion.div>
        )}

        {transactions.length === 0 && !loading && (
          <EmptyState
            message="No transactions to display"
            icon="🔗"
            subtitle="Create transactions to visualize the network"
          />
        )}
      </motion.div>

      {/* Animated Graph Statistics */}
      {showStats && (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.div variants={staggerItem}>
            <AnimatedCard>
              <motion.div
                className="text-center"
                initial="hidden"
                animate="visible"
                variants={staggerContainer}
              >
                <motion.p
                  className="text-sm font-medium text-gray-500 mb-2"
                  variants={staggerItem}
                >
                  Total Nodes
                </motion.p>
                <motion.p
                  className="text-3xl font-bold text-blue-600"
                  variants={staggerItem}
                >
                  {new Set(transactions.flatMap(tx => [tx.senderId, tx.receiverId])).size}
                </motion.p>
                <motion.p
                  className="text-xs text-gray-400 mt-1"
                  variants={staggerItem}
                >
                  Accounts in network
                </motion.p>
              </motion.div>
            </AnimatedCard>
          </motion.div>

          <motion.div variants={staggerItem}>
            <AnimatedCard>
              <motion.div
                className="text-center"
                initial="hidden"
                animate="visible"
                variants={staggerContainer}
              >
                <motion.p
                  className="text-sm font-medium text-gray-500 mb-2"
                  variants={staggerItem}
                >
                  Total Edges
                </motion.p>
                <motion.p
                  className="text-3xl font-bold text-green-600"
                  variants={staggerItem}
                >
                  {transactions.length}
                </motion.p>
                <motion.p
                  className="text-xs text-gray-400 mt-1"
                  variants={staggerItem}
                >
                  Transactions processed
                </motion.p>
              </motion.div>
            </AnimatedCard>
          </motion.div>

          <motion.div variants={staggerItem}>
            <AnimatedCard>
              <motion.div
                className="text-center"
                initial="hidden"
                animate="visible"
                variants={staggerContainer}
              >
                <motion.p
                  className="text-sm font-medium text-gray-500 mb-2"
                  variants={staggerItem}
                >
                  Fraudulent
                </motion.p>
                <motion.p
                  className="text-3xl font-bold text-red-600"
                  variants={staggerItem}
                >
                  {transactions.filter(tx => tx.isFraud).length}
                </motion.p>
                <motion.p
                  className="text-xs text-gray-400 mt-1"
                  variants={staggerItem}
                >
                  Detected by TGNN model
                </motion.p>
              </motion.div>
            </AnimatedCard>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
};

// Animated Create Transaction Page
const AnimatedCreateTransactionPage = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    senderId: '',
    receiverId: '',
    amount: '',
    currency: 'USD',
    description: ''
  });
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { addToast } = useToast();

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      // 1. Fetch all users from database
      const usersRes = await userApi.getAll();
      const usersList = usersRes.data || [];
      
      // 2. Fetch accounts for all users
      const accountsPromises = usersList.map(u => accountApi.getByUser(u.id));
      const accountsResponses = await Promise.all(accountsPromises);
      
      // 3. Flatten and save all accounts
      const allAccounts = accountsResponses.flatMap(res => res.data || []);
      setAccounts(allAccounts);
    } catch (error) {
      console.error('Error loading accounts:', error);
      addToast('Error loading accounts', 'error');
    }
  };

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const transaction = {
        ...formData,
        amount: parseFloat(formData.amount)
      };

      const response = await transactionApi.create(transaction);
      setSuccess(true);
      addToast('Transaction created and fraud check initiated!', 'success');

      setFormData({
        senderId: '',
        receiverId: '',
        amount: '',
        currency: 'USD',
        description: ''
      });

      setTimeout(() => {
        navigate('/transactions');
      }, 3000);

    } catch (err) {
      setError(err.response?.data?.message || 'Error creating transaction');
      addToast('Error creating transaction', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="max-w-3xl mx-auto"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      <motion.div
        className="flex justify-between items-center mb-8"
        variants={staggerItem}
      >
        <motion.h1
          className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600"
          initial="hidden"
          animate="visible"
          variants={slideInLeft}
        >
          Create New Transaction
        </motion.h1>
        <motion.div
          initial="hidden"
          animate="visible"
          variants={slideInRight}
        >
          <Link to="/transactions">
            <AnimatedButton variant="outline">
              <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back to Transactions
            </AnimatedButton>
          </Link>
        </motion.div>
      </motion.div>

      <motion.div
        className="bg-white rounded-2xl shadow-xl p-8"
        initial="hidden"
        animate="visible"
        variants={slideIn}
      >
        {success ? (
          <motion.div
            className="text-center py-8"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <motion.div
              className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4"
              animate={pulse}
            >
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>
            <motion.h3
              className="text-2xl font-bold text-green-600 mb-2"
              initial="hidden"
              animate="visible"
              variants={slideIn}
            >
              Transaction Created!
            </motion.h3>
            <motion.p
              className="text-gray-600"
              initial="hidden"
              animate="visible"
              variants={slideIn}
              transition={{ delay: 0.2 }}
            >
              Fraud detection is in progress...
            </motion.p>
            <motion.p
              className="text-sm text-gray-400 mt-2"
              initial="hidden"
              animate="visible"
              variants={slideIn}
              transition={{ delay: 0.4 }}
            >
              Redirecting to transactions list...
            </motion.p>
          </motion.div>
        ) : (
          <motion.form
            onSubmit={handleSubmit}
            className="space-y-6"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            {error && (
              <motion.div
                className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg"
                initial="hidden"
                animate="visible"
                variants={shake}
              >
                <p className="text-red-700">{error}</p>
              </motion.div>
            )}

            <motion.div variants={staggerItem}>
              <motion.h3
                className="text-lg font-semibold text-gray-900 mb-4"
                initial="hidden"
                animate="visible"
                variants={slideIn}
              >
                Transaction Details
              </motion.h3>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
              variants={staggerItem}
            >
              <motion.div variants={staggerItem}>
                <AnimatedInput
                  label="Sender Account"
                  type="select"
                  name="senderId"
                  value={formData.senderId}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select sender account</option>
                  {accounts.filter(a => a.userId === user?.id).map(account => (
                    <option key={account.id} value={account.id}>
                      {account.accountNumber} (Balance: {formatCurrency(account.balance)})
                    </option>
                  ))}
                </AnimatedInput>
              </motion.div>

              <motion.div variants={staggerItem}>
                <AnimatedInput
                  label="Receiver Account"
                  type="select"
                  name="receiverId"
                  value={formData.receiverId}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select receiver account</option>
                  {accounts.filter(a => a.id !== parseInt(formData.senderId)).map(account => (
                    <option key={account.id} value={account.id}>
                      {account.accountNumber} (Balance: {formatCurrency(account.balance)})
                    </option>
                  ))}
                </AnimatedInput>
              </motion.div>
            </motion.div>

            <motion.div variants={staggerItem}>
              <AnimatedInput
                label="Amount"
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                placeholder="Enter amount"
                icon="💰"
                step="0.01"
                min="0.01"
                required
              />
            </motion.div>

            <motion.div variants={staggerItem}>
              <AnimatedInput
                label="Currency"
                type="select"
                name="currency"
                value={formData.currency}
                onChange={handleChange}
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="INR">INR (₹)</option>
              </AnimatedInput>
            </motion.div>

            <motion.div variants={staggerItem}>
              <AnimatedInput
                label="Description (Optional)"
                type="textarea"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Transaction description..."
                rows={3}
              />
            </motion.div>

            <motion.div
              className="flex justify-end"
              variants={staggerItem}
            >
              <AnimatedButton
                type="submit"
                disabled={loading}
                size="lg"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Processing...</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Create Transaction
                  </span>
                )}
              </AnimatedButton>
            </motion.div>
          </motion.form>
        )}
      </motion.div>
    </motion.div>
  );
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

const App = () => {
  // Load Vis.js for network graph
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/vis/4.21.0/vis.min.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <ThemeProvider>
      <Router>
        <AuthProvider>
          <AlertProvider>
            <ToastProvider>
              <AnimatePresence mode="wait">
                <Routes>
                  {/* Public Routes */}
                  <Route path="/login" element={<AnimatedLoginPage />} />

                  {/* Protected Routes */}
                  <Route path="/" element={<AnimatedLayout />}>
                    <Route index element={<AnimatedDashboardPage />} />
                    <Route path="dashboard" element={<AnimatedDashboardPage />} />
                    <Route path="transactions" element={<AnimatedTransactionsPage />} />
                    <Route path="transactions/new" element={<AnimatedCreateTransactionPage />} />
                    <Route path="alerts" element={<AnimatedAlertsPage />} />
                    <Route path="accounts" element={<AnimatedAccountsPage />} />
                    <Route path="analytics" element={<AnimatedAnalyticsPage />} />
                    <Route path="network" element={<AnimatedNetworkGraphPage />} />
                  </Route>

                  {/* Fallback */}
                  <Route path="*" element={<AnimatedDashboardPage />} />
                </Routes>
              </AnimatePresence>
            </ToastProvider>
          </AlertProvider>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
};

export default App;