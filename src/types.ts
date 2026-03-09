export interface User {
  id: number;
  email: string;
  role: 'customer' | 'admin';
}

export interface Slot {
  id: number;
  label: string;
  status: 'available' | 'booked' | 'occupied';
  location: string;
  tier: 'gold' | 'silver' | 'bronze';
}

export interface Booking {
  id: string;
  user_id: number;
  slot_id: number;
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
