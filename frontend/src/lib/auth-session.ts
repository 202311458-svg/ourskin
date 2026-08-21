export type AuthSession = {
  access_token: string;
  role: string;
};

export function getRoleHome(role: string) {
  if (role === "admin") return "/pages/admin/dashboard";
  if (role === "staff") return "/pages/staff/dashboard";
  if (role === "doctor") return "/pages/doctor/dashboard";
  return "/pages/patient/home";
}

export function persistAuthSession(session: AuthSession) {
  localStorage.setItem("token", session.access_token);
  localStorage.setItem("role", session.role);
}