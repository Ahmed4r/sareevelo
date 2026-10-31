package com.sareevelo.sareevelo_backend.order;

import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<Order, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select o from Order o where o.id = :id")
    java.util.Optional<Order> findForAssignment(@org.springframework.data.repository.query.Param("id") Long id);
    boolean existsByTrackingNumber(String trackingNumber);
}
