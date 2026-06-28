package com.fraud.util;

import com.fraud.dto.PredictionRequest;
import com.fraud.model.Account;
import com.fraud.model.Transaction;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.time.ZoneOffset;
import java.util.*;

@Component
@RequiredArgsConstructor
public class GraphBuilder {
    public PredictionRequest buildGraphFromTransactions(List<Transaction> transactions) {
        Set<Account> accounts = new LinkedHashSet<>();
        for (Transaction t : transactions) { accounts.add(t.getSender()); accounts.add(t.getReceiver()); }
        List<List<Double>> nodeFeatures = new ArrayList<>();
        Map<Long, Integer> accountToIndex = new HashMap<>();
        int index = 0;
        for (Account account : accounts) {
            accountToIndex.put(account.getId(), index++);
            List<Double> features = new ArrayList<>();
            features.add(Math.min(account.getBalance().doubleValue() / 1000000.0, 1.0));
            features.add(account.getAccountType().ordinal() / 2.0);
            features.add(account.getStatus().ordinal() / 2.0);
            while (features.size() < 10) features.add(0.0);
            nodeFeatures.add(features);
        }
        List<List<Integer>> edgeIndices = new ArrayList<>();
        List<List<Double>> edgeFeatures = new ArrayList<>();
        List<Double> timestamps = new ArrayList<>();
        for (Transaction t : transactions) {
            edgeIndices.add(List.of(accountToIndex.get(t.getSender().getId()), accountToIndex.get(t.getReceiver().getId())));
            List<Double> ef = new ArrayList<>();
            ef.add(Math.log1p(t.getAmount().doubleValue()) / 15.0);
            ef.add(t.getCreatedAt().getHour() / 24.0);
            ef.add(t.getCreatedAt().getDayOfWeek().getValue() / 7.0);
            ef.add(t.getCreatedAt().getDayOfWeek().getValue() >= 6 ? 1.0 : 0.0);
            ef.add(0.0);
            edgeFeatures.add(ef);
            timestamps.add((double) t.getCreatedAt().toEpochSecond(ZoneOffset.UTC));
        }
        return PredictionRequest.builder().nodeFeatures(nodeFeatures).edgeIndices(edgeIndices)
            .edgeFeatures(edgeFeatures).timestamps(timestamps).build();
    }
}
