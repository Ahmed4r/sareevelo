package com.sareevelo.sareevelo_backend.driver;

import com.sareevelo.sareevelo_backend.driver.dto.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/drivers")
public class DriverController {

    private final DriverService driverService;

    public DriverController(DriverService driverService) {
        this.driverService = driverService;
    }

    @GetMapping
    public List<DriverResponse> getAllDrivers() {
        return driverService.getAllDrivers();
    }

    @GetMapping("/{id}")
    public DriverResponse getDriverById(@PathVariable Long id) {
        return driverService.getDriverById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DriverResponse createDriver(
            @Valid @RequestBody CreateDriverRequest request) {
        return driverService.createDriver(request);
    }

    @PutMapping("/{id}/profile")
    public DriverResponse updateProfile(@PathVariable Long id, @Valid @RequestBody DriverProfileRequest request) {
        return driverService.updateProfile(id, request);
    }
}

