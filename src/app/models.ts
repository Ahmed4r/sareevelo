export type OrderStatus = 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'DELAYED';
export type { OrderResponse as Order, CreateOrderRequest } from './orders/order-api.models';
export type { Driver, CreateDriverRequest, AssignDriverRequest } from './drivers/driver-api.models';
