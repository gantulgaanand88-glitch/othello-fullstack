import axios from 'axios';

import type { AuthResponse, LeaderboardEntry, StoredGameResponse, UserProfileResponse, SelfProfileResponse } from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api',
});

export function setAuthToken(token: string | null): void {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    return;
  }

  delete api.defaults.headers.common.Authorization;
}

export async function registerUser(payload: {
  username: string;
  email: string;
  password: string;
  ageConfirmed: boolean;
}): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/auth/register', payload);
  return response.data;
}

export async function loginUser(payload: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/auth/login', payload);
  return response.data;
}

export async function loginAsGuest(): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/auth/guest');
  return response.data;
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const response = await api.get<LeaderboardEntry[]>('/leaderboard');
  return response.data;
}

export async function fetchGame(gameId: string): Promise<StoredGameResponse> {
  const response = await api.get<StoredGameResponse>(`/game/${gameId}`);
  return response.data;
}

export async function submitReport(payload: {
  reportedUserId: string;
  gameId?: string;
  reason: string;
  description?: string;
}): Promise<void> {
  await api.post('/report', payload);
}

export async function fetchGameHistory(page = 1, limit = 20): Promise<{
  games: Array<{
    gameId: string;
    opponent: string;
    result: 'win' | 'loss' | 'draw';
    ratingChange: number;
    date: string;
    status: string;
  }>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> {
  const response = await api.get('/history', { params: { page, limit } });
  return response.data;
}

export async function fetchUserProfile(username: string): Promise<UserProfileResponse> {
  const response = await api.get<UserProfileResponse>(`/profile/${username}`);
  return response.data;
}

export async function fetchSelfProfile(): Promise<SelfProfileResponse> {
  const response = await api.get<SelfProfileResponse>('/profile/me');
  return response.data;
}

export async function exportUserData(): Promise<any> {
  const response = await api.get('/privacy/data-export');
  return response.data;
}

export async function deleteUserAccount(): Promise<void> {
  await api.delete('/privacy/delete-account');
}

export async function recordConsent(payload: {
  consentType: 'essential' | 'analytics' | 'marketing' | 'terms' | 'privacy';
  granted: boolean;
  policyVersion: string;
}): Promise<any> {
  const response = await api.post('/consent', payload);
  return response.data;
}

export async function fetchConsentStatus(): Promise<Record<string, { granted: boolean; policyVersion: string; timestamp: string } | null>> {
  const response = await api.get('/consent/status');
  return response.data;
}

export default api;
