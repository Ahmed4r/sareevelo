import { OrderStatus } from '../models';

/** Exact public DTO returned by the Spring OrderController. */
export interface OrderResponse {
  id: number;
  trackingNumber: string;
  customerName: string;
  pickupAddress: string;
  deliveryAddress: string;
  status: OrderStatus;
}

export interface CreateOrderRequest {
  trackingNumber: string;
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
}

export function toOrderView(order: OrderResponse): OrderView {
  return {
    id: order.id,
    trackingNumber: order.trackingNumber,
    customer: order.customerName,
    pickupAddress: order.pickupAddress,
    destination: order.deliveryAddress,
    status: order.status
  };
}
