
package com.sareevelo.sareevelo_backend.order;

import com.sareevelo.sareevelo_backend.order.dto.CreateOrderRequest;
import com.sareevelo.sareevelo_backend.order.dto.OrderResponse;

import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.List;

@Service
public class OrderService {

    private final OrderRepository orderRepository;

    public OrderService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    public List<OrderResponse> getAllOrders() {
        return orderRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public OrderResponse getOrderById(Long id) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Order not found: " + id
                ));

        return toResponse(order);
    }

    public OrderResponse createOrder(CreateOrderRequest request) {

        if (orderRepository.existsByTrackingNumber(request.trackingNumber().trim())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This tracking number is already in use. Enter a different tracking number.");
        }

        Order order = new Order();

        order.setTrackingNumber(request.trackingNumber().trim());
        order.setCustomerName(request.customerName().trim());
        order.setPickupAddress(request.pickupAddress().trim());
        order.setDeliveryAddress(request.deliveryAddress().trim());

        order.setStatus(OrderStatus.PENDING);

        Order savedOrder = orderRepository.save(order);

        return toResponse(savedOrder);
    }

    private OrderResponse toResponse(Order order) {
        return new OrderResponse(
                order.getId(),
                order.getTrackingNumber(),
                order.getCustomerName(),
                order.getPickupAddress(),
                order.getDeliveryAddress(),
                order.getStatus()
        );
    }
}
