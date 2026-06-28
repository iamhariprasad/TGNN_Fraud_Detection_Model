package com.fraud.service;

import com.fraud.dto.AlertDto;
import com.fraud.exception.ResourceNotFoundException;
import com.fraud.model.FraudAlert;
import com.fraud.repository.AlertRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AlertService {
    private final AlertRepository alertRepository;

    @Transactional(readOnly = true)
    public List<AlertDto> getAll() {
        return alertRepository.findAll().stream().map(AlertDto::fromEntity).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public AlertDto getById(Long id) {
        return AlertDto.fromEntity(alertRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Alert not found")));
    }

    @Transactional(readOnly = true)
    public List<AlertDto> getByStatus(FraudAlert.AlertStatus status) {
        return alertRepository.findByStatus(status).stream().map(AlertDto::fromEntity).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Page<AlertDto> getByStatusPaged(FraudAlert.AlertStatus status, Pageable pageable) {
        return alertRepository.findByStatusOrderByCreatedAtDesc(status, pageable).map(AlertDto::fromEntity);
    }

    @Transactional
    public AlertDto updateStatus(Long id, FraudAlert.AlertStatus status) {
        FraudAlert alert = alertRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Alert not found"));
        alert.setStatus(status);
        if (status == FraudAlert.AlertStatus.RESOLVED || status == FraudAlert.AlertStatus.FALSE_ALARM)
            alert.setResolvedAt(LocalDateTime.now());
        return AlertDto.fromEntity(alertRepository.save(alert));
    }

    @Transactional(readOnly = true)
    public Long countByStatus(FraudAlert.AlertStatus status) {
        return alertRepository.countByStatus(status);
    }
}
