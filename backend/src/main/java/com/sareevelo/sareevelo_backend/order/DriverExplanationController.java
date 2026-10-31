package com.sareevelo.sareevelo_backend.order;

import org.springframework.web.bind.annotation.*;
import java.util.List;
import com.sareevelo.sareevelo_backend.order.dto.DriverSuggestion;

@RestController
@RequestMapping("/api/v1/orders")
public class DriverExplanationController {
    private final OrderService orders;
    private final DriverExplanationService explanations;
    public DriverExplanationController(OrderService orders, DriverExplanationService explanations) {
        this.orders = orders;
        this.explanations = explanations;
    }
    public record ExplainedSuggestions(List<DriverSuggestion> suggestions, DriverExplanationService.Explanation explanation) {}

    @PostMapping("/{id}/driver-suggestions/explain")
    public ExplainedSuggestions explain(@PathVariable Long id) {
        var suggestions = orders.suggestDrivers(id);
        return new ExplainedSuggestions(suggestions, explanations.explain(suggestions));
    }
}
