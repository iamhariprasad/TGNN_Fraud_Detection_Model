package com.fraud.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "accounts")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Account {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    @Column(nullable = false, unique = true, length = 20)
    private String accountNumber;
    @Enumerated(EnumType.STRING) @Builder.Default
    private AccountType accountType = AccountType.PERSONAL;
    @Column(precision = 15, scale = 2) @Builder.Default
    private BigDecimal balance = BigDecimal.ZERO;
    @Enumerated(EnumType.STRING) @Builder.Default
    private AccountStatus status = AccountStatus.ACTIVE;
    @CreationTimestamp @Column(updatable = false)
    private LocalDateTime createdAt;
    @UpdateTimestamp
    private LocalDateTime updatedAt;
    public enum AccountType { PERSONAL, BUSINESS, MERCHANT }
    public enum AccountStatus { ACTIVE, SUSPENDED, CLOSED }
}
