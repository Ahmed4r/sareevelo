package com.sareevelo.sareevelo_backend.driver.dto;

import com.sareevelo.sareevelo_backend.driver.DriverStatus;

public record DriverResponse(
        Long id,
        String name,
        String employeeCode,
        DriverStatus status,
        int capacity,
        int availableSpaces,
        String mobileNumber,
        String email,
        String vehicleType,
        String vehicleRegistration,
        String notes
) {}
