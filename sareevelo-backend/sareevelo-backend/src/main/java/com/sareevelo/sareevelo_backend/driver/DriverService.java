package com.sareevelo.sareevelo_backend.driver;


import com.sareevelo.sareevelo_backend.driver.dto.*;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.List;

@Service
public class DriverService {

    private final DriverRepository driverRepository;

    public DriverService(DriverRepository driverRepository) {
        this.driverRepository = driverRepository;
    }

    public List<DriverResponse> getAllDrivers() {
        return driverRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public DriverResponse getDriverById(Long id) {
        Driver driver = driverRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Driver not found"
                ));

        return toResponse(driver);
    }

    public DriverResponse createDriver(CreateDriverRequest request) {
        if (driverRepository.existsByEmployeeCode(request.employeeCode().trim())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This employee code is already in use. Choose another.");
        }
        Driver driver = new Driver();

        driver.setName(request.name().trim());
        driver.setEmployeeCode(request.employeeCode().trim());
        driver.setCapacity(request.capacity());
        driver.setAvailableSpaces(request.capacity());
        driver.setStatus(DriverStatus.AVAILABLE);
        applyProfile(driver, new DriverProfileRequest(request.name(), request.mobileNumber(), request.email(), request.vehicleType(), request.vehicleRegistration(), request.notes()));

        Driver saved = driverRepository.save(driver);
        return toResponse(saved);
    }

    @org.springframework.transaction.annotation.Transactional
    public DriverResponse updateProfile(Long id, DriverProfileRequest request) {
        // Shares the assignment lock, so profile writes cannot overwrite capacity changes.
        Driver driver = driverRepository.findForAssignment(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Driver not found"));
        applyProfile(driver, request);
        return toResponse(driverRepository.save(driver));
    }

    private void applyProfile(Driver driver, DriverProfileRequest request) {
        driver.setName(request.name()); driver.setMobileNumber(request.mobileNumber()); driver.setEmail(request.email());
        driver.setVehicleType(request.vehicleType()); driver.setVehicleRegistration(request.vehicleRegistration()); driver.setNotes(request.notes());
    }

    private DriverResponse toResponse(Driver driver) {
        return new DriverResponse(
                driver.getId(),
                driver.getName(),
                driver.getEmployeeCode(),
                driver.getStatus(),
                driver.getCapacity(),
                driver.getAvailableSpaces(),
                driver.getMobileNumber(), driver.getEmail(), driver.getVehicleType(), driver.getVehicleRegistration(), driver.getNotes()
        );
    }
}
