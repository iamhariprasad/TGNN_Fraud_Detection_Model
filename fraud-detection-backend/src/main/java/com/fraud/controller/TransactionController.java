package com.fraud.controller;

import com.fraud.dto.TransactionDto;
import com.fraud.service.TransactionService;
import com.fraud.util.ResponseUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/transactions")
@RequiredArgsConstructor
public class TransactionController {
    private final TransactionService transactionService;

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(@Valid @RequestBody TransactionDto dto) {
        return ResponseUtil.success(transactionService.createTransaction(dto));
    }
    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getById(@PathVariable Long id) {
        return ResponseUtil.success(transactionService.getById(id));
    }
    @GetMapping
    public ResponseEntity<Map<String, Object>> getAll(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return ResponseUtil.success(transactionService.getAll(PageRequest.of(page, size)));
    }
    @GetMapping("/account/{accountId}")
    public ResponseEntity<Map<String, Object>> getByAccount(@PathVariable Long accountId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return ResponseUtil.success(transactionService.getByAccount(accountId, PageRequest.of(page, size)));
    }
    @GetMapping("/fraudulent")
    public ResponseEntity<Map<String, Object>> getFraudulent() {
        return ResponseUtil.success(transactionService.getFraudulent());
    }
    @GetMapping("/recent")
    public ResponseEntity<Map<String, Object>> getRecent() {
        return ResponseUtil.success(transactionService.getRecent());
    }
}
