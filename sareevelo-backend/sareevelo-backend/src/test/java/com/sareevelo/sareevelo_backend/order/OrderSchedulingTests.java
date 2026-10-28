package com.sareevelo.sareevelo_backend.order;

import com.sareevelo.sareevelo_backend.order.dto.*;
import com.sareevelo.sareevelo_backend.driver.*;
import com.sareevelo.sareevelo_backend.driver.dto.CreateDriverRequest;
import com.sareevelo.sareevelo_backend.activity.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @Transactional
class OrderSchedulingTests {
    @Autowired OrderController controller;
    @Autowired OrderService orders;
    @Autowired OrderRepository repository;
    @Autowired DriverService drivers;
    @Autowired DriverRepository driverRepository;
    @Autowired ActivityRepository activity;
    @Autowired EntityManager em;
    private MockMvc mvc;
    private final Instant start = Instant.parse("2026-11-02T09:00:00Z"), end = Instant.parse("2026-11-02T11:00:00Z");
    @BeforeEach void setup() { mvc = MockMvcBuilders.standaloneSetup(controller).setControllerAdvice(new OrderExceptionHandler()).build(); }
    private OrderResponse order() { return orders.createOrder(new CreateOrderRequest(null, "Schedule test", "Pickup", "Delivery", start, end)); }
    private Long driver() { return drivers.createDriver(new CreateDriverRequest("Schedule driver", "TEST-" + UUID.randomUUID(), 1, "+4915123456789", null, null, null, null)).id(); }

    @Test void windowsPersistAsInstantsAndRejectIncompleteReversedOrMalformedValues() throws Exception {
        mvc.perform(post("/api/v1/orders").contentType(MediaType.APPLICATION_JSON).content("""
          {"customerName":"Scheduled","pickupAddress":"Pickup","deliveryAddress":"Delivery",
           "deliveryWindowStart":"2026-11-02T10:00:00+01:00","deliveryWindowEnd":"2026-11-02T12:00:00+01:00"}
          """)).andExpect(status().isCreated()).andExpect(jsonPath("$.deliveryWindowStart").value(start.toString())).andExpect(jsonPath("$.deliveryWindowEnd").value(end.toString()));
        var created = order(); repository.flush(); em.clear();
        assertEquals(start, repository.findById(created.id()).orElseThrow().getDeliveryWindowStart());
        mvc.perform(get("/api/v1/orders/{id}", created.id())).andExpect(jsonPath("$.deliveryWindowEnd").value(end.toString()));
        long count = repository.count();
        for (String window : new String[]{"\"deliveryWindowStart\":\"2026-11-02T09:00:00Z\"", "\"deliveryWindowEnd\":\"2026-11-02T09:00:00Z\"", "\"deliveryWindowStart\":\"2026-11-02T09:00:00Z\",\"deliveryWindowEnd\":\"2026-11-02T09:00:00Z\"", "\"deliveryWindowStart\":\"bad-date\""}) {
            mvc.perform(post("/api/v1/orders").contentType(MediaType.APPLICATION_JSON).content("{\"customerName\":\"Invalid\",\"pickupAddress\":\"Pickup\",\"deliveryAddress\":\"Delivery\"," + window + "}"))
                .andExpect(status().isBadRequest());
        }
        assertEquals(count, repository.count());
    }

    @Test void pendingEditsPreserveIdentityAssignmentCapacityAndRecordHistoryOnce() throws Exception {
        var order = order(); Long driver = driver(); orders.assignDriver(order.id(), new AssignDriverRequest(driver));
        String body = "{\"customerName\":\"Updated\",\"pickupAddress\":\"New pickup\",\"deliveryAddress\":\"New delivery\",\"deliveryWindowStart\":null,\"deliveryWindowEnd\":null}";
        for (int i = 0; i < 2; i++) mvc.perform(put("/api/v1/orders/{id}", order.id()).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk()).andExpect(jsonPath("$.trackingNumber").value(order.trackingNumber()))
            .andExpect(jsonPath("$.driverId").value(driver)).andExpect(jsonPath("$.status").value("PENDING"));
        repository.flush(); em.clear(); var saved = orders.getOrderById(order.id());
        assertNull(saved.deliveryWindowStart()); assertNull(saved.deliveryWindowEnd()); assertEquals("New delivery", saved.deliveryAddress());
        assertEquals(0, drivers.getDriverById(driver).availableSpaces());
        assertEquals(1, activity.findByOrderIdOrderByIdDesc(order.id()).stream().filter(event -> event.getType() == ActivityEvent.Type.ORDER_UPDATED).count());
    }

    @Test void editedDatesCanBeReadAndAssignedWithoutLosingTheWindow() throws Exception {
        var order = order(); Long driver = driver();
        String body = """
            {"customerName":"Schedule test","pickupAddress":"Pickup","deliveryAddress":"Delivery",
             "deliveryWindowStart":"2026-11-03T10:00:00+01:00","deliveryWindowEnd":"2026-11-03T12:00:00+01:00"}
            """;
        mvc.perform(put("/api/v1/orders/{id}", order.id()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());
        repository.flush(); em.clear();
        mvc.perform(get("/api/v1/orders/{id}", order.id())).andExpect(status().isOk())
            .andExpect(jsonPath("$.deliveryWindowStart").value("2026-11-03T09:00:00Z"));
        mvc.perform(post("/api/v1/orders/{id}/assign", order.id()).contentType(MediaType.APPLICATION_JSON).content("{\"driverId\":" + driver + "}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.driverId").value(driver))
            .andExpect(jsonPath("$.deliveryWindowEnd").value("2026-11-03T11:00:00Z"));
        repository.flush(); em.clear();
        assertEquals(0, drivers.getDriverById(driver).availableSpaces());
        assertEquals(order.trackingNumber(), orders.getOrderById(order.id()).trackingNumber());
    }

    @Test void editsAreRejectedAfterDispatchAndForMissingOrders() throws Exception {
        var order = order(); Long driver = driver(); orders.assignDriver(order.id(), new AssignDriverRequest(driver)); orders.updateStatus(order.id(), new UpdateOrderStatusRequest(OrderStatus.IN_TRANSIT));
        String body = "{\"customerName\":\"Changed\",\"pickupAddress\":\"Changed\",\"deliveryAddress\":\"Changed\"}";
        mvc.perform(put("/api/v1/orders/{id}", order.id()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isConflict());
        assertEquals("Pickup", orders.getOrderById(order.id()).pickupAddress());
        mvc.perform(put("/api/v1/orders/-1").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isNotFound());
    }

    @Test void unassignedCancellationIsIdempotentAndTerminal() {
        var order = order();
        for (int i = 0; i < 2; i++) assertEquals(OrderStatus.CANCELLED, orders.updateStatus(order.id(), new UpdateOrderStatusRequest(OrderStatus.CANCELLED)).status());
        assertNull(orders.getOrderById(order.id()).driverId());
        assertEquals(1, activity.findByOrderIdOrderByIdDesc(order.id()).stream().filter(event -> event.getType() == ActivityEvent.Type.ORDER_CANCELLED).count());
        assertThrows(ResponseStatusException.class, () -> orders.updateStatus(order.id(), new UpdateOrderStatusRequest(OrderStatus.IN_TRANSIT)));
        assertThrows(ResponseStatusException.class, () -> orders.updateOrder(order.id(), new UpdateOrderRequest("Changed", "Pickup", "Delivery", null, null)));
        Long driver = driver(); assertThrows(ResponseStatusException.class, () -> orders.assignDriver(order.id(), new AssignDriverRequest(driver)));
    }

    @Test void cancellationReleasesCapacityExactlyOnceAndPreservesOfflineStatus() {
        for (OrderStatus status : new OrderStatus[]{OrderStatus.PENDING, OrderStatus.IN_TRANSIT, OrderStatus.DELAYED}) {
            var order = order(); Long driver = driver(); orders.assignDriver(order.id(), new AssignDriverRequest(driver));
            if (status != OrderStatus.PENDING) orders.updateStatus(order.id(), new UpdateOrderStatusRequest(OrderStatus.IN_TRANSIT));
            if (status == OrderStatus.DELAYED) orders.updateStatus(order.id(), new UpdateOrderStatusRequest(OrderStatus.DELAYED));
            if (status == OrderStatus.DELAYED) { var offline = driverRepository.findById(driver).orElseThrow(); offline.setStatus(DriverStatus.OFFLINE); driverRepository.saveAndFlush(offline); }
            orders.updateStatus(order.id(), new UpdateOrderStatusRequest(OrderStatus.CANCELLED));
            orders.updateStatus(order.id(), new UpdateOrderStatusRequest(OrderStatus.CANCELLED));
            repository.flush(); driverRepository.flush(); em.clear();
            assertEquals(1, drivers.getDriverById(driver).availableSpaces());
            assertEquals(status == OrderStatus.DELAYED ? DriverStatus.OFFLINE : DriverStatus.AVAILABLE, drivers.getDriverById(driver).status());
            assertEquals(driver, orders.getOrderById(order.id()).driverId());
        }
    }

    @Test void deliveredOrdersCannotBeCancelledAndInconsistentCapacityCannotCloseAnOrder() {
        var order = order(); Long driver = driver(); orders.assignDriver(order.id(), new AssignDriverRequest(driver));
        orders.updateStatus(order.id(), new UpdateOrderStatusRequest(OrderStatus.IN_TRANSIT));
        orders.updateStatus(order.id(), new UpdateOrderStatusRequest(OrderStatus.DELIVERED));
        assertThrows(ResponseStatusException.class, () -> orders.updateStatus(order.id(), new UpdateOrderStatusRequest(OrderStatus.CANCELLED)));
        assertEquals(1, drivers.getDriverById(driver).availableSpaces());
        var another = order(); orders.assignDriver(another.id(), new AssignDriverRequest(driver));
        var inconsistent = driverRepository.findById(driver).orElseThrow(); inconsistent.setAvailableSpaces(1); driverRepository.saveAndFlush(inconsistent);
        assertThrows(ResponseStatusException.class, () -> orders.updateStatus(another.id(), new UpdateOrderStatusRequest(OrderStatus.CANCELLED)));
        assertEquals(OrderStatus.PENDING, orders.getOrderById(another.id()).status());
        assertEquals(0, activity.findByOrderIdOrderByIdDesc(another.id()).stream().filter(event -> event.getType() == ActivityEvent.Type.ORDER_CANCELLED).count());
    }
}
