package com.fraud.service;

import com.fraud.dto.PredictionRequest;
import com.fraud.dto.PredictionResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.util.ArrayList;
import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class ModelClientService {
    @Value("${model.api.url}")
    private String modelApiUrl;
    private final RestTemplate restTemplate;

    public PredictionResponse predictFraud(PredictionRequest request) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<PredictionRequest> entity = new HttpEntity<>(request, headers);
            ResponseEntity<PredictionResponse> response = restTemplate.exchange(
                modelApiUrl, HttpMethod.POST, entity, PredictionResponse.class);
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return response.getBody();
            }
            throw new RuntimeException("Model API error: " + response.getStatusCode());
        } catch (Exception e) {
            log.error("Error calling model API: {}", e.getMessage());
            return createDefaultResponse(request.getEdgeIndices().size());
        }
    }

    private PredictionResponse createDefaultResponse(int size) {
        List<Double> probs = new ArrayList<>();
        List<Integer> preds = new ArrayList<>();
        List<Double> scores = new ArrayList<>();
        for (int i = 0; i < size; i++) { probs.add(0.1); preds.add(0); scores.add(-1.0); }
        return PredictionResponse.builder().probabilities(probs).predictions(preds).scores(scores).build();
    }
}
