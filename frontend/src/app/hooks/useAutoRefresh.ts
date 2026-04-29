"use client"

import { useEffect } from "react"

type UseAutoRefreshOptions = {
  enabled?: boolean
  intervalMs?: number
  pause?: boolean
  refreshWhenFocused?: boolean
}

export function useAutoRefresh(
  callback: () => void | Promise<void>,
  options: UseAutoRefreshOptions = {}
) {
  const {
    enabled = true,
    intervalMs = 5000,
    pause = false,
    refreshWhenFocused = true,
  } = options

  useEffect(() => {
    if (!enabled) return
    if (pause) return

    const refreshQuietly = () => {
      if (document.hidden) return
      void callback()
    }

    const intervalId = window.setInterval(refreshQuietly, intervalMs)

    const handleFocus = () => {
      refreshQuietly()
    }

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshQuietly()
      }
    }

    if (refreshWhenFocused) {
      window.addEventListener("focus", handleFocus)
      document.addEventListener("visibilitychange", handleVisibilityChange)
    }

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [callback, enabled, intervalMs, pause, refreshWhenFocused])
}