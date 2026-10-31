import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Driver, CreateDriverRequest, DriverProfile } from './driver-api.models';

@Injectable({ providedIn: 'root' })
export class DriverApiService {
  private readonly http = inject(HttpClient);
  private readonly url = '/api/v1/drivers';
  getDrivers() { return this.http.get<Driver[]>(this.url); }
  getDriverById(id: number) { return this.http.get<Driver>(`${this.url}/${id}`); }
  createDriver(request: CreateDriverRequest) { return this.http.post<Driver>(this.url, request); }
  updateProfile(id: number, request: DriverProfile) { return this.http.put<Driver>(`${this.url}/${id}/profile`, request); }
}
