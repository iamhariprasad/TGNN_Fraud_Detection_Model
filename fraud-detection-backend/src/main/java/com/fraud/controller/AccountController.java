package com.fraud.controller;

import com.fraud.dto.AccountDto;
import com.fraud.model.Account;
import com.fraud.service.AccountService;
import com.fraud.util.ResponseUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/accounts")
@RequiredArgsConstructor
public class AccountController {
    private final AccountService accountService;

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(@Valid @RequestBody AccountDto dto) {
        return ResponseUtil.success(accountService.create(dto));
    }
    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getById(@PathVariable Long id) {
        return ResponseUtil.success(accountService.getById(id));
    }
    @GetMapping("/user/{userId}")
    public ResponseEntity<Map<String, Object>> getByUser(@PathVariable Long userId) {
        return ResponseUtil.success(accountService.getByUser(userId));
    }
    @PutMapping("/{id}/status")
    public ResponseEntity<Map<String, Object>> updateStatus(@PathVariable Long id, @RequestParam Account.AccountStatus status) {
        return ResponseUtil.success(accountService.updateStatus(id, status));
    }
}
