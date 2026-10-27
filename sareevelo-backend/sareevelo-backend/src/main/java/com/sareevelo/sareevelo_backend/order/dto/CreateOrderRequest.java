package com.sareevelo.sareevelo_backend.order.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateOrderRequest(
    // Optional for legacy API clients. The application omits this field.
    @Size(max = 50) String trackingNumber,
    @NotBlank @Size(max = 150) String customerName,
    @NotBlank @Size(max = 255) String pickupAddress,
    @NotBlank @Size(max = 255) String deliveryAddress
) {}
