import { API_BASE } from '@/lib/config'

export function getToken(): string | null {
  return localStorage.getItem('admin_token')
}

export function setToken(token: string) {
  localStorage.setItem('admin_token', token)
}

export function clearToken() {
  localStorage.removeItem('admin_token')
}

export function getCurrentUsername(): string | null {
  return localStorage.getItem('admin_username')
}

export function setCurrentUsername(username: string) {
  localStorage.setItem('admin_username', username)
}

export function clearCurrentUsername() {
  localStorage.removeItem('admin_username')
}

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }

  const text = await res.text()
  return text ? JSON.parse(text) : {}
}

export const api = {
  get: (path: string) => request(path),

  post: (path: string, body?: any) =>
    request(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  put: (path: string, body?: any) =>
    request(path, {
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  delete: (path: string) => request(path, { method: 'DELETE' }),

  uploadFile: async (path: string, file: File, module: string, url?: string, mediaType?: string) => {
    const form = new FormData()
    form.append('file', file)
    if (url) form.append('url', url)
    if (mediaType) form.append('media_type', mediaType)
    const sep = path.includes('?') ? '&' : '?'
    return request(`${path}${sep}module=${module}`, {
      method: 'POST',
      body: form,
    })
  },

  uploadImage: async (file: File): Promise<{ url: string }> => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_BASE}/api/admin/upload/image`, {
      method: 'POST',
      body: form,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail || 'Image upload failed')
    }
    return res.json()
  },

  uploadCatbox: async (file: File): Promise<{ url: string }> => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_BASE}/api/admin/upload/catbox`, {
      method: 'POST',
      body: form,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail || 'Catbox upload failed')
    }
    return res.json()
  },

  filePreviewUrl: (filename: string, token?: string) => {
    const t = token ?? getToken()
    const sep = filename.includes('?') ? '&' : '?'
    return `${API_BASE}/api/admin/files/${encodeURIComponent(filename)}/preview${t ? `${sep}token=${encodeURIComponent(t)}` : ''}`
  },

  fileDownloadUrl: (filename: string, token?: string) => {
    const t = token ?? getToken()
    return `${API_BASE}/api/admin/files/${encodeURIComponent(filename)}/download${t ? `?token=${encodeURIComponent(t)}` : ''}`
  },

  login: (username: string, password: string) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  checkAuthStatus: () => request('/api/auth/status'),

  getAdminMe: () => request('/api/auth/me'),

  requestOtp: (username: string) =>
    request('/api/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),

  resetPassword: (username: string, otp: string, newPassword: string) =>
    request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ username, otp, new_password: newPassword }),
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),

  getAdmins: () => request('/api/auth/admins'),

  createAdmin: (data: { username: string; password: string; role?: string; permissions?: Record<string, boolean>; email?: string }) =>
    request('/api/auth/create', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAdmin: (username: string, data: { role?: string; permissions?: Record<string, boolean>; email?: string }) =>
    request(`/api/auth/admins/${encodeURIComponent(username)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteAdmin: (username: string) =>
    request(`/api/auth/admins/${encodeURIComponent(username)}`, {
      method: 'DELETE',
    }),

  getChatUsers: () => request('/api/admin/chat/users'),

  sendChatMessage: (chatId: string, text: string, attachment?: any) =>
    request('/api/admin/chat/send', {
      method: 'POST',
      body: JSON.stringify({ chat_id: chatId, text, attachment }),
    }),

  createChatWebSocket: (username: string, token: string | null): WebSocket => {
    const httpUrl = `${API_BASE}/api/admin/chat/ws/${encodeURIComponent(username)}`
    const wsUrl = httpUrl.replace(/^http(s)?:\/\//, 'ws$1://')
    const url = new URL(wsUrl)
    if (token) url.searchParams.set('token', token)
    url.searchParams.set('conn_id', 'chat')
    return new WebSocket(url.toString())
  },
}
