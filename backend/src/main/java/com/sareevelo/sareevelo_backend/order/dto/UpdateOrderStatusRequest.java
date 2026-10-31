package com.sareevelo.sareevelo_backend.order.dto;

import com.sareevelo.sareevelo_backend.order.OrderStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateOrderStatusRequest(@NotNull OrderStatus status) {}
