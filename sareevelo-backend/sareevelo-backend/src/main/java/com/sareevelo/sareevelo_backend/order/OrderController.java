package com.sareevelo.sareevelo_backend.order;

import java.util.List;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.sareevelo.sareevelo_backend.order.dto.AssignDriverRequest;
import com.sareevelo.sareevelo_backend.order.dto.CreateOrderRequest;
import com.sareevelo.sareevelo_backend.order.dto.OrderResponse;
import com.sareevelo.sareevelo_backend.order.dto.UpdateOrderStatusRequest;
import com.sareevelo.sareevelo_backend.activity.ActivityResponse;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @GetMapping
    public List<OrderResponse> getAllOrders() {
        return orderService.getAllOrders();
    }

    @GetMapping("/{id}")
    public OrderResponse getOrderById(@PathVariable Long id) {
        return orderService.getOrderById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse createOrder(
            @Valid @RequestBody CreateOrderRequest request) {

        return orderService.createOrder(request);
    }

    @PostMapping("/{id}/assign")
    public OrderResponse assignDriver(
            @PathVariable Long id,
            @Valid @RequestBody AssignDriverRequest request) {

        return orderService.assignDriver(id, request);
    }

    @PatchMapping("/{id}/status")
    public OrderResponse updateStatus(@PathVariable Long id, @Valid @RequestBody UpdateOrderStatusRequest request) {
        return orderService.updateStatus(id, request);
    }

    @GetMapping("/{id}/activity")
    public List<ActivityResponse> getActivity(@PathVariable Long id) {
        return orderService.getActivity(id);
    }
}
