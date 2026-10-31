package com.sareevelo.sareevelo_backend.order;

import com.sareevelo.sareevelo_backend.order.dto.DriverSuggestion;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import java.util.List;
import java.util.Map;

@Service
public class DriverExplanationService {
    public record Explanation(String source, String text) {}
    private final RestClient client;
    private final String key;
    private final String model;

    public DriverExplanationService(
            @Value("${dispatch.ai.api-key:${GROQ_API_KEY:}}") String key,
            @Value("${dispatch.ai.model:${GROQ_MODEL:openai/gpt-oss-20b}}") String model,
            @Value("${dispatch.ai.base-url:https://api.groq.com/openai/v1}") String baseUrl) {
        this.key = key;
        this.model = model;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(2000);
        factory.setReadTimeout(8000);
        this.client = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
    }

    public Explanation explain(List<DriverSuggestion> suggestions) {
        if (suggestions.isEmpty()) return new Explanation("RULES", "No eligible drivers currently have capacity.");
        if (key.isBlank() || model.isBlank()) return fallback("AI explanations are not configured.");
        // Only anonymous numeric facts leave the server; names, addresses and notes are never prompts.
        StringBuilder facts = new StringBuilder();
        for (int i = 0; i < suggestions.size(); i++) {
            DriverSuggestion item = suggestions.get(i);
            facts.append("Candidate ").append(i + 1).append(": active orders=").append(item.activeOrders())
                    .append(", free spaces=").append(item.availableSpaces()).append(", capacity=").append(item.capacity())
                    .append(", assignments today=").append(item.assignmentsToday())
                    .append(", last assigned=").append(item.lastAssignedAt() == null ? "none recorded" : item.lastAssignedAt())
                    .append('\n');
        }
        try {
            Map<?, ?> response = client.post().uri("/chat/completions")
                    .header("Authorization", "Bearer " + key).contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("model", model, "max_completion_tokens", 1024,
                            "messages", List.of(
                                    Map.of("role", "system", "content", "Explain the deciding factor for the first candidate over the second in at most two short sentences, not just the ranking formula. The supplied order is fixed: fewest active orders, then fewest assignments today, then oldest last-assigned timestamp with none recorded first; stable ID breaks an exact tie. Free spaces determine eligibility only. Counts are assignments, not completed deliveries, and include cancelled work. If none recorded, say no recorded assignments, never claim the driver has never worked. If all facts tie, explicitly say there is no workload/history advantage. If one candidate, say only eligible candidate. Refer to candidates only by their list position. Do not change the ranking, assign anyone, or claim location, route, ETA, schedule feasibility, skill or vehicle suitability. State that dispatchers must confirm. Use only supplied facts."),
                                    Map.of("role", "user", "content", facts.toString()))))
                    .retrieve().body(Map.class);
            if (response == null || !(response.get("choices") instanceof List<?> choices) || choices.isEmpty()
                    || !(choices.get(0) instanceof Map<?, ?> choice) || !"stop".equals(choice.get("finish_reason"))
                    || !(choice.get("message") instanceof Map<?, ?> message)
                    || !(message.get("content") instanceof String content)) return fallback("AI explanation unavailable.");
            String result = content.trim();
            if (result.isEmpty() || result.length() > 1200) return fallback("AI explanation unavailable.");
            return new Explanation("AI", result);
        } catch (RuntimeException exception) {
            // Provider errors must not prevent manual dispatch or expose credentials/provider payloads.
            return fallback("AI explanation unavailable.");
        }
    }

    private Explanation fallback(String message) {
        return new Explanation("RULES", message + " Suggestions prioritize fewer active orders, then fewer assignments today, then longest waiting since the last assignment. Confirm the driver before assigning.");
    }
}
