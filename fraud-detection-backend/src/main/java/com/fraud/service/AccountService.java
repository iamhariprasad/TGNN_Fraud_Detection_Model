package com.fraud.service;

import com.fraud.dto.AccountDto;
import com.fraud.exception.ResourceNotFoundException;
import com.fraud.model.Account;
import com.fraud.model.User;
import com.fraud.repository.AccountRepository;
import com.fraud.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AccountService {
    private final AccountRepository accountRepository;
    private final UserRepository userRepository;

    @Transactional
    public AccountDto create(AccountDto dto) {
        User user = userRepository.findById(dto.getUserId())
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Account account = Account.builder().user(user)
            .accountNumber("ACC" + System.currentTimeMillis() % 1000000000)
            .accountType(dto.getAccountType() != null ? dto.getAccountType() : Account.AccountType.PERSONAL)
            .status(Account.AccountStatus.ACTIVE).build();
        return AccountDto.fromEntity(accountRepository.save(account));
    }

    @Transactional(readOnly = true)
    public AccountDto getById(Long id) {
        return AccountDto.fromEntity(accountRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Account not found")));
    }

    @Transactional(readOnly = true)
    public List<AccountDto> getByUser(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return accountRepository.findByUser(user).stream().map(AccountDto::fromEntity).collect(Collectors.toList());
    }

    @Transactional
    public AccountDto updateStatus(Long id, Account.AccountStatus status) {
        Account account = accountRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Account not found"));
        account.setStatus(status);
        return AccountDto.fromEntity(accountRepository.save(account));
    }
}
