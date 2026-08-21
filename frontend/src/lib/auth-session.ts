import { API_BASE_URL, markBrowserSession } from "@/app/utils/auth";

export type AuthSession = {
  access_token?: string;
  role: string;
};

export function getRoleHome(role: string) {
  if (role === "admin") return "/pages/admin/dashboard";
  if (role === "staff") return "/pages/staff/dashboard";
  if (role === "doctor") return "/pages/doctor/dashboard";
  return "/pages/patient/home";
}

export async function persistAuthSession(session: AuthSession) {
  if (session.access_token) {
    const response = await fetch(`${API_BASE_URL}/auth/session/exchange`, {
      method: "POST",
      credentials: "include",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (!response.ok) {
      throw new Error("Unable to establish secure browser session");
    }
  }

  markBrowserSession(session.role);
}
