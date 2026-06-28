package com.fraud.repository;

import com.fraud.model.Account;
import com.fraud.model.Transaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, Long> {
    List<Transaction> findBySenderOrReceiver(Account sender, Account receiver);
    List<Transaction> findBySender(Account sender);
    List<Transaction> findByReceiver(Account receiver);
    List<Transaction> findByIsFraud(Boolean isFraud);
    List<Transaction> findByStatus(Transaction.TransactionStatus status);
    List<Transaction> findByCreatedAtAfter(LocalDateTime dateTime);
    @Query("SELECT t FROM Transaction t WHERE t.createdAt BETWEEN :start AND :end")
    List<Transaction> findByDateRange(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
    @Query("SELECT t FROM Transaction t WHERE t.sender.id = :accountId OR t.receiver.id = :accountId")
    Page<Transaction> findByAccountId(@Param("accountId") Long accountId, Pageable pageable);
    List<Transaction> findTop20ByOrderByCreatedAtDesc();
}
