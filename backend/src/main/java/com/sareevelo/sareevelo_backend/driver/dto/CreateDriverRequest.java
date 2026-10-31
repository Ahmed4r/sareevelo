package com.sareevelo.sareevelo_backend.driver.dto;

import jakarta.validation.constraints.*;

public record CreateDriverRequest(
        @NotBlank @Size(max = 150) String name,
        @NotBlank @Size(max = 50) String employeeCode,
        @NotNull @Min(1) Integer capacity,
        @NotBlank @Pattern(regexp = "\\+?[0-9]{7,15}", message = "must contain 7–15 digits, optionally prefixed with +") String mobileNumber,
        @Email @Size(max = 254) String email,
        @Pattern(regexp = "BICYCLE|MOTORCYCLE|CAR|VAN|TRUCK|OTHER") String vehicleType,
        @Size(max = 32) String vehicleRegistration,
        @Size(max = 1000) String notes
) {
    public CreateDriverRequest {
        name = DriverProfileRequest.clean(name);
        employeeCode = DriverProfileRequest.clean(employeeCode);
        mobileNumber = DriverProfileRequest.phone(mobileNumber);
        email = DriverProfileRequest.clean(email);
        vehicleType = DriverProfileRequest.clean(vehicleType);
        vehicleRegistration = DriverProfileRequest.clean(vehicleRegistration);
        notes = DriverProfileRequest.clean(notes);
    }
}
