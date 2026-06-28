"""FastAPI model server for TGNN Fraud Detection Model."""
import os
import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from tgnn_fraud_detection import TGNNPredictor, Config

app = FastAPI(title="TGNN Fraud Detection API")

# Use final_model.pth if it exists, otherwise best_model.pth, otherwise default to search
model_path = None
if os.path.exists(f"{Config.MODEL_DIR}/final_model.pth"):
    model_path = f"{Config.MODEL_DIR}/final_model.pth"
elif os.path.exists(f"{Config.MODEL_DIR}/best_model.pth"):
    model_path = f"{Config.MODEL_DIR}/best_model.pth"

# Load predictor at startup
print(f"Loading TGNN model from: {model_path or 'default paths'}")
predictor = TGNNPredictor(model_path=model_path)


class TransactionRequest(BaseModel):
    """Request body for fraud prediction"""
    node_features: list
    edge_indices: list
    edge_features: list
    timestamps: list


class PredictionResponse(BaseModel):
    """Response for fraud prediction"""
    probabilities: list
    predictions: list
    scores: list


@app.post("/predict", response_model=PredictionResponse)
async def predict_fraud(request: TransactionRequest):
    """
    Predict fraud probability for a batch of transactions
    
    Request body:
    - node_features: List of node features (N x num_features)
    - edge_indices: List of edge indices [[src1, dst1], [src2, dst2], ...]
    - edge_features: List of edge features (E x num_edge_features)
    - timestamps: List of timestamps (E,)
    """
    try:
        data = {
            'x': request.node_features,
            'edge_index': request.edge_indices,
            'edge_attr': request.edge_features,
            't': request.timestamps
        }
        
        result = predictor.predict(data)
        return PredictionResponse(**result)
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "model_loaded": True}
