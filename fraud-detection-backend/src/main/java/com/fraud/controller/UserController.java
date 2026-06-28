package com.fraud.controller;

import com.fraud.dto.UserDto;
import com.fraud.exception.ResourceNotFoundException;
import com.fraud.model.User;
import com.fraud.repository.UserRepository;
import com.fraud.util.ResponseUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getAll() {
        return ResponseUtil.success(userRepository.findAll().stream().map(UserDto::fromEntity).collect(Collectors.toList()));
    }
    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getById(@PathVariable Long id) {
        User user = userRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return ResponseUtil.success(UserDto.fromEntity(user));
    }
}
