"use client";

import { useEffect } from "react";

export default function ThemeInitializer() {
  useEffect(() => {
    const savedTheme = localStorage.getItem("ourskin-theme");
    const isDark = savedTheme === "dark";

    document.body.classList.toggle("darkMode", isDark);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  }, []);

  return null;
}