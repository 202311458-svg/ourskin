export interface Patient {
  id: number;
  name: string;
  email: string;
  contact: string;
}

export interface Appointment {
  id: number;
  patientName: string;
  status: "pending" | "accepted" | "declined";
  date: string;
}

let appointments: Appointment[] = [
  { id: 1, patientName: "Faith", status: "pending", date: "2026-02-21" },
  { id: 2, patientName: "Angela", status: "pending", date: "2026-02-22" },
];

export async function fetchAppointments(): Promise<Appointment[]> {
  return new Promise((resolve) => setTimeout(() => resolve(appointments), 500));
}

export async function updateAppointmentStatus(
  id: number,
  status: "accepted" | "declined"
): Promise<Appointment> {
  const index = appointments.findIndex((a) => a.id === id);
  if (index !== -1) {
    appointments[index].status = status;
    return new Promise((resolve) => setTimeout(() => resolve(appointments[index]), 500));
  }
  throw new Error("Appointment not found");
}

export async function createAppointment(patientName: string, date: string): Promise<Appointment> {
  const newAppointment: Appointment = {
    id: appointments.length + 1,
    patientName,
    status: "pending",
    date,
  };
  appointments.push(newAppointment);
  return new Promise((resolve) => setTimeout(() => resolve(newAppointment), 500));
}