import { env } from '@/env'
import axios from 'axios'

export const api = axios.create({
  baseURL: env.VITE_API_URL,
  withCredentials: true,
})

// Attach Authorization header automatically when token exists in localStorage
api.interceptors.request.use((config) => {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
  } catch {
    // ignore in non-browser contexts
  }
  return config
})
