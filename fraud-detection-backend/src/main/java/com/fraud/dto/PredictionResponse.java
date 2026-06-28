package com.fraud.dto;

import lombok.*;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PredictionResponse {
    private List<Double> probabilities;
    private List<Integer> predictions;
    private List<Double> scores;
}
