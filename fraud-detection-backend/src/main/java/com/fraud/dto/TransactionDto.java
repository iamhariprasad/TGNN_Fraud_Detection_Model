package com.fraud.dto;

import com.fraud.model.Transaction;
import jakarta.validation.constraints.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TransactionDto {
    private Long id;
    @NotNull private Long senderId;
    @NotNull private Long receiverId;
    @NotNull @Positive private BigDecimal amount;
    private String currency;
    private String description;
    private Transaction.TransactionStatus status;
    private Boolean isFraud;
    private Double fraudScore;
    private Transaction.RiskLevel riskLevel;
    private LocalDateTime createdAt;
    public static TransactionDto fromEntity(Transaction t) {
        return TransactionDto.builder().id(t.getId()).senderId(t.getSender().getId()).receiverId(t.getReceiver().getId())
            .amount(t.getAmount()).currency(t.getCurrency()).description(t.getDescription()).status(t.getStatus())
            .isFraud(t.getIsFraud()).fraudScore(t.getFraudScore()).riskLevel(t.getRiskLevel()).createdAt(t.getCreatedAt()).build();
    }
}
