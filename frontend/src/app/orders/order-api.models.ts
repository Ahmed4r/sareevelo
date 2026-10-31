import { OrderStatus } from '../models';

export interface DriverSuggestion {
  driverId: number;
  name: string;
  employeeCode: string;
  availableSpaces: number;
  capacity: number;
  activeOrders: number;
  assignmentsToday: number;
  lastAssignedAt: string | null;
  dispatchTimeZone: string;
  reason: string;
}

export interface UpdateOrderStatusRequest { status: OrderStatus; }
export interface OrderActivity {
  id: number;
  orderId: number;
  type: 'ORDER_CREATED' | 'DRIVER_ASSIGNED' | 'DELIVERY_STARTED' | 'DELIVERY_DELAYED' | 'DELIVERY_RESUMED' | 'DELIVERY_COMPLETED' | 'ORDER_UPDATED' | 'ORDER_CANCELLED';
  message: string;
  timestamp: string;
}

/** Exact public DTO returned by the Spring OrderController. */
export interface OrderResponse {
  deliveryWindowStart?: string | null;
  deliveryWindowEnd?: string | null;
  id: number;
  trackingNumber: string;
  customerName: string;
  pickupAddress: string;
  deliveryAddress: string;
  status: OrderStatus;
  driverId: number | null;
}

export interface CreateOrderRequest {
  deliveryWindowStart?: string | null;
  deliveryWindowEnd?: string | null;
  customerName: string;
  pickupAddress: string;
  deliveryAddress: string;
}

/** Presentation names used by the existing dispatch UI. */
export interface OrderView {
  deliveryWindowStart: string | null;
  deliveryWindowEnd: string | null;
  id: number;
  trackingNumber: string;
  customer: string;
  pickupAddress: string;
  destination: string;
  status: OrderStatus;
  driverId: number | null;
}

export function toOrderView(order: OrderResponse): OrderView {
  return {
    deliveryWindowStart: order.deliveryWindowStart ?? null,
    deliveryWindowEnd: order.deliveryWindowEnd ?? null,
    id: order.id,
    trackingNumber: order.trackingNumber,
    customer: order.customerName,
    pickupAddress: order.pickupAddress,
    destination: order.deliveryAddress,
    status: order.status,
    driverId: order.driverId
  };
}
