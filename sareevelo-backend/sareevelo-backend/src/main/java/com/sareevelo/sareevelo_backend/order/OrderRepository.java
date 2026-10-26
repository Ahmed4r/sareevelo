package com.sareevelo.sareevelo_backend.order;

import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<Order, Long> {
    boolean existsByTrackingNumber(String trackingNumber);
}
