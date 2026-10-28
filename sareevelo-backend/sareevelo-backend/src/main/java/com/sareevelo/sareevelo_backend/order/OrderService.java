
package com.sareevelo.sareevelo_backend.order;

import com.sareevelo.sareevelo_backend.driver.Driver;
import com.sareevelo.sareevelo_backend.driver.DriverRepository;
import com.sareevelo.sareevelo_backend.driver.DriverStatus;
import com.sareevelo.sareevelo_backend.order.dto.AssignDriverRequest;
import com.sareevelo.sareevelo_backend.order.dto.CreateOrderRequest;
import com.sareevelo.sareevelo_backend.order.dto.OrderResponse;
import com.sareevelo.sareevelo_backend.order.dto.UpdateOrderStatusRequest;
import com.sareevelo.sareevelo_backend.activity.ActivityEvent;
import com.sareevelo.sareevelo_backend.activity.ActivityRepository;
import com.sareevelo.sareevelo_backend.activity.ActivityResponse;

import jakarta.transaction.Transactional;

import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.List;

@Service
public class OrderService {
    private static final java.security.SecureRandom TRACKING_RANDOM = new java.security.SecureRandom();
    private static final String TRACKING_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

    private final OrderRepository orderRepository;
    private final DriverRepository driverRepository;
    private final ActivityRepository activityRepository;

    public OrderService(
            OrderRepository orderRepository,
            DriverRepository driverRepository,
            ActivityRepository activityRepository) {

        this.orderRepository = orderRepository;
        this.driverRepository = driverRepository;
        this.activityRepository = activityRepository;
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
                        "Order not found: " + id));

        return toResponse(order);
    }

    @Transactional
    public OrderResponse createOrder(CreateOrderRequest request) {
        validateWindow(request.deliveryWindowStart(), request.deliveryWindowEnd());

        String trackingNumber = request.trackingNumber() == null || request.trackingNumber().isBlank()
                ? generateTrackingNumber() : request.trackingNumber().trim();
        if (orderRepository.existsByTrackingNumber(trackingNumber)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This tracking number is already in use. Enter a different tracking number.");
        }

        Order order = new Order();

        order.setTrackingNumber(trackingNumber);
        order.setCustomerName(request.customerName().trim());
        order.setPickupAddress(request.pickupAddress().trim());
        order.setDeliveryAddress(request.deliveryAddress().trim());
        order.setDeliveryWindowStart(request.deliveryWindowStart());
        order.setDeliveryWindowEnd(request.deliveryWindowEnd());

        order.setStatus(OrderStatus.PENDING);

        Order savedOrder = orderRepository.save(order);
        recordEvent(savedOrder, ActivityEvent.Type.ORDER_CREATED, "Order created");

        return toResponse(savedOrder);
    }

    @Transactional
    public OrderResponse updateOrder(Long id, com.sareevelo.sareevelo_backend.order.dto.UpdateOrderRequest request) {
        validateWindow(request.deliveryWindowStart(), request.deliveryWindowEnd());
        Order order = orderRepository.findForAssignment(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        if (order.getStatus() != OrderStatus.PENDING) throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Only pending orders can be edited. Refresh to see the latest delivery status.");
        String customer = request.customerName().trim(), pickup = request.pickupAddress().trim(), delivery = request.deliveryAddress().trim();
        boolean changed = !customer.equals(order.getCustomerName()) || !pickup.equals(order.getPickupAddress()) || !delivery.equals(order.getDeliveryAddress())
                || !java.util.Objects.equals(request.deliveryWindowStart(), order.getDeliveryWindowStart())
                || !java.util.Objects.equals(request.deliveryWindowEnd(), order.getDeliveryWindowEnd());
        if (!changed) return toResponse(order);
        order.setCustomerName(customer); order.setPickupAddress(pickup); order.setDeliveryAddress(delivery);
        order.setDeliveryWindowStart(request.deliveryWindowStart()); order.setDeliveryWindowEnd(request.deliveryWindowEnd());
        orderRepository.save(order);
        recordEvent(order, ActivityEvent.Type.ORDER_UPDATED, "Order details or delivery window updated");
        return toResponse(order);
    }

    private void validateWindow(java.time.Instant start, java.time.Instant end) {
        if ((start == null) != (end == null) || (start != null && !end.isAfter(start))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Provide both delivery window times, with the end after the start, or leave both empty.");
        }
    }

    private String generateTrackingNumber() {
        // 16 random symbols; database uniqueness is the final guard across server instances.
        for (int attempt = 0; attempt < 5; attempt++) {
            StringBuilder number = new StringBuilder("SAR-");
            for (int i = 0; i < 16; i++) {
                if (i > 0 && i % 4 == 0) number.append('-');
                number.append(TRACKING_ALPHABET.charAt(TRACKING_RANDOM.nextInt(TRACKING_ALPHABET.length())));
            }
            String candidate = number.toString();
            if (!orderRepository.existsByTrackingNumber(candidate)) return candidate;
        }
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Could not generate a tracking number. Please try again.");
    }

    private OrderResponse toResponse(Order order) {
        return new OrderResponse(
                order.getId(),
                order.getTrackingNumber(),
                order.getCustomerName(),
                order.getPickupAddress(),
                order.getDeliveryAddress(),
                order.getStatus(),
                order.getDriverId(), order.getDeliveryWindowStart(), order.getDeliveryWindowEnd());
    }

    @Transactional
    public OrderResponse assignDriver(
            Long orderId,
            AssignDriverRequest request) {

        Order order = orderRepository.findForAssignment(orderId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Order not found"));

        Driver driver = driverRepository.findForAssignment(request.driverId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Driver not found"));

        if (order.getDriverId() != null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Order already assigned");
        }

        if (order.getStatus() != OrderStatus.PENDING) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Order is not pending");
        }

        if (driver.getStatus() == DriverStatus.OFFLINE ||
                driver.getAvailableSpaces() <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Driver is unavailable");
        }

        order.setDriverId(driver.getId());

        driver.setAvailableSpaces(driver.getAvailableSpaces() - 1);

        if (driver.getStatus() == DriverStatus.AVAILABLE) {
            driver.setStatus(DriverStatus.ON_DELIVERY);
        }

        driverRepository.save(driver);
        Order savedOrder = orderRepository.save(order);

        recordEvent(savedOrder, ActivityEvent.Type.DRIVER_ASSIGNED,
                "Assigned to " + driver.getName() + " (" + driver.getEmployeeCode() + ")");

        return toResponse(savedOrder);
    }

    public List<ActivityResponse> getActivity(Long orderId) {
        if (!orderRepository.existsById(orderId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
        }
        return activityRepository.findByOrderIdOrderByIdDesc(orderId).stream().map(ActivityResponse::from).toList();
    }

    @Transactional
    public OrderResponse updateStatus(Long orderId, UpdateOrderStatusRequest request) {
        Order order = orderRepository.findForAssignment(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        OrderStatus current = order.getStatus();
        OrderStatus target = request.status();
        // The order lock serializes retries and competing changes, including completion.
        if (current == target) return toResponse(order);

        if (target == OrderStatus.CANCELLED) {
            if (current == OrderStatus.DELIVERED) throw new ResponseStatusException(HttpStatus.CONFLICT, "Completed deliveries cannot be cancelled.");
            if (order.getDriverId() != null) {
                Driver driver = driverRepository.findForAssignment(order.getDriverId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Assigned driver no longer exists"));
                releaseCapacity(driver);
                driverRepository.save(driver);
            }
            order.setStatus(OrderStatus.CANCELLED); orderRepository.save(order);
            recordEvent(order, ActivityEvent.Type.ORDER_CANCELLED, "Order cancelled" + (order.getDriverId() == null ? "" : "; one driver space released"));
            return toResponse(order);
        }

        boolean allowed = switch (current) {
            case PENDING -> target == OrderStatus.IN_TRANSIT;
            case IN_TRANSIT -> target == OrderStatus.DELAYED || target == OrderStatus.DELIVERED;
            case DELAYED -> target == OrderStatus.IN_TRANSIT || target == OrderStatus.DELIVERED;
            case DELIVERED, CANCELLED -> false;
        };
        if (!allowed) throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Cannot change order status from " + current + " to " + target);
        if (order.getDriverId() == null) throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Assign a driver before changing delivery status");

        // Use the same order-then-driver lock ordering as assignment.
        Driver driver = driverRepository.findForAssignment(order.getDriverId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Assigned driver no longer exists"));
        if (target == OrderStatus.IN_TRANSIT && driver.getStatus() == DriverStatus.OFFLINE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "The assigned driver is offline");
        }

        ActivityEvent.Type type;
        String message;
        if (target == OrderStatus.DELIVERED) {
            releaseCapacity(driver);
            type = ActivityEvent.Type.DELIVERY_COMPLETED;
            message = "Delivery completed; one driver space released";
        } else if (target == OrderStatus.DELAYED) {
            type = ActivityEvent.Type.DELIVERY_DELAYED;
            message = "Delivery marked delayed";
        } else {
            driver.setStatus(DriverStatus.ON_DELIVERY);
            type = current == OrderStatus.DELAYED ? ActivityEvent.Type.DELIVERY_RESUMED : ActivityEvent.Type.DELIVERY_STARTED;
            message = current == OrderStatus.DELAYED ? "Delivery resumed" : "Delivery started";
        }
        order.setStatus(target);
        driverRepository.save(driver);
        orderRepository.save(order);
        recordEvent(order, type, message);
        return toResponse(order);
    }

    private void releaseCapacity(Driver driver) {
        if (driver.getAvailableSpaces() >= driver.getCapacity()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Driver capacity is inconsistent. Review the driver before closing this order.");
        }
        driver.setAvailableSpaces(driver.getAvailableSpaces() + 1);
        if (driver.getAvailableSpaces() == driver.getCapacity() && driver.getStatus() != DriverStatus.OFFLINE) driver.setStatus(DriverStatus.AVAILABLE);
    }

    private void recordEvent(Order order, ActivityEvent.Type type, String message) {
        activityRepository.save(new ActivityEvent(order.getId(), type, message));
    }
}
