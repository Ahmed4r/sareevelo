import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateOrderRequest, OrderResponse, UpdateOrderStatusRequest, OrderActivity } from './order-api.models';
import { AssignDriverRequest } from '../drivers/driver-api.models';

@Injectable({ providedIn: 'root' })
export class OrderApiService {
  private readonly http = inject(HttpClient);
  private readonly url = '/api/v1/orders';

  getOrders(): Observable<OrderResponse[]> {
    return this.http.get<OrderResponse[]>(this.url);
  }

  getOrderById(id: number): Observable<OrderResponse> {
    return this.http.get<OrderResponse>(`${this.url}/${id}`);
  }

  createOrder(request: CreateOrderRequest): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(this.url, request);
  }

  updateOrder(id: number, request: CreateOrderRequest): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(`${this.url}/${id}`, request);
  }

  assignDriver(id: number, request: AssignDriverRequest): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(`${this.url}/${id}/assign`, request);
  }

  updateStatus(id: number, request: UpdateOrderStatusRequest): Observable<OrderResponse> {
    return this.http.patch<OrderResponse>(`${this.url}/${id}/status`, request);
  }

  getActivity(id: number): Observable<OrderActivity[]> {
    return this.http.get<OrderActivity[]>(`${this.url}/${id}/activity`);
  }
}
