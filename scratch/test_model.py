import torch
from tgnn_fraud_detection import TGNNPredictor

predictor = TGNNPredictor(model_path="models/final_model.pth")
print("Model loaded successfully. Testing normalization...")

# Node features
x = [
    [0.05, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.15, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
]
edge_index = [[0, 1]]

print("\n--- Test 1: Absolute vs Normalized Timestamps (Single Txn) ---")
# Absolute Unix Timestamp (1782635950)
data_abs = {
    'x': x,
    'edge_index': edge_index,
    'edge_attr': [[150.0 / 10000.0, 14.0/24.0, 3.0/7.0, 0.0, 0.0]],
    't': [1782635950.0]
}
res_abs = predictor.predict(data_abs)
print(f"Absolute Timestamps (raw 1782635950.0) -> Prob={res_abs['probabilities'][0]:.4f}")

# Normalized Timestamps (0.0)
data_norm = {
    'x': x,
    'edge_index': edge_index,
    'edge_attr': [[150.0 / 10000.0, 14.0/24.0, 3.0/7.0, 0.0, 0.0]],
    't': [0.0] # 0 hours since start
}
res_norm = predictor.predict(data_norm)
print(f"Normalized Timestamps (0.0)             -> Prob={res_norm['probabilities'][0]:.4f}")
