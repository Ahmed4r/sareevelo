package com.sareevelo.sareevelo_backend.security;
import org.springframework.web.bind.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.ResponseEntity;
import java.util.Map;
@RestController
public class HealthController {
 private final JdbcTemplate jdbc;
 public HealthController(JdbcTemplate jdbc) { this.jdbc=jdbc; }
 @GetMapping("/api/v1/health") public ResponseEntity<Map<String,String>> health() {
  try { jdbc.queryForObject("select 1", Integer.class); return ResponseEntity.ok(Map.of("status","UP")); }
  catch(RuntimeException exception) { return ResponseEntity.status(503).body(Map.of("status","DOWN")); }
 }
}
