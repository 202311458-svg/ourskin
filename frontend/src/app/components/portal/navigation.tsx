import type { ReactNode } from "react";
import {
  FaBullhorn,
  FaCalendarAlt,
  FaCalendarCheck,
  FaCalendarPlus,
  FaChartBar,
  FaClipboardList,
  FaFileMedicalAlt,
  FaHistory,
  FaNotesMedical,
  FaRobot,
  FaTachometerAlt,
  FaUserClock,
  FaUserMd,
  FaUserShield,
  FaUsersCog,
} from "react-icons/fa";

export type PortalRole = "admin" | "staff" | "doctor" | "patient";

export type PortalNavItem = {
  label: string;
  href: string;
  icon: ReactNode;
};

export type PortalNavGroup = {
  label?: string;
  items: PortalNavItem[];
};

export const roleLabels: Record<PortalRole, string> = {
  admin: "Administration",
  staff: "Clinic operations",
  doctor: "Clinical workspace",
  patient: "Patient portal",
};

export const profileRoutes: Record<PortalRole, string | null> = {
  admin: "/pages/admin/profile",
  staff: "/pages/staff/profile",
  doctor: "/pages/doctor/settings",
  patient: "/pages/patient/profile",
};

export const portalNavigation: Record<PortalRole, PortalNavGroup[]> = {
  admin: [
    { items: [{ label: "Dashboard", href: "/pages/admin/dashboard", icon: <FaTachometerAlt /> }] },
    {
      label: "Operations",
      items: [
        { label: "Appointments", href: "/pages/admin/appointments", icon: <FaCalendarCheck /> },
        { label: "Schedules", href: "/pages/admin/schedules", icon: <FaCalendarAlt /> },
        { label: "Follow-ups", href: "/pages/admin/follow-ups", icon: <FaUserClock /> },
      ],
    },
    {
      label: "People",
      items: [
        { label: "Patients & users", href: "/pages/admin/users", icon: <FaUsersCog /> },
        { label: "Staff management", href: "/pages/admin/staff-mgmt", icon: <FaUserShield /> },
      ],
    },
    {
      label: "Oversight",
      items: [
        { label: "AI review monitor", href: "/pages/admin/ai-logs", icon: <FaRobot /> },
        { label: "Reports", href: "/pages/admin/reports", icon: <FaChartBar /> },
        { label: "Audit logs", href: "/pages/admin/audit-logs", icon: <FaClipboardList /> },
        { label: "Announcements", href: "/pages/admin/announcements", icon: <FaBullhorn /> },
      ],
    },
  ],
  staff: [
    { items: [{ label: "Dashboard", href: "/pages/staff/dashboard", icon: <FaTachometerAlt /> }] },
    {
      label: "Operations",
      items: [
        { label: "Appointment requests", href: "/pages/staff/requests", icon: <FaClipboardList /> },
        { label: "Appointments", href: "/pages/staff/appointments", icon: <FaCalendarCheck /> },
        { label: "Schedules", href: "/pages/staff/schedules", icon: <FaCalendarAlt /> },
        { label: "Follow-ups", href: "/pages/staff/follow-ups", icon: <FaUserClock /> },
        { label: "History", href: "/pages/staff/history", icon: <FaHistory /> },
      ],
    },
    {
      label: "Communication",
      items: [{ label: "Announcements", href: "/pages/staff/announcements", icon: <FaBullhorn /> }],
    },
  ],
  doctor: [
    { items: [{ label: "Dashboard", href: "/pages/doctor/dashboard", icon: <FaTachometerAlt /> }] },
    {
      label: "Clinical work",
      items: [
        { label: "Appointments", href: "/pages/doctor/appointments", icon: <FaCalendarCheck /> },
        { label: "Follow-ups", href: "/pages/doctor/follow-ups", icon: <FaUserClock /> },
        { label: "Patient records", href: "/pages/doctor/patient-records", icon: <FaNotesMedical /> },
        { label: "AI analysis", href: "/pages/doctor/ai-analysis", icon: <FaRobot /> },
      ],
    },
    {
      label: "Communication",
      items: [{ label: "Announcements", href: "/pages/doctor/announcements", icon: <FaBullhorn /> }],
    },
  ],
  patient: [
    { items: [{ label: "Dashboard", href: "/pages/patient/dashboard", icon: <FaTachometerAlt /> }] },
    {
      label: "My care",
      items: [
        { label: "Book appointment", href: "/pages/patient/book", icon: <FaCalendarPlus /> },
        { label: "Appointments", href: "/pages/patient/history", icon: <FaCalendarCheck /> },
        { label: "Medical records", href: "/pages/patient/records", icon: <FaFileMedicalAlt /> },
      ],
    },
  ],
};

export const profileIcons: Record<Exclude<PortalRole, "admin">, ReactNode> = {
  staff: <FaUserShield />,
  doctor: <FaUserMd />,
  patient: <FaUserMd />,
};
