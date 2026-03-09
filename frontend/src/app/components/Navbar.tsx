"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import {
  FaCalendarAlt,
  FaHistory,
  FaUser,
  FaPlusCircle,
  FaSignOutAlt,
  FaMoon,
  FaSun,
  FaBell,
  FaEnvelope
} from "react-icons/fa";

export default function Navbar() {
  const router = useRouter();
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const navItems = [
    { name: "Dashboard", path: "/pages/patient/dashboard", icon: <FaCalendarAlt /> },
    { name: "Book Appointment", path: "/pages/patient/book", icon: <FaPlusCircle /> },
    { name: "History", path: "/pages/patient/history", icon: <FaHistory /> },
    { name: "Profile", path: "/pages/patient/profile", icon: <FaUser /> },
    { name: "Messages", path: "/pages/patient/messages", icon: <FaEnvelope /> },
    { name: "Updates", path: "/pages/patient/updates", icon: <FaBell /> },
  ];

  // Apply dark/light mode globally
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("darkMode");
    } else {
      document.body.classList.remove("darkMode");
    }
  }, [darkMode]);

  return (
    <aside className={`navbar ${collapsed ? "collapsed" : ""} ${darkMode ? "dark" : ""}`}>
      {/* Logo acts as collapse/expand toggle */}
      <div className="logoSection" onClick={() => setCollapsed(!collapsed)}>
        <Image
          src="/os-logo.png"
          alt="OurSkin"
          width={collapsed ? 50 : 160}
          height={collapsed ? 50 : 60}
          className="logoBtn"
        />
      </div>

      <nav className="navMenu">
        {navItems.map((item, idx) => (
          <div
            key={idx}
            className={`navItem ${path === item.path ? "active" : ""}`}
            onClick={() => router.push(item.path)}
          >
            <span className="icon">{item.icon}</span>
            {!collapsed && <span className="label">{item.name}</span>}
            {path === item.path && !collapsed && <span className="activeBar" />}
          </div>
        ))}
      </nav>

      <div className="navBottom">
        <div className="navItem" onClick={() => setDarkMode(!darkMode)}>
          <span className="icon">{darkMode ? <FaSun /> : <FaMoon />}</span>
          {!collapsed && <span className="label">{darkMode ? "Light Mode" : "Dark Mode"}</span>}
        </div>
        <div className="navItem" onClick={() => router.push("/")}>
          <span className="icon"><FaSignOutAlt /></span>
          {!collapsed && <span className="label">Logout</span>}
        </div>
      </div>
    </aside>
  );
}