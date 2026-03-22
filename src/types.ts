export interface User {
  id: string;
  email: string;
  /** UI role: `admin` = in-charger / incharger dashboard */
  role: 'customer' | 'admin';
}

export interface Slot {
  id: string;
  label: string;
  status: 'available' | 'booked' | 'occupied';
  location: string;
  tier: 'gold' | 'silver' | 'bronze';
}

export interface Booking {
  id: string;
  user_id: string;
  slot_id: string;
  slot_label: string;
  location: string;
  tier: string;
  user_email?: string;
  vehicle_number: string;
  vehicle_type: string;
  start_time: string;
  duration: number;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
}
