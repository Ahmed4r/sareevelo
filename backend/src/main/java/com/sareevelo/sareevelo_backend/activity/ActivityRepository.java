package com.sareevelo.sareevelo_backend.activity;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ActivityRepository extends JpaRepository<ActivityEvent, Long> {
    // Assignment is currently immutable: completion and cancellation retain the assigned driver ID.
    // Do not infer identity from the human-readable activity message or filter by current order status.
    @org.springframework.data.jpa.repository.Query("""
            select o.driverId as driverId,
                   sum(case when e.timestamp >= :dayStart then 1L else 0L end) as assignmentsToday,
                   max(e.timestamp) as lastAssignedAt
            from ActivityEvent e join Order o on o.id = e.orderId
            where e.type = :eventType and o.driverId is not null and e.timestamp <= :asOf
            group by o.driverId
            """)
    List<DriverAssignmentHistory> assignmentHistory(
            @org.springframework.data.repository.query.Param("eventType") ActivityEvent.Type eventType,
            @org.springframework.data.repository.query.Param("dayStart") java.time.Instant dayStart,
            @org.springframework.data.repository.query.Param("asOf") java.time.Instant asOf);
    List<ActivityEvent> findByOrderIdOrderByIdDesc(Long orderId);
    void deleteByOrderId(Long orderId);
}
