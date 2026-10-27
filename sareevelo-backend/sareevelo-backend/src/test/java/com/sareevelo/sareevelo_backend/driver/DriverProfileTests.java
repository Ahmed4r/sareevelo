package com.sareevelo.sareevelo_backend.driver;

import com.sareevelo.sareevelo_backend.order.OrderExceptionHandler;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@Transactional
class DriverProfileTests {
    @Autowired DriverController controller;
    @Autowired DriverRepository drivers;
    @Autowired EntityManager entityManager;
    private MockMvc mvc;
    @BeforeEach void setup() { mvc = MockMvcBuilders.standaloneSetup(controller).setControllerAdvice(new OrderExceptionHandler()).build(); }

    @Test void createsNormalizesPersistsAndReadsAllProfileFields() throws Exception {
        String code = "PROFILE-" + UUID.randomUUID();
        mvc.perform(post("/api/v1/drivers").contentType(MediaType.APPLICATION_JSON).content("""
            {"name":" Alex Driver ","employeeCode":"%s","capacity":3,"mobileNumber":" +49 (151) 234-56789 ",
            "email":" alex@example.com ","vehicleType":"VAN","vehicleRegistration":" AB 123 ","notes":" Call before pickup "}
            """.formatted(code))).andExpect(status().isCreated()).andExpect(jsonPath("$.mobileNumber").value("+4915123456789"));
        drivers.flush(); entityManager.clear();
        Driver driver = drivers.findAll().stream().filter(item -> item.getEmployeeCode().equals(code)).findFirst().orElseThrow();
        assertEquals("alex@example.com", driver.getEmail()); assertEquals("Call before pickup", driver.getNotes());
        mvc.perform(get("/api/v1/drivers/{id}", driver.getId())).andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Alex Driver")).andExpect(jsonPath("$.vehicleType").value("VAN"))
            .andExpect(jsonPath("$.vehicleRegistration").value("AB 123")).andExpect(jsonPath("$.availableSpaces").value(3));
        mvc.perform(get("/api/v1/drivers")).andExpect(jsonPath("$[*].email", hasItem("alex@example.com")));
    }

    @Test void validatesRequiredMobileEmailAndLimitsBeforePersistence() throws Exception {
        long count = drivers.count();
        mvc.perform(post("/api/v1/drivers").contentType(MediaType.APPLICATION_JSON).content("""
            {"name":"Alex","employeeCode":"INVALID-PROFILE","capacity":2}
            """)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.mobileNumber").exists());
        mvc.perform(post("/api/v1/drivers").contentType(MediaType.APPLICATION_JSON).content("""
            {"name":"Alex","employeeCode":"INVALID-PROFILE","capacity":2,"mobileNumber":"call-me","email":"broken",
             "vehicleType":"BOAT","vehicleRegistration":"%s","notes":"%s"}
            """.formatted("X".repeat(33), "X".repeat(1001)))).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.fieldErrors.mobileNumber").exists()).andExpect(jsonPath("$.fieldErrors.email").exists())
            .andExpect(jsonPath("$.fieldErrors.vehicleType").exists()).andExpect(jsonPath("$.fieldErrors.vehicleRegistration").exists())
            .andExpect(jsonPath("$.fieldErrors.notes").exists());
        assertEquals(count, drivers.count());
    }

    @Test void legacyDriversCanBeUpdatedWithoutChangingOperationalStateAndFieldsCanBeCleared() throws Exception {
        Driver old = new Driver(); old.setName("Legacy driver"); old.setEmployeeCode("PROFILE-" + UUID.randomUUID());
        old.setCapacity(5); old.setAvailableSpaces(2); old.setStatus(DriverStatus.ON_DELIVERY);
        Long id = drivers.saveAndFlush(old).getId(); String code = old.getEmployeeCode(); entityManager.clear();
        mvc.perform(get("/api/v1/drivers/{id}", id)).andExpect(status().isOk()).andExpect(jsonPath("$.mobileNumber").value(nullValue()));
        mvc.perform(put("/api/v1/drivers/{id}/profile", id).contentType(MediaType.APPLICATION_JSON).content("""
            {"name":"Updated driver","mobileNumber":"+49 151 23456789","email":"new@example.com","vehicleType":"CAR",
             "vehicleRegistration":"AB-123","notes":"Updated note","capacity":999,"availableSpaces":999,"status":"OFFLINE"}
            """)).andExpect(status().isOk()).andExpect(jsonPath("$.capacity").value(5))
            .andExpect(jsonPath("$.availableSpaces").value(2)).andExpect(jsonPath("$.status").value("ON_DELIVERY"))
            .andExpect(jsonPath("$.employeeCode").value(code));
        drivers.flush(); entityManager.clear();
        assertEquals("+4915123456789", drivers.findById(id).orElseThrow().getMobileNumber());
        mvc.perform(put("/api/v1/drivers/{id}/profile", id).contentType(MediaType.APPLICATION_JSON).content("""
            {"name":"Updated driver","mobileNumber":null,"email":"  ","vehicleType":null,"vehicleRegistration":"","notes":""}
            """)).andExpect(status().isOk()).andExpect(jsonPath("$.email").value(nullValue())).andExpect(jsonPath("$.notes").value(nullValue()));
        drivers.flush(); entityManager.clear(); assertNull(drivers.findById(id).orElseThrow().getEmail());
    }

    @Test void invalidUpdateLeavesExistingProfileIntactAndMissingDriverReturns404() throws Exception {
        Driver driver = new Driver(); driver.setName("Existing"); driver.setEmployeeCode("PROFILE-" + UUID.randomUUID());
        Long id = drivers.saveAndFlush(driver).getId();
        mvc.perform(put("/api/v1/drivers/{id}/profile", id).contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Changed\",\"mobileNumber\":\"123\",\"email\":\"broken\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.email").exists());
        entityManager.clear(); assertEquals("Existing", drivers.findById(id).orElseThrow().getName());
        mvc.perform(put("/api/v1/drivers/-1/profile").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Missing\"}"))
            .andExpect(status().isNotFound());
    }
}
