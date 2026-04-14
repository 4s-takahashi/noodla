import React, { createContext, useContext, useState, ReactNode } from 'react';
import { mockUser } from '../mock/user';
import { mockNetworkStatus } from '../mock/network';
import { mockPointsData } from '../mock/points';
import { mockNotifications, Notification } from '../mock/notifications';
import { mockChatHistory } from '../mock/ai';
import { User } from '../types/user';
import { NetworkStatus } from '../types/network';
import { PointsData } from '../types/points';
import { ChatMessage } from '../types/ai';

interface Settings {
  wifiOnly: boolean;
  chargingPriority: boolean;
  powerSaveStop: boolean;
  notifications: boolean;
}

interface AppContextType {
  user: User;
  networkStatus: NetworkStatus;
  pointsData: PointsData;
  notifications: Notification[];
  chatHistory: ChatMessage[];
  settings: Settings;
  isLoggedIn: boolean;
  login: (email: string, password: string) => void;
  logout: () => void;
  updateSettings: (key: keyof Settings, value: boolean) => void;
  toggleParticipation: () => void;
  markNotificationRead: (id: string) => void;
  addChatMessage: (message: ChatMessage) => void;
  unreadCount: number;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User>(mockUser);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(mockNetworkStatus);
  const [pointsData, setPointsData] = useState<PointsData>(mockPointsData);
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(mockChatHistory);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    wifiOnly: true,
    chargingPriority: true,
    powerSaveStop: true,
    notifications: true,
  });

  const login = (_email: string, _password: string) => {
    setIsLoggedIn(true);
  };

  const logout = () => {
    setIsLoggedIn(false);
  };

  const updateSettings = (key: keyof Settings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const toggleParticipation = () => {
    setNetworkStatus(prev => ({
      ...prev,
      status: prev.status === 'active' ? 'standby' : 'active',
      currentJob: prev.status === 'active' ? null : 'text_analysis',
    }));
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const addChatMessage = (message: ChatMessage) => {
    setChatHistory(prev => [...prev, message]);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <AppContext.Provider
      value={{
        user,
        networkStatus,
        pointsData,
        notifications,
        chatHistory,
        settings,
        isLoggedIn,
        login,
        logout,
        updateSettings,
        toggleParticipation,
        markNotificationRead,
        addChatMessage,
        unreadCount,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};
