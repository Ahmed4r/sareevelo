package com.sareevelo.sareevelo_backend.order.dto;

public record DriverSuggestion(Long driverId, String name, String employeeCode,
        int availableSpaces, int capacity, int activeOrders, long assignmentsToday,
        java.time.Instant lastAssignedAt, String dispatchTimeZone, String reason) {}
