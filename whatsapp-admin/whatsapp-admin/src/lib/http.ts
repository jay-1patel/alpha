import axios from 'axios'

import { getToken } from '@/lib/api'
import { API_BASE } from '@/lib/config'

/**
 * Dedicated Axios client for the Inbox / Campaigns modules.
 * Points at the FastAPI backend and attaches the admin JWT.
 */
export const http = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
})

http.interceptors.request.use((config) => {
  const token = getToken()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

http.interceptors.response.use(
  (res) => res,
  (error) => {
    const message =
      error?.response?.data?.detail ||
      error?.message ||
      'Request failed'

    return Promise.reject(
      new Error(typeof message === 'string' ? message : JSON.stringify(message))
    )
  }
)
