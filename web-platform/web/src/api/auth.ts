export interface ArenaUser {
  id: string;
  handle: string;
  display_name: string;
  country_code: string | null;
  title: string | null;
}

interface SessionResponse {
  user: ArenaUser | null;
}

async function sessionRequest(path: string, init?: RequestInit): Promise<ArenaUser | null> {
  const response = await fetch(path, { credentials: 'include', ...init });
  if (!response.ok) throw new Error(`Session request failed (${response.status})`);
  return ((await response.json()) as SessionResponse).user;
}

export function currentUser() {
  return sessionRequest('/api/me');
}

export function createGuestSession() {
  return sessionRequest('/api/auth/guest', { method: 'POST' });
}

export async function logout() {
  const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  if (!response.ok) throw new Error(`Logout failed (${response.status})`);
}
