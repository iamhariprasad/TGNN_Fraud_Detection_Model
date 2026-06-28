package com.fraud.controller;

import com.fraud.model.FraudAlert;
import com.fraud.service.AlertService;
import com.fraud.util.ResponseUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/alerts")
@RequiredArgsConstructor
public class AlertController {
    private final AlertService alertService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getAll() {
        return ResponseUtil.success(alertService.getAll());
    }
    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getById(@PathVariable Long id) {
        return ResponseUtil.success(alertService.getById(id));
    }
    @GetMapping("/status/{status}")
    public ResponseEntity<Map<String, Object>> getByStatus(@PathVariable FraudAlert.AlertStatus status,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return ResponseUtil.success(alertService.getByStatusPaged(status, PageRequest.of(page, size)));
    }
    @PutMapping("/{id}/status")
    public ResponseEntity<Map<String, Object>> updateStatus(@PathVariable Long id, @RequestParam FraudAlert.AlertStatus status) {
        return ResponseUtil.success(alertService.updateStatus(id, status));
    }
    @GetMapping("/count/{status}")
    public ResponseEntity<Map<String, Object>> count(@PathVariable FraudAlert.AlertStatus status) {
        return ResponseUtil.success(alertService.countByStatus(status));
    }
}
