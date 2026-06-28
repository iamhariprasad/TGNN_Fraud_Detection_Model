package com.fraud.service;

import com.fraud.dto.TransactionDto;
import com.fraud.exception.ResourceNotFoundException;
import com.fraud.model.Account;
import com.fraud.model.Transaction;
import com.fraud.repository.AccountRepository;
import com.fraud.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TransactionService {
    private final TransactionRepository transactionRepository;
    private final AccountRepository accountRepository;
    private final FraudDetectionService fraudDetectionService;

    @Transactional
    public TransactionDto createTransaction(TransactionDto dto) {
        Account sender = accountRepository.findById(dto.getSenderId())
            .orElseThrow(() -> new ResourceNotFoundException("Sender not found"));
        Account receiver = accountRepository.findById(dto.getReceiverId())
            .orElseThrow(() -> new ResourceNotFoundException("Receiver not found"));
        if (sender.getBalance().compareTo(dto.getAmount()) < 0)
            throw new RuntimeException("Insufficient balance");
        Transaction txn = Transaction.builder().sender(sender).receiver(receiver)
            .amount(dto.getAmount()).currency(dto.getCurrency() != null ? dto.getCurrency() : "USD")
            .description(dto.getDescription()).status(Transaction.TransactionStatus.PENDING).build();
        txn = transactionRepository.save(txn);
        sender.setBalance(sender.getBalance().subtract(dto.getAmount()));
        receiver.setBalance(receiver.getBalance().add(dto.getAmount()));
        accountRepository.save(sender); accountRepository.save(receiver);
        fraudDetectionService.detectFraudForTransaction(txn);
        return TransactionDto.fromEntity(txn);
    }

    @Transactional(readOnly = true)
    public TransactionDto getById(Long id) {
        return TransactionDto.fromEntity(transactionRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Transaction not found")));
    }

    @Transactional(readOnly = true)
    public Page<TransactionDto> getAll(Pageable pageable) {
        return transactionRepository.findAll(pageable).map(TransactionDto::fromEntity);
    }

    @Transactional(readOnly = true)
    public Page<TransactionDto> getByAccount(Long accountId, Pageable pageable) {
        return transactionRepository.findByAccountId(accountId, pageable).map(TransactionDto::fromEntity);
    }

    @Transactional(readOnly = true)
    public List<TransactionDto> getFraudulent() {
        return transactionRepository.findByIsFraud(true).stream().map(TransactionDto::fromEntity).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<TransactionDto> getRecent() {
        return transactionRepository.findTop20ByOrderByCreatedAtDesc().stream().map(TransactionDto::fromEntity).collect(Collectors.toList());
    }
}
