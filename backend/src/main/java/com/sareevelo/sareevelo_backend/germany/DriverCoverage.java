package com.sareevelo.sareevelo_backend.germany;

import jakarta.persistence.*;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "driver_coverage")
public class DriverCoverage {
    @Id public Long driverId;
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "driver_coverage_states", joinColumns = @JoinColumn(name = "driver_id"), indexes = @Index(name = "idx_coverage_state_driver", columnList = "state_code,driver_id"))
    @Column(name = "state_code", nullable = false, length = 2)
    public Set<String> states = new HashSet<>();
    protected DriverCoverage() {}
}
