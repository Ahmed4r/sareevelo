package com.sareevelo.sareevelo_backend.ai;

import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/ai")
public class LogisticsAiController {
    private final LogisticsAiService service;
    public LogisticsAiController(LogisticsAiService service) { this.service = service; }
    @GetMapping("/tools") public List<LogisticsAiService.Tool> tools() { return LogisticsAiService.TOOLS; }
    @PostMapping("/run") public LogisticsAiService.Result run(@RequestBody LogisticsAiService.Request request) { return service.run(request); }
}
