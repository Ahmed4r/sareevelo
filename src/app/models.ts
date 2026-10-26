export type OrderStatus = 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'DELAYED';
export type DriverStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';
export interface Order {
  id: string;
  customer: string;
  destination: string;
  status: OrderStatus;
  priority: 'NORMAL' | 'HIGH';
  etaMinutes: number;
  driverId: string | null;
  createdAt: string;
}
export interface Driver {
  id: string;
  name: string;
  status: DriverStatus;
  lat: number;
  lng: number;
  load: number;
  maxLoad: number;
}
export interface DashboardSummary {
  activeDeliveries: number;
  deliveredToday: number;
  delayedOrders: number;
  availableDrivers: number;
  onTimeRate: number;
}
export interface ActivityEvent {
  id: string;
  type: 'order_created' | 'order_delivered' | 'order_delayed' | 'driver_assigned';
  message: string;
  timestamp: string;
}
