/** A gym / training venue */
export interface Gym {
  id: string;
  name: string;
  address: string;
  scheduleUrl?: string;
  phone?: string;
  email?: string;
  lat?: number;
  lng?: number;
}
