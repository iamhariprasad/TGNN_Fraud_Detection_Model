package com.fraud.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "transactions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Transaction {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id", nullable = false)
    private Account sender;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "receiver_id", nullable = false)
    private Account receiver;
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;
    @Column(length = 3) @Builder.Default
    private String currency = "USD";
    @Column(length = 255)
    private String description;
    @Enumerated(EnumType.STRING) @Builder.Default
    private TransactionStatus status = TransactionStatus.PENDING;
    @Builder.Default
    private Boolean isFraud = false;
    @Builder.Default
    private Double fraudScore = 0.0;
    @Enumerated(EnumType.STRING) @Builder.Default
    private RiskLevel riskLevel = RiskLevel.LOW;
    @CreationTimestamp @Column(updatable = false)
    private LocalDateTime createdAt;
    @UpdateTimestamp
    private LocalDateTime updatedAt;
    public enum TransactionStatus { PENDING, COMPLETED, FAILED, FLAGGED }
    public enum RiskLevel { LOW, MEDIUM, HIGH, CRITICAL }
}
