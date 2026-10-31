package com.sareevelo.sareevelo_backend.driver.dto;

import jakarta.validation.constraints.*;

/** Full replacement of profile fields only; operational state is never accepted here. */
public record DriverProfileRequest(
        @NotBlank @Size(max = 150) String name,
        @Pattern(regexp = "\\+?[0-9]{7,15}", message = "must contain 7–15 digits, optionally prefixed with +") String mobileNumber,
        @Email @Size(max = 254) String email,
        @Pattern(regexp = "BICYCLE|MOTORCYCLE|CAR|VAN|TRUCK|OTHER") String vehicleType,
        @Size(max = 32) String vehicleRegistration,
        @Size(max = 1000) String notes
) {
    public DriverProfileRequest {
        name = clean(name); mobileNumber = phone(mobileNumber); email = clean(email);
        vehicleType = clean(vehicleType); vehicleRegistration = clean(vehicleRegistration); notes = clean(notes);
    }
    public static String clean(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    public static String phone(String value) {
        String cleaned = clean(value);
        return cleaned == null ? null : cleaned.replaceAll("[\\s().-]", "");
    }
}
