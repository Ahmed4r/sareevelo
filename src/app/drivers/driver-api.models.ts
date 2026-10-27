export type VehicleType = 'BICYCLE' | 'MOTORCYCLE' | 'CAR' | 'VAN' | 'TRUCK' | 'OTHER';
export interface DriverProfile {
  name: string;
  mobileNumber: string | null;
  email: string | null;
  vehicleType: VehicleType | null;
  vehicleRegistration: string | null;
  notes: string | null;
}
export interface Driver extends DriverProfile {
  id: number;
  name: string;
  employeeCode: string;
  status: 'AVAILABLE' | 'ON_DELIVERY' | 'OFFLINE';
  capacity: number;
  availableSpaces: number;
}

export interface CreateDriverRequest extends DriverProfile {
  name: string;
  employeeCode: string;
  capacity: number;
}

export interface AssignDriverRequest { driverId: number; }
