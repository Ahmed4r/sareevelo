package com.sareevelo.sareevelo_backend.order;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.hamcrest.Matchers.hasItem;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Uses the configured PostgreSQL database; each test rolls its writes back. */
@SpringBootTest
@Transactional
class OrderApiIntegrationTests {
    @Autowired OrderController controller;
    @Autowired OrderRepository repository;
    @Autowired com.sareevelo.sareevelo_backend.driver.DriverController driverController;
    @Autowired com.sareevelo.sareevelo_backend.driver.DriverRepository drivers;
    private MockMvc mvc;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.standaloneSetup(controller, driverController)
                .setControllerAdvice(new OrderExceptionHandler()).build();
    }

    private String request(String tracking) {
        return """
                {"trackingNumber":"%s","customerName":"Integration customer",
                 "pickupAddress":"Passau, Germany","deliveryAddress":"Munich, Germany"}
                """.formatted(tracking);
    }

    @Test
    void createPersistsAndCanBeReadByNumericIdAndListed() throws Exception {
        String tracking = "TEST-" + UUID.randomUUID();
        mvc.perform(post("/api/v1/orders").contentType(MediaType.APPLICATION_JSON).content(request(tracking)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.trackingNumber").value(tracking))
                .andExpect(jsonPath("$.status").value("PENDING"));
        Order saved = repository.findAll().stream().filter(o -> tracking.equals(o.getTrackingNumber())).findFirst().orElseThrow();
        assertTrue(saved.getId() > 0);
        mvc.perform(get("/api/v1/orders/{id}", saved.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customerName").value("Integration customer"))
                .andExpect(jsonPath("$.pickupAddress").value("Passau, Germany"))
                .andExpect(jsonPath("$.deliveryAddress").value("Munich, Germany"));
        mvc.perform(get("/api/v1/orders"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[*].trackingNumber", hasItem(tracking)));
    }

    @Test
    void duplicateTrackingNumberReturnsUsefulConflict() throws Exception {
        String tracking = "TEST-" + UUID.randomUUID();
        mvc.perform(post("/api/v1/orders").contentType(MediaType.APPLICATION_JSON).content(request(tracking)))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/v1/orders").contentType(MediaType.APPLICATION_JSON).content(request(" " + tracking + " ")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("This tracking number is already in use. Enter a different tracking number."));
    }

    @Test
    void requiredFieldsAreValidated() throws Exception {
        mvc.perform(post("/api/v1/orders").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors.trackingNumber").doesNotExist())
                .andExpect(jsonPath("$.fieldErrors.customerName").exists())
                .andExpect(jsonPath("$.fieldErrors.pickupAddress").exists())
                .andExpect(jsonPath("$.fieldErrors.deliveryAddress").exists());
    }

    @Test
    void lengthsAreValidatedBeforeDatabaseWrites() throws Exception {
        mvc.perform(post("/api/v1/orders").contentType(MediaType.APPLICATION_JSON).content(request("X".repeat(51))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.trackingNumber").exists());
    }

    @Test
    void missingOrderReturnsNotFound() throws Exception {
        mvc.perform(get("/api/v1/orders/-1")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ORDER_NOT_FOUND"));
    }

    @Test
    void malformedJsonReturnsBadRequest() throws Exception {
        mvc.perform(post("/api/v1/orders").contentType(MediaType.APPLICATION_JSON).content("{invalid"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void generatesDistinctPersistedTrackingNumbersForOmittedNullAndBlankInput() throws Exception {
        String customer = "AUTO-" + UUID.randomUUID();
        for (String field : java.util.List.of("", "\"trackingNumber\":null,", "\"trackingNumber\":\"   \",")) {
            mvc.perform(post("/api/v1/orders").contentType(MediaType.APPLICATION_JSON).content(
                    "{" + field + "\"customerName\":\"" + customer + "\",\"pickupAddress\":\"Passau\",\"deliveryAddress\":\"Munich\"}"))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.trackingNumber").value(org.hamcrest.Matchers.matchesPattern("SAR-[2-9A-HJ-NP-Z]{4}(-[2-9A-HJ-NP-Z]{4}){3}")));
        }
        repository.flush();
        var created = repository.findAll().stream().filter(order -> customer.equals(order.getCustomerName())).toList();
        org.junit.jupiter.api.Assertions.assertEquals(3, created.size());
        org.junit.jupiter.api.Assertions.assertEquals(3, created.stream().map(Order::getTrackingNumber).distinct().count());
        for (Order order : created) {
            mvc.perform(get("/api/v1/orders/{id}", order.getId()))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.trackingNumber").value(order.getTrackingNumber()));
        }
    }

    private com.sareevelo.sareevelo_backend.driver.Driver newDriver() {
        var driver = new com.sareevelo.sareevelo_backend.driver.Driver();
        driver.setName("Integration driver"); driver.setEmployeeCode("TEST-" + UUID.randomUUID());
        driver.setCapacity(2); driver.setAvailableSpaces(2);
        return drivers.saveAndFlush(driver);
    }

    private Order newOrder() {
        Order order = new Order(); order.setTrackingNumber("TEST-" + UUID.randomUUID());
        order.setCustomerName("Integration customer"); order.setPickupAddress("Passau"); order.setDeliveryAddress("Munich");
        return repository.saveAndFlush(order);
    }

    @Test
    void driverCreationRetrievalValidationAndDuplicateCode() throws Exception {
        String code = "TEST-" + UUID.randomUUID();
        String body = "{\"name\":\" Alex \",\"employeeCode\":\"%s\",\"capacity\":2,\"mobileNumber\":\"+4915123456789\"}".formatted(code);
        mvc.perform(post("/api/v1/drivers").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.name").value("Alex")).andExpect(jsonPath("$.availableSpaces").value(2));
        var driver = drivers.findAll().stream().filter(d -> code.equals(d.getEmployeeCode())).findFirst().orElseThrow();
        mvc.perform(get("/api/v1/drivers/{id}", driver.getId())).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("AVAILABLE"));
        mvc.perform(get("/api/v1/drivers")).andExpect(status().isOk())
                .andExpect(jsonPath("$[*].employeeCode", hasItem(code)));
        mvc.perform(post("/api/v1/drivers").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.message").exists());
        mvc.perform(post("/api/v1/drivers").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\",\"employeeCode\":\"\",\"capacity\":0}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.capacity").exists());
        mvc.perform(get("/api/v1/drivers/-1")).andExpect(status().isNotFound());
    }

    @Test
    void assignmentReturnsDriverIdAndConsumesCapacityOnlyOnce() throws Exception {
        var driver = newDriver(); var order = newOrder();
        String body = "{\"driverId\":%d}".formatted(driver.getId());
        mvc.perform(post("/api/v1/orders/{id}/assign", order.getId()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.driverId").value(driver.getId()));
        repository.flush(); drivers.flush();
        mvc.perform(get("/api/v1/orders/{id}", order.getId())).andExpect(jsonPath("$.driverId").value(driver.getId()));
        mvc.perform(get("/api/v1/drivers/{id}", driver.getId()))
                .andExpect(jsonPath("$.availableSpaces").value(1)).andExpect(jsonPath("$.status").value("ON_DELIVERY"));
        mvc.perform(post("/api/v1/orders/{id}/assign", order.getId()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict());
        mvc.perform(get("/api/v1/drivers/{id}", driver.getId())).andExpect(jsonPath("$.availableSpaces").value(1));
        var second = newOrder();
        mvc.perform(post("/api/v1/orders/{id}/assign", second.getId()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
        var third = newOrder();
        mvc.perform(post("/api/v1/orders/{id}/assign", third.getId()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict());
        mvc.perform(get("/api/v1/drivers/{id}", driver.getId())).andExpect(jsonPath("$.availableSpaces").value(0));
    }

    @Test
    void assignmentRejectsMissingOfflineAndNonPendingResources() throws Exception {
        var driver = newDriver(); var order = newOrder();
        String body = "{\"driverId\":%d}".formatted(driver.getId());
        mvc.perform(post("/api/v1/orders/-1/assign").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/orders/{id}/assign", order.getId()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"driverId\":-1}")).andExpect(status().isNotFound());
        driver.setStatus(com.sareevelo.sareevelo_backend.driver.DriverStatus.OFFLINE); drivers.flush();
        mvc.perform(post("/api/v1/orders/{id}/assign", order.getId()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isConflict());
        driver.setStatus(com.sareevelo.sareevelo_backend.driver.DriverStatus.AVAILABLE); order.setStatus(OrderStatus.DELIVERED);
        drivers.flush(); repository.flush();
        mvc.perform(post("/api/v1/orders/{id}/assign", order.getId()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isConflict());
    }
}
