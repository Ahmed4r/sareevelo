
package com.sareevelo.sareevelo_backend.driver;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "drivers")
public class Driver {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(nullable = false, unique = true, length = 50)
    private String employeeCode;

    // Nullable columns preserve existing driver records during the profile rollout.
    @Column(length = 16)
    private String mobileNumber;
    @Column(length = 254)
    private String email;
    @Column(length = 20)
    private String vehicleType;
    @Column(length = 32)
    private String vehicleRegistration;
    @Column(length = 1000)
    private String notes;

    public String getMobileNumber() { return mobileNumber; }
    public void setMobileNumber(String value) { mobileNumber = value; }
    public String getEmail() { return email; }
    public void setEmail(String value) { email = value; }
    public String getVehicleType() { return vehicleType; }
    public void setVehicleType(String value) { vehicleType = value; }
    public String getVehicleRegistration() { return vehicleRegistration; }
    public void setVehicleRegistration(String value) { vehicleRegistration = value; }
    public String getNotes() { return notes; }
    public void setNotes(String value) { notes = value; }

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DriverStatus status = DriverStatus.AVAILABLE;

    @Column(nullable = false)
    private int capacity = 8;

    @Column(nullable = false)
    private int availableSpaces = 8;
   
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Driver() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmployeeCode() {
        return employeeCode;
    }

    public void setEmployeeCode(String employeeCode) {
        this.employeeCode = employeeCode;
    }

    public DriverStatus getStatus() {
        return status;
    }

    public void setStatus(DriverStatus status) {
        this.status = status;
    }

    public int getCapacity() {
        return capacity;
    }

    public void setCapacity(int capacity) {
        this.capacity = capacity;
    }

    public int getAvailableSpaces() {
        return availableSpaces;
    }

    public void setAvailableSpaces(int availableSpaces) {
        this.availableSpaces = availableSpaces;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    // Generate getters and setters
}
