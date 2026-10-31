package com.sareevelo.sareevelo_backend.activity;

import java.time.Instant;

public interface DriverAssignmentHistory {
    Long getDriverId();
    Long getAssignmentsToday();
    Instant getLastAssignedAt();
}
