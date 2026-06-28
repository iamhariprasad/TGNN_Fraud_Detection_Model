package com.fraud.dto;

import com.fraud.model.FraudAlert;
import lombok.*;
import java.time.LocalDateTime;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AlertDto {
    private Long id;
    private Long transactionId;
    private FraudAlert.AlertType alertType;
    private FraudAlert.Severity severity;
    private String description;
    private FraudAlert.AlertStatus status;
    private Long assignedTo;
    private LocalDateTime resolvedAt;
    private LocalDateTime createdAt;
    public static AlertDto fromEntity(FraudAlert a) {
        return AlertDto.builder().id(a.getId()).transactionId(a.getTransaction().getId()).alertType(a.getAlertType())
            .severity(a.getSeverity()).description(a.getDescription()).status(a.getStatus())
            .assignedTo(a.getAssignedTo() != null ? a.getAssignedTo().getId() : null)
            .resolvedAt(a.getResolvedAt()).createdAt(a.getCreatedAt()).build();
    }
}
