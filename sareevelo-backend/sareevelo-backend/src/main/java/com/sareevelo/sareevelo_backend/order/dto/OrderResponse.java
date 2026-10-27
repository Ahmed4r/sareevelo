package com.sareevelo.sareevelo_backend.order.dto;

import com.sareevelo.sareevelo_backend.order.OrderStatus;

public record OrderResponse(
    Long id,
    String trackingNumber,
    String customerName,
    String pickupAddress,
    String deliveryAddress,
    OrderStatus status,
    Long driverId
) {}
