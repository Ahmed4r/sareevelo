package com.sareevelo.sareevelo_backend.order;

import com.sareevelo.sareevelo_backend.order.dto.*;
import com.sareevelo.sareevelo_backend.driver.*;
import com.sareevelo.sareevelo_backend.driver.dto.CreateDriverRequest;
import com.sareevelo.sareevelo_backend.activity.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@Transactional
class DeliveryLifecycleTests {
    @Autowired OrderController controller;
    @Autowired OrderService orders;
    @Autowired DriverService drivers;
    @Autowired DriverRepository driverRepository;
    @Autowired ActivityRepository activity;
    MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.standaloneSetup(controller).setControllerAdvice(new OrderExceptionHandler()).build();
    }
    Long order() {
        return orders.createOrder(new CreateOrderRequest("TEST-" + UUID.randomUUID(), "Lifecycle test", "Pickup", "Delivery")).id();
    }
    Long driver() {
        return drivers.createDriver(new CreateDriverRequest("Lifecycle driver", "TEST-" + UUID.randomUUID(), 2, "+4915123456789", null, null, null, null)).id();
    }
    void change(Long id, String status) throws Exception {
        mvc.perform(patch("/api/v1/orders/{id}/status", id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"" + status + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value(status));
    }

    @Test void fullLifecyclePersistsHistoryAndCompletionIsIdempotent() throws Exception {
        Long id = order(), driverId = driver();
        orders.assignDriver(id, new AssignDriverRequest(driverId));
        change(id, "IN_TRANSIT"); change(id, "IN_TRANSIT");
        change(id, "DELAYED"); change(id, "IN_TRANSIT"); change(id, "DELIVERED"); change(id, "DELIVERED");
        assertEquals(2, drivers.getDriverById(driverId).availableSpaces());
        assertEquals(DriverStatus.AVAILABLE, drivers.getDriverById(driverId).status());
        assertEquals(driverId, orders.getOrderById(id).driverId());
        mvc.perform(get("/api/v1/orders/{id}/activity", id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(6))
                .andExpect(jsonPath("$[0].type").value("DELIVERY_COMPLETED"))
                .andExpect(jsonPath("$[0].timestamp").isString())
                .andExpect(jsonPath("$[0].orderId").value(id))
                .andExpect(jsonPath("$[5].type").value("ORDER_CREATED"));
        mvc.perform(patch("/api/v1/orders/{id}/status", id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"IN_TRANSIT\"}")).andExpect(status().isConflict());
        assertEquals(6, activity.findByOrderIdOrderByIdDesc(id).size());
    }

    @Test void invalidTransitionsAndUnassignedStartsDoNotChangeCapacityOrHistory() throws Exception {
        Long id = order();
        for (String target : new String[]{"IN_TRANSIT", "DELAYED", "DELIVERED"}) {
            mvc.perform(patch("/api/v1/orders/{id}/status", id).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"status\":\"" + target + "\"}")).andExpect(status().isConflict());
        }
        assertEquals(OrderStatus.PENDING, orders.getOrderById(id).status());
        assertEquals(1, activity.findByOrderIdOrderByIdDesc(id).size());
    }

    @Test void delayedCompletionReleasesOneSpaceAndRetainsOtherWork() throws Exception {
        Long first = order(), second = order(), driverId = driver();
        orders.assignDriver(first, new AssignDriverRequest(driverId));
        orders.assignDriver(second, new AssignDriverRequest(driverId));
        change(first, "IN_TRANSIT"); change(first, "DELAYED"); change(first, "DELIVERED");
        assertEquals(1, drivers.getDriverById(driverId).availableSpaces());
        assertEquals(DriverStatus.ON_DELIVERY, drivers.getDriverById(driverId).status());
        change(second, "IN_TRANSIT");
        Driver driver = driverRepository.findById(driverId).orElseThrow();
        driver.setStatus(DriverStatus.OFFLINE); driverRepository.flush();
        change(second, "DELIVERED");
        assertEquals(2, drivers.getDriverById(driverId).availableSpaces());
        assertEquals(DriverStatus.OFFLINE, drivers.getDriverById(driverId).status());
    }

    @Test void offlineDriverCannotStartAndStatusRequestIsValidated() throws Exception {
        Long id = order(), driverId = driver();
        orders.assignDriver(id, new AssignDriverRequest(driverId));
        driverRepository.findById(driverId).orElseThrow().setStatus(DriverStatus.OFFLINE);
        driverRepository.flush();
        mvc.perform(patch("/api/v1/orders/{id}/status", id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"IN_TRANSIT\"}")).andExpect(status().isConflict());
        for (String body : new String[]{"{}", "{\"status\":null}", "{\"status\":\"INVALID\"}"}) {
            mvc.perform(patch("/api/v1/orders/{id}/status", id).contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(patch("/api/v1/orders/-1/status").contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"DELIVERED\"}")).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/orders/-1/activity")).andExpect(status().isNotFound());
    }
}
