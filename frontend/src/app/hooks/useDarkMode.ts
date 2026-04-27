"use client";

import { useEffect, useSyncExternalStore } from "react";

const THEME_KEY = "ourskin-theme";
const THEME_EVENT = "ourskin-theme-change";

function getStoredTheme() {
  if (typeof window === "undefined") return false;

  return localStorage.getItem(THEME_KEY) === "dark";
}

function getServerTheme() {
  return false;
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(THEME_EVENT, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(THEME_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function applyTheme(isDark: boolean) {
  if (typeof document === "undefined") return;

  document.body.classList.toggle("darkMode", isDark);
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
}

export function useDarkMode() {
  const darkMode = useSyncExternalStore(
    subscribe,
    getStoredTheme,
    getServerTheme
  );

  useEffect(() => {
    applyTheme(darkMode);
  }, [darkMode]);

  const toggleDarkMode = () => {
    const nextTheme = !getStoredTheme();

    localStorage.setItem(THEME_KEY, nextTheme ? "dark" : "light");
    applyTheme(nextTheme);

    window.dispatchEvent(new Event(THEME_EVENT));
  };

  return {
    darkMode,
    toggleDarkMode,
  };
}