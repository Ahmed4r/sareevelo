import { OrderStatus } from '../models';

export interface UpdateOrderStatusRequest { status: OrderStatus; }
export interface OrderActivity {
  id: number;
  orderId: number;
  type: 'ORDER_CREATED' | 'DRIVER_ASSIGNED' | 'DELIVERY_STARTED' | 'DELIVERY_DELAYED' | 'DELIVERY_RESUMED' | 'DELIVERY_COMPLETED';
  message: string;
  timestamp: string;
}

/** Exact public DTO returned by the Spring OrderController. */
export interface OrderResponse {
  id: number;
  trackingNumber: string;
  customerName: string;
  pickupAddress: string;
  deliveryAddress: string;
  status: OrderStatus;
  driverId: number | null;
}

export interface CreateOrderRequest {
  customerName: string;
  pickupAddress: string;
  deliveryAddress: string;
}

/** Presentation names used by the existing dispatch UI. */
export interface OrderView {
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
    id: order.id,
    trackingNumber: order.trackingNumber,
    customer: order.customerName,
    pickupAddress: order.pickupAddress,
    destination: order.deliveryAddress,
    status: order.status,
    driverId: order.driverId
  };
}
