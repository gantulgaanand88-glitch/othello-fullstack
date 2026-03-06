import axios from 'axios';

import type { AuthResponse, LeaderboardEntry, StoredGameResponse } from '../types';

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

export default api;
