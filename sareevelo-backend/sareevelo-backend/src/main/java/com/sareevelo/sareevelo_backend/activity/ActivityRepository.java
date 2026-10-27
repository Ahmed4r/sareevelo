package com.sareevelo.sareevelo_backend.activity;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ActivityRepository extends JpaRepository<ActivityEvent, Long> {
    List<ActivityEvent> findByOrderIdOrderByIdDesc(Long orderId);
    void deleteByOrderId(Long orderId);
}
