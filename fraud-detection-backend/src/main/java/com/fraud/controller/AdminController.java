package com.fraud.controller;

import com.fraud.model.Account;
import com.fraud.model.Transaction;
import com.fraud.model.User;
import com.fraud.repository.AccountRepository;
import com.fraud.repository.TransactionRepository;
import com.fraud.repository.UserRepository;
import com.fraud.util.ResponseUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.BufferedReader;
import java.io.FileReader;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
@Slf4j
public class AdminController {

    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;

    @PostMapping("/seed")
    public ResponseEntity<Map<String, Object>> seedDatabase(@RequestParam(defaultValue = "200") int minAccounts) {
        try {
            log.info("Starting database seeding from CSV files... Target minimum accounts: {}", minAccounts);
            
            // 1. Load Nodes (Accounts)
            String nodeFile = "../data/node_features.csv";
            Map<Long, Account> nodeIndexToAccount = new HashMap<>();
            
            BufferedReader nodeReader = new BufferedReader(new FileReader(nodeFile));
            String headerLine = nodeReader.readLine(); // skip header
            String line;
            long index = 0;
            
            while ((line = nodeReader.readLine()) != null && index < minAccounts) {
                String[] parts = line.split(",");
                if (parts.length < 10) continue;
                
                double f0 = Double.parseDouble(parts[0]); // normalized balance
                double f1 = Double.parseDouble(parts[4]); // account type index
                double f2 = Double.parseDouble(parts[5]); // account status index (using feature_5 as fallback or feature_2)
                
                // Reconstruct properties
                BigDecimal balance = BigDecimal.valueOf(Math.max(f0 * 1000000.0, 5000.0)); // ensure positive balance
                
                Account.AccountType type = Account.AccountType.PERSONAL;
                int typeIdx = (int) Math.round(f1 * 2.0);
                if (typeIdx == 1) type = Account.AccountType.BUSINESS;
                else if (typeIdx == 2) type = Account.AccountType.MERCHANT;
                
                Account.AccountStatus status = Account.AccountStatus.ACTIVE;
                
                // Create user
                String username = "user_" + index;
                User user = userRepository.findByUsername(username).orElse(null);
                if (user == null) {
                    user = User.builder()
                            .username(username)
                            .email(username + "@fraud.com")
                            .password("$2a$10$dummyhash")
                            .firstName("First_" + index)
                            .lastName("Last_" + index)
                            .role(User.Role.USER)
                            .isActive(true)
                            .build();
                    user = userRepository.save(user);
                }
                
                // Create account
                String accNum = "ACC" + String.format("%09d", index);
                Account account = accountRepository.findByAccountNumber(accNum).orElse(null);
                if (account == null) {
                    account = Account.builder()
                            .user(user)
                            .accountNumber(accNum)
                            .accountType(type)
                            .balance(balance)
                            .status(status)
                            .build();
                    account = accountRepository.save(account);
                }
                
                nodeIndexToAccount.put(index, account);
                index++;
            }
            nodeReader.close();
            log.info("Successfully loaded {} accounts into database.", nodeIndexToAccount.size());
            
            // 2. Load Edges (Transactions)
            String edgeFile = "../data/edges.csv";
            BufferedReader edgeReader = new BufferedReader(new FileReader(edgeFile));
            edgeReader.readLine(); // skip header
            
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
            long txnCount = 0;
            
            while ((line = edgeReader.readLine()) != null && txnCount < 1000) { // Limit to 1000 txns to avoid heavy DB overhead
                String[] parts = line.split(",");
                if (parts.length < 5) continue;
                
                long src = Long.parseLong(parts[0]);
                long dst = Long.parseLong(parts[1]);
                String timestampStr = parts[2];
                double amountVal = Double.parseDouble(parts[3]);
                int label = Integer.parseInt(parts[4]);
                
                // Only load transactions between our seeded accounts
                if (nodeIndexToAccount.containsKey(src) && nodeIndexToAccount.containsKey(dst)) {
                    Account sender = nodeIndexToAccount.get(src);
                    Account receiver = nodeIndexToAccount.get(dst);
                    
                    LocalDateTime timestamp = LocalDateTime.parse(timestampStr, formatter);
                    
                    Transaction txn = Transaction.builder()
                            .sender(sender)
                            .receiver(receiver)
                            .amount(BigDecimal.valueOf(amountVal))
                            .currency("USD")
                            .description("Dataset Txn " + txnCount)
                            .status(label == 1 ? Transaction.TransactionStatus.FLAGGED : Transaction.TransactionStatus.COMPLETED)
                            .isFraud(label == 1)
                            .fraudScore(label == 1 ? 0.99 : 0.01)
                            .riskLevel(label == 1 ? Transaction.RiskLevel.CRITICAL : Transaction.RiskLevel.LOW)
                            .build();
                    
                    // Manually set timestamp by setting field or using Hibernate updates if creationTime is timestamped
                    // To ensure the timestamp is custom, we'll save and let H2 save it.
                    transactionRepository.save(txn);
                    txnCount++;
                }
            }
            edgeReader.close();
            log.info("Successfully loaded {} transactions between accounts.", txnCount);
            
            Map<String, Object> response = new HashMap<>();
            response.put("seededAccounts", nodeIndexToAccount.size());
            response.put("seededTransactions", txnCount);
            return ResponseUtil.success(response);
            
        } catch (Exception e) {
            log.error("Error seeding database: {}", e.getMessage(), e);
            return ResponseUtil.error(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR, e.getMessage());
        }
    }
}
