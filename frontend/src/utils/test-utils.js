import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

// Mock API
import * as api from '../services/api';

// Mock AuthContext
jest.mock('../contexts/AuthContext', () => {
  const mockUser = { id: 'test-user', discordId: 'test-user', username: 'Test User' };
  const mockLogout = jest.fn();
  const mockLogin = jest.fn();
  const mockSetToken = jest.fn();
  const mockCheckAuth = jest.fn().mockResolvedValue(mockUser);
  
  return {
    __esModule: true,
    useAuth: () => ({
      user: mockUser,
      login: mockLogin,
      logout: mockLogout,
      setToken: mockSetToken,
      loading: false,
      isAuthenticated: true,
      checkAuth: mockCheckAuth,
    }),
    AuthProvider: ({ children }) => <>{children}</>,
  };
});

// Mock GuildContext
jest.mock('../contexts/GuildContext', () => {
  const mockSwitchGuild = jest.fn();
  const testGuilds = [
    { id: 'guild1', name: 'Guild 1', icon: null },
    { id: 'guild2', name: 'Guild 2', icon: null }
  ];
  return {
    __esModule: true,
    useGuild: () => ({
      userGuilds: testGuilds,
      selectedGuildId: 'guild1',
      switchGuild: mockSwitchGuild,
      isGuildSwitching: false,
      isLoadingGuilds: false,
      guildError: null,
      hasGuilds: true,
      selectedGuild: { id: 'guild1', name: 'Guild 1', icon: null }
    }),
    GuildProvider: ({ children }) => <>{children}</>,
  };
});

// Mock other contexts with simple pass-through providers
jest.mock('../contexts/ThemeContext', () => ({
  __esModule: true,
  useTheme: () => ({ theme: 'dark', toggleTheme: jest.fn() }),
  ThemeProvider: ({ children }) => <>{children}</>,
}));

jest.mock('../contexts/AnimationContext', () => ({
  __esModule: true,
  useAnimation: () => ({ animationsEnabled: true, toggleAnimations: jest.fn() }),
  AnimationProvider: ({ children }) => <>{children}</>,
  ANIMATION_VARIANTS: { fadeIn: {}, slideIn: {} },
}));

jest.mock('../contexts/PerformanceContext', () => ({
  __esModule: true,
  usePerformance: () => ({
    metrics: {},
    summary: {},
    isMonitoring: false,
    isAutoRefresh: false,
    refreshMetrics: jest.fn(),
    resetMetrics: jest.fn(),
    toggleMonitoring: jest.fn(),
    toggleAutoRefresh: jest.fn(),
  }),
  PerformanceProvider: ({ children }) => <>{children}</>,
}));

// Setup before each test
beforeEach(() => {
  localStorage.setItem('token', 'test-token');
  jest.resetModules();
  jest.clearAllMocks();
  
  // Mock API methods
  api.getUserProfile = jest.fn(() => Promise.resolve({ discordId: 'user1', username: 'TestUser' }));
  api.getUserGuilds = jest.fn(() => Promise.resolve([
    { id: 'guild1', name: 'Guild 1' },
    { id: 'guild2', name: 'Guild 2' }
  ]));
  api.getWalletBalance = jest.fn(() => Promise.resolve({ balance: 1000 }));
});

// Cleanup after each test
afterEach(() => {
  localStorage.clear();
});

// Custom render that wraps in all providers
const customRender = (ui, { initialEntries = ['/'], ...options } = {}) => {
  const AllProviders = ({ children }) => (
    <MemoryRouter initialEntries={initialEntries}>
      {children}
    </MemoryRouter>
  );
  return render(ui, { wrapper: AllProviders, ...options });
};

// Re-export everything from RTL
export * from '@testing-library/react';
// Override render
export { customRender as render };