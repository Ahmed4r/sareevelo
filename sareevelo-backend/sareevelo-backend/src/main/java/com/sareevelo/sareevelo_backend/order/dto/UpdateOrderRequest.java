package com.sareevelo.sareevelo_backend.order.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;

public record UpdateOrderRequest(
    @NotBlank @Size(max = 150) String customerName,
    @NotBlank @Size(max = 255) String pickupAddress,
    @NotBlank @Size(max = 255) String deliveryAddress,
    Instant deliveryWindowStart,
    Instant deliveryWindowEnd
) {}
