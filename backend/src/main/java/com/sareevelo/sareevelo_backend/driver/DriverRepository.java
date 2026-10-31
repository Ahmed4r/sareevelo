package com.sareevelo.sareevelo_backend.driver;


import org.springframework.data.jpa.repository.JpaRepository;

public interface DriverRepository
        extends JpaRepository<Driver, Long> {
    boolean existsByEmployeeCode(String employeeCode);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select d from Driver d where d.id = :id")
    java.util.Optional<Driver> findForAssignment(@org.springframework.data.repository.query.Param("id") Long id);
}

