package com.sareevelo.sareevelo_backend.germany;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.Set;
public interface DriverCoverageRepository extends JpaRepository<DriverCoverage, Long> {
 @Query("select c.driverId from DriverCoverage c where :pickup member of c.states and :delivery member of c.states")
 Set<Long> coveringBoth(@Param("pickup") String pickup, @Param("delivery") String delivery);
}
