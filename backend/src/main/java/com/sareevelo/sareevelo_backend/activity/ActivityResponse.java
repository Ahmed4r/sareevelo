package com.sareevelo.sareevelo_backend.activity;

import java.time.Instant;

public record ActivityResponse(Long id, Long orderId, ActivityEvent.Type type, String message, Instant timestamp) {
    public static ActivityResponse from(ActivityEvent event) {
        return new ActivityResponse(event.getId(), event.getOrderId(), event.getType(), event.getMessage(), event.getTimestamp());
    }
}
