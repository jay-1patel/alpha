import { API_BASE } from './config'
import { getToken } from './api'

export async function downloadFile(
  fileUrl: string,
  fileName?: string
): Promise<boolean> {
  const fallbackName =
    fileName ||
    fileUrl.split('/').pop()?.split('?')[0] ||
    'download'

  const t = getToken()
  const tokenQuery = t ? `&token=${encodeURIComponent(t)}` : ''
  const proxyUrl =
    `${API_BASE}/api/admin/download-remote` +
    `?url=${encodeURIComponent(fileUrl)}` +
    `&filename=${encodeURIComponent(fileName || '')}` +
    tokenQuery

  try {
    const res = await fetch(proxyUrl)

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = objectUrl
    a.download = fileName || fallbackName
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(objectUrl)

    return true
  } catch {
    try {
      const res = await fetch(fileUrl, { mode: 'cors' })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = objectUrl
      a.download = fallbackName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)

      return true
    } catch {
      window.open(fileUrl, '_blank', 'noopener')
      return false
    }
  }
}