package com.fraud.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "fraud_alerts")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FraudAlert {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transaction_id", nullable = false)
    private Transaction transaction;
    @Enumerated(EnumType.STRING) @Builder.Default
    private AlertType alertType = AlertType.MODEL;
    @Enumerated(EnumType.STRING) @Builder.Default
    private Severity severity = Severity.MEDIUM;
    @Column(columnDefinition = "TEXT")
    private String description;
    @Enumerated(EnumType.STRING) @Builder.Default
    private AlertStatus status = AlertStatus.NEW;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_to")
    private User assignedTo;
    private LocalDateTime resolvedAt;
    @CreationTimestamp @Column(updatable = false)
    private LocalDateTime createdAt;
    public enum AlertType { MODEL, RULE, MANUAL }
    public enum Severity { LOW, MEDIUM, HIGH, CRITICAL }
    public enum AlertStatus { NEW, INVESTIGATING, RESOLVED, FALSE_ALARM }
}
