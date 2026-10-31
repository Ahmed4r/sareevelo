package com.sareevelo.sareevelo_backend.germany;

import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Value;
import java.util.*;

@RestController
@RequestMapping("/api/v1/germany")
public class GermanyController {
    private final GermanyService service;
    private final AddressLookupService lookup;
    @Value("${dispatch.maps.tile-url:https://tile.openstreetmap.org/{z}/{x}/{y}.png}") private String tileUrl;
    @Value("${dispatch.maps.attribution:OpenStreetMap contributors}") private String attribution;
    public GermanyController(GermanyService service, AddressLookupService lookup) { this.service = service; this.lookup = lookup; }
    @GetMapping("/orders/{id}/lookup") public AddressLookupService.Lookup lookup(@PathVariable Long id) { return lookup.lookup(service.map(id)); }
    @GetMapping("/config") public Map<String, Object> config() { return Map.of("countryCode", "DE", "states", new TreeMap<>(GermanyService.STATES), "tileUrl", tileUrl, "attribution", attribution); }
    @GetMapping("/orders/{id}") public GermanyService.MapResult map(@PathVariable Long id) { return service.map(id); }
    @PutMapping("/orders/{id}") public GermanyService.MapResult saveMap(@PathVariable Long id, @RequestBody GermanyService.MapRequest request) { return service.saveMap(id, request); }
    @GetMapping("/drivers/{id}") public Set<String> coverage(@PathVariable Long id) { return service.coverage(id); }
    @PutMapping("/drivers/{id}") public Set<String> saveCoverage(@PathVariable Long id, @RequestBody Set<String> states) { return service.saveCoverage(id, states); }
}
