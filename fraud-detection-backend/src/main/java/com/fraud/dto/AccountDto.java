package com.fraud.dto;

import com.fraud.model.Account;
import jakarta.validation.constraints.*;
import lombok.*;
import java.math.BigDecimal;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AccountDto {
    private Long id;
    @NotNull private Long userId;
    private String accountNumber;
    private Account.AccountType accountType;
    private BigDecimal balance;
    private Account.AccountStatus status;
    public static AccountDto fromEntity(Account a) {
        return AccountDto.builder().id(a.getId()).userId(a.getUser().getId()).accountNumber(a.getAccountNumber())
            .accountType(a.getAccountType()).balance(a.getBalance()).status(a.getStatus()).build();
    }
}
