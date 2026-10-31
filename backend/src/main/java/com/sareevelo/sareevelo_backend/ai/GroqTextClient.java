package com.sareevelo.sareevelo_backend.ai;

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import java.util.*;

@Service
public class GroqTextClient {
    private final String key;
    private final String model;
    private final RestClient client;
    public GroqTextClient(@Value("${dispatch.ai.api-key:${GROQ_API_KEY:}}") String key,
                          @Value("${dispatch.ai.model:${GROQ_MODEL:openai/gpt-oss-20b}}") String model,
                          @Value("${dispatch.ai.base-url:https://api.groq.com/openai/v1}") String baseUrl) {
        this.key = key; this.model = model;
        var factory = new SimpleClientHttpRequestFactory(); factory.setConnectTimeout(2000); factory.setReadTimeout(12000);
        client = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
    }
    public Optional<String> generate(String instruction, String facts) {
        if (key.isBlank() || model.isBlank()) return Optional.empty();
        try {
            var response = client.post().uri("/chat/completions").header("Authorization", "Bearer " + key)
                    .contentType(MediaType.APPLICATION_JSON).body(Map.of("model", model, "max_completion_tokens", 1600,
                            "messages", List.of(Map.of("role", "system", "content", instruction), Map.of("role", "user", "content", facts))))
                    .retrieve().body(Map.class);
            if (response == null || !(response.get("choices") instanceof List<?> choices) || choices.isEmpty()
                    || !(choices.get(0) instanceof Map<?, ?> choice) || !"stop".equals(choice.get("finish_reason"))
                    || !(choice.get("message") instanceof Map<?, ?> message) || !(message.get("content") instanceof String content)
                    || content.isBlank() || content.length() > 9000) return Optional.empty();
            return Optional.of(content.trim());
        } catch (RuntimeException exception) { return Optional.empty(); }
    }
}
