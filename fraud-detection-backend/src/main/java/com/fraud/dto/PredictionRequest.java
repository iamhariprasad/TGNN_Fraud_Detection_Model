package com.fraud.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PredictionRequest {
    @JsonProperty("node_features")
    private List<List<Double>> nodeFeatures;
    
    @JsonProperty("edge_indices")
    private List<List<Integer>> edgeIndices;
    
    @JsonProperty("edge_features")
    private List<List<Double>> edgeFeatures;
    
    @JsonProperty("timestamps")
    private List<Double> timestamps;
}
