package com.sareevelo.sareevelo_backend.order.dto;

import jakarta.validation.constraints.NotNull;

public record AssignDriverRequest(
        @NotNull Long driverId) {
}