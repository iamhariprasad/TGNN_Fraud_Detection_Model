package com.fraud.service;

import com.fraud.dto.PredictionRequest;
import com.fraud.dto.PredictionResponse;
import com.fraud.model.FraudAlert;
import com.fraud.model.Transaction;
import com.fraud.repository.AlertRepository;
import com.fraud.repository.TransactionRepository;
import com.fraud.util.GraphBuilder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class FraudDetectionService {
    private final TransactionRepository transactionRepository;
    private final AlertRepository alertRepository;
    private final ModelClientService modelClientService;
    private final GraphBuilder graphBuilder;
    private static final double FRAUD_THRESHOLD = 0.7;

    @Transactional
    public void detectFraudForTransaction(Transaction transaction) {
        List<Transaction> recent = transactionRepository.findByCreatedAtAfter(
            transaction.getCreatedAt().minusHours(24));
        PredictionRequest request = graphBuilder.buildGraphFromTransactions(recent);
        PredictionResponse response = modelClientService.predictFraud(request);
        int idx = -1;
        for (int i = 0; i < recent.size(); i++) {
            if (recent.get(i).getId().equals(transaction.getId())) { idx = i; break; }
        }
        if (idx >= 0 && idx < response.getProbabilities().size()) {
            double prob = response.getProbabilities().get(idx);
            int pred = response.getPredictions().get(idx);
            transaction.setFraudScore(prob);
            transaction.setIsFraud(pred == 1);
            transaction.setRiskLevel(determineRiskLevel(prob));
            if (pred == 1 && prob >= FRAUD_THRESHOLD) {
                transaction.setStatus(Transaction.TransactionStatus.FLAGGED);
                FraudAlert alert = FraudAlert.builder()
                    .transaction(transaction).alertType(FraudAlert.AlertType.MODEL)
                    .severity(prob >= 0.9 ? FraudAlert.Severity.CRITICAL : prob >= 0.7 ? FraudAlert.Severity.HIGH : FraudAlert.Severity.MEDIUM)
                    .description("TGNN fraud probability: " + String.format("%.2f%%", prob * 100))
                    .status(FraudAlert.AlertStatus.NEW).build();
                alertRepository.save(alert);
                log.info("Fraud alert for txn {} prob={}", transaction.getId(), prob);
            } else {
                transaction.setStatus(Transaction.TransactionStatus.COMPLETED);
            }
            transactionRepository.save(transaction);
        }
    }

    private Transaction.RiskLevel determineRiskLevel(double p) {
        if (p >= 0.9) return Transaction.RiskLevel.CRITICAL;
        if (p >= 0.7) return Transaction.RiskLevel.HIGH;
        if (p >= 0.5) return Transaction.RiskLevel.MEDIUM;
        return Transaction.RiskLevel.LOW;
    }
}
