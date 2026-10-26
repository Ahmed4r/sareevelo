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
    private MockMvc mvc;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.standaloneSetup(controller)
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
                .andExpect(jsonPath("$.fieldErrors.trackingNumber").exists())
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
}
