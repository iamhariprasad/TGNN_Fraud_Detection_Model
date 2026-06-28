"""
Temporal Graph Neural Network for Real-Time Fraud Detection
in Financial Transaction Networks

This model uses PyTorch Geometric's TGAT (Temporal Graph Attention Network)
to detect fraudulent transactions in real-time.

Architecture:
- Temporal encoding for transaction timestamps
- Graph Attention Network for message passing
- Temporal attention to capture evolving patterns
- Binary classification (fraud vs. legitimate)

Usage:
1. Install dependencies: pip install -r requirements.txt
2. Generate synthetic data: python generate_data.py
3. Train model: python train.py
4. Run inference API: python predict.py
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import TransformerConv
from torch_geometric.data import Data
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score
import matplotlib.pyplot as plt
import seaborn as sns
import json
import os
from tqdm import tqdm


# Check GPU availability
print(f"PyTorch version: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
else:
    print("Warning: No GPU detected, using CPU")


# ============================================================================
# CONFIGURATION
# ============================================================================

class Config:
    # Graph parameters
    NUM_NODES = 1000  # Number of accounts/nodes in the graph
    NUM_FEATURES = 10  # Node feature dimension
    EDGE_FEATURES = 5  # Edge feature dimension
    
    # Model parameters
    HIDDEN_DIM = 128
    NUM_LAYERS = 2
    HEADS = 4
    DROPOut = 0.1
    
    # Training parameters
    BATCH_SIZE = 32
    EPOCHS = 50
    LEARNING_RATE = 0.001
    WEIGHT_DECAY = 1e-5
    
    # Temporal parameters
    TIME_WINDOW = 24  # hours
    MAX_TIME_DIFF = 3600  # seconds
    
    # Data parameters
    NUM_TRANSACTIONS = 100000
    FRAUD_RATIO = 0.20  # 20% fraud rate
    
    # Paths
    DATA_DIR = "data"
    MODEL_DIR = "models"
    
    @classmethod
    def create_dirs(cls):
        os.makedirs(cls.DATA_DIR, exist_ok=True)
        os.makedirs(cls.MODEL_DIR, exist_ok=True)


Config.create_dirs()


# ============================================================================
# DATA GENERATION (Synthetic Financial Transaction Data)
# ============================================================================

class SyntheticDataGenerator:
    """
    Generates synthetic financial transaction data with:
    - Multiple accounts (nodes)
    - Transactions between accounts (edges)
    - Temporal patterns
    - Fraudulent transactions (label = 1)
    - Legitimate transactions (label = 0)
    """
    
    def __init__(self, num_nodes=Config.NUM_NODES, num_transactions=Config.NUM_TRANSACTIONS):
        self.num_nodes = num_nodes
        self.num_transactions = num_transactions
        self.node_features = None
        self.edge_data = None
        
    def generate_node_features(self):
        """Generate features for each account node"""
        np.random.seed(42)
        
        # Account features: age, balance, transaction frequency, etc.
        ages = np.random.randint(1, 365, size=self.num_nodes)  # days since creation
        balances = np.random.uniform(100, 100000, size=self.num_nodes)
        avg_transaction = np.random.uniform(10, 5000, size=self.num_nodes)
        transaction_count = np.random.poisson(50, size=self.num_nodes)
        account_type = np.random.randint(0, 3, size=self.num_nodes)  # 0=personal, 1=business, 2=merchant
        
        # Normalize features
        features = np.column_stack([
            (ages - ages.mean()) / ages.std(),
            (balances - balances.mean()) / balances.std(),
            (avg_transaction - avg_transaction.mean()) / avg_transaction.std(),
            (transaction_count - transaction_count.mean()) / transaction_count.std(),
            account_type / 2.0,
            np.random.normal(0, 1, size=self.num_nodes),  # random feature 1
            np.random.normal(0, 1, size=self.num_nodes),  # random feature 2
            np.random.normal(0, 1, size=self.num_nodes),  # random feature 3
            np.random.normal(0, 1, size=self.num_nodes),  # random feature 4
            np.random.normal(0, 1, size=self.num_nodes),  # random feature 5
        ])
        
        self.node_features = torch.tensor(features, dtype=torch.float32)
        return self.node_features
    
    def generate_transactions(self):
        """Generate synthetic transaction data with temporal patterns"""
        np.random.seed(42)
        
        base_time = datetime(2024, 1, 1)
        timestamps = []
        sources = []
        destinations = []
        amounts = []
        edge_features = []
        labels = []
        
        # Generate legitimate transactions
        num_legit = int(self.num_transactions * (1 - Config.FRAUD_RATIO))
        for _ in range(num_legit):
            # Temporal pattern: more transactions during business hours
            hour = np.random.choice([9, 10, 11, 12, 13, 14, 15, 16], p=[0.1, 0.12, 0.15, 0.18, 0.18, 0.15, 0.1, 0.02])
            day_offset = np.random.randint(0, 90)  # 90 days of data
            timestamp = base_time + timedelta(days=int(day_offset), hours=int(hour), minutes=int(np.random.randint(0, 60)))
            
            # Prefer transactions between connected accounts (small-world pattern)
            if np.random.random() < 0.7:
                # Local transaction (within a community)
                community_size = np.random.randint(5, 20)
                community = np.random.choice(self.num_nodes, community_size, replace=False)
                src, dst = np.random.choice(community, 2, replace=False)
            else:
                # Random transaction
                src, dst = np.random.choice(self.num_nodes, 2, replace=False)
            
            # Amount follows log-normal distribution
            amount = np.random.lognormal(mean=5, sigma=1.5)
            amount = min(max(amount, 1), 10000)
            
            timestamps.append(timestamp)
            sources.append(src)
            destinations.append(dst)
            amounts.append(amount)
            
            # Edge features: amount (normalized), time of day, day of week, etc.
            time_of_day = hour / 24.0
            day_of_week = timestamp.weekday() / 7.0
            is_weekend = 1.0 if timestamp.weekday() >= 5 else 0.0
            amount_norm = (np.log(amount) - 5) / 1.5  # normalized log amount
            
            edge_features.append([amount_norm, time_of_day, day_of_week, is_weekend, np.random.normal(0, 0.1)])
            labels.append(0)  # legitimate
        
        # Generate fraudulent transactions
        num_fraud = self.num_transactions - num_legit
        for _ in range(num_fraud):
            # Temporal pattern: fraud often happens at night or weekends
            if np.random.random() < 0.6:
                hour = np.random.choice([0, 1, 2, 3, 4, 5, 6, 22, 23])
            else:
                hour = np.random.randint(0, 24)
            
            day_offset = np.random.randint(0, 90)
            timestamp = base_time + timedelta(days=int(day_offset), hours=int(hour), minutes=int(np.random.randint(0, 60)))
            
            # Fraud patterns:
            # 1. Money mule pattern: many small transactions to same account
            # 2. Large single transaction
            # 3. Rapid transactions between new accounts
            
            pattern = np.random.choice([1, 2, 3], p=[0.4, 0.3, 0.3])
            
            if pattern == 1:  # Money mule
                # Many transactions to a single account
                dst = np.random.choice(self.num_nodes)
                src = np.random.choice(self.num_nodes)
                amount = np.random.uniform(100, 2000)
            elif pattern == 2:  # Large transaction
                src, dst = np.random.choice(self.num_nodes, 2, replace=False)
                amount = np.random.uniform(5000, 50000)
            else:  # Rapid transactions
                src, dst = np.random.choice(self.num_nodes, 2, replace=False)
                amount = np.random.uniform(1000, 10000)
            
            timestamps.append(timestamp)
            sources.append(src)
            destinations.append(dst)
            amounts.append(amount)
            
            # Edge features for fraud
            time_of_day = hour / 24.0
            day_of_week = timestamp.weekday() / 7.0
            is_weekend = 1.0 if timestamp.weekday() >= 5 else 0.0
            amount_norm = (np.log(amount) - 5) / 1.5
            
            # Add fraud indicator to features (model shouldn't see this directly)
            edge_features.append([amount_norm, time_of_day, day_of_week, is_weekend, np.random.normal(2, 0.5)])
            labels.append(1)  # fraud
        
        # Sort by timestamp
        sorted_indices = np.argsort(timestamps)
        self.edge_data = {
            'source': np.array(sources)[sorted_indices],
            'destination': np.array(destinations)[sorted_indices],
            'timestamp': np.array(timestamps)[sorted_indices],
            'amount': np.array(amounts)[sorted_indices],
            'features': np.array(edge_features)[sorted_indices],
            'label': np.array(labels)[sorted_indices]
        }
        
        return self.edge_data
    
    def save_to_csv(self):
        """Save generated data to CSV files"""
        if self.node_features is None:
            self.generate_node_features()
        if self.edge_data is None:
            self.generate_transactions()
        
        # Save node features
        node_df = pd.DataFrame(self.node_features.numpy(), columns=[f'feature_{i}' for i in range(self.node_features.shape[1])])
        node_df.to_csv(f'{Config.DATA_DIR}/node_features.csv', index=False)
        
        # Save edge data
        edge_df = pd.DataFrame({
            'source': self.edge_data['source'],
            'destination': self.edge_data['destination'],
            'timestamp': self.edge_data['timestamp'],
            'amount': self.edge_data['amount'],
            'label': self.edge_data['label']
        })
        # Save edge features separately
        edge_features_df = pd.DataFrame(
            self.edge_data['features'],
            columns=[f'edge_feature_{i}' for i in range(self.edge_data['features'].shape[1])]
        )
        edge_df.to_csv(f'{Config.DATA_DIR}/edges.csv', index=False)
        edge_features_df.to_csv(f'{Config.DATA_DIR}/edge_features.csv', index=False)
        
        print(f"Data saved to {Config.DATA_DIR}/ directory")
        return f'{Config.DATA_DIR}/node_features.csv', f'{Config.DATA_DIR}/edges.csv'
    
    def to_pyg_data(self):
        """Convert to PyTorch Geometric Data object"""
        if self.node_features is None:
            self.generate_node_features()
        if self.edge_data is None:
            self.generate_transactions()
        
        # Convert timestamps to numeric values (seconds since epoch)
        timestamps = np.array([ts.timestamp() for ts in self.edge_data['timestamp']])
        
        # Create edge index
        edge_index = torch.tensor([
            self.edge_data['source'],
            self.edge_data['destination']
        ], dtype=torch.long)
        
        # Edge attributes
        edge_attr = torch.tensor(self.edge_data['features'], dtype=torch.float32)
        edge_time = torch.tensor(timestamps, dtype=torch.float32)
        edge_label = torch.tensor(self.edge_data['label'], dtype=torch.float32)
        
        # Create PyG Data object
        data = Data(
            x=self.node_features,
            edge_index=edge_index,
            edge_attr=edge_attr,
            t=edge_time,
            y=edge_label
        )
        
        return data


# ============================================================================
# TEMPORAL GRAPH NEURAL NETWORK MODEL
# ============================================================================

class TimeEncoder(nn.Module):
    """
    Encodes time information using sinusoidal functions
    """
    def __init__(self, dim=Config.HIDDEN_DIM):
        super().__init__()
        self.dim = dim
        self.w = nn.Linear(1, dim)
        
        # Learnable parameters for sinusoidal encoding
        self.freq = nn.Parameter(torch.randn(dim // 2) * 0.1)
        self.phase = nn.Parameter(torch.randn(dim // 2) * 0.1)
    
    def forward(self, t):
        # t: (E,) or (E, 1) tensor of timestamps
        if t.dim() == 1:
            t = t.unsqueeze(-1)
        
        # Linear projection -> (E, dim)
        linear = self.w(t)
        
        # Sinusoidal encoding: use sin + cos to fill full dim
        freq = self.freq.unsqueeze(0).expand(t.size(0), -1)   # (E, dim//2)
        phase = self.phase.unsqueeze(0).expand(t.size(0), -1) # (E, dim//2)
        arg = 2 * np.pi * freq * t + phase
        sin_enc = torch.sin(arg)  # (E, dim//2)
        cos_enc = torch.cos(arg)  # (E, dim//2)
        sinusoidal = torch.cat([sin_enc, cos_enc], dim=-1)  # (E, dim)
        
        # Handle odd dim (dim//2 * 2 could be dim-1 if dim is odd)
        if self.dim % 2 != 0:
            sinusoidal = torch.cat([sinusoidal, torch.zeros(t.size(0), 1, device=t.device)], dim=1)
        
        return linear + sinusoidal


class TemporalAttention(nn.Module):
    """
    Attention mechanism for temporal information
    """
    def __init__(self, hidden_dim=Config.HIDDEN_DIM):
        super().__init__()
        self.query = nn.Linear(hidden_dim, hidden_dim)
        self.key = nn.Linear(hidden_dim, hidden_dim)
        self.value = nn.Linear(hidden_dim, hidden_dim)
        
    def forward(self, x, time_enc):
        # x: (N, H) node features
        # time_enc: (E, H) time encodings for edges
        
        Q = self.query(x)
        K = self.key(x)
        V = self.value(x)
        
        # Scaled dot-product attention
        scores = torch.matmul(Q, K.transpose(-2, -1)) / np.sqrt(x.size(-1))
        attn = F.softmax(scores, dim=-1)
        
        return torch.matmul(attn, V)


class TGNN(nn.Module):
    """
    Temporal Graph Neural Network for Fraud Detection
    
    Architecture:
    1. Time encoding for temporal information
    2. Multiple TGAT (Temporal Graph Attention) layers
    3. Temporal attention for dynamic patterns
    4. Binary classification head
    """
    
    def __init__(self, 
                 num_node_features=Config.NUM_FEATURES,
                 num_edge_features=Config.EDGE_FEATURES,
                 hidden_dim=Config.HIDDEN_DIM,
                 num_layers=Config.NUM_LAYERS,
                 heads=Config.HEADS,
                 dropout=Config.DROPOut):
        super().__init__()
        
        self.num_layers = num_layers
        self.hidden_dim = hidden_dim
        
        # Time encoder
        self.time_encoder = TimeEncoder(hidden_dim)
        
        # Node feature projection
        self.node_proj = nn.Linear(num_node_features, hidden_dim)
        
        # Edge feature projection  (project raw edge features + time encoding)
        self.edge_proj = nn.Linear(num_edge_features + hidden_dim, hidden_dim)
        
        # TransformerConv layers (multi-head graph attention with edge features)
        self.convs = nn.ModuleList()
        self.conv_projs = nn.ModuleList()  # project multi-head output back to hidden_dim
        for _ in range(num_layers):
            self.convs.append(
                TransformerConv(
                    in_channels=hidden_dim,
                    out_channels=hidden_dim // heads,
                    heads=heads,
                    dropout=dropout,
                    edge_dim=hidden_dim,
                    concat=True  # output is heads * (hidden_dim // heads) = hidden_dim
                )
            )
            self.conv_projs.append(nn.Linear(hidden_dim, hidden_dim))
        
        # Temporal attention
        self.temp_attn = TemporalAttention(hidden_dim)
        
        # Layer normalization
        self.norm = nn.LayerNorm(hidden_dim)
        
        # Dropout
        self.dropout = nn.Dropout(dropout)
        
        # Classification head (input: src + dst embeddings)
        self.classifier = nn.Sequential(
            nn.Linear(hidden_dim * 2, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, 1)
        )
    
    def forward(self, data):
        """
        Forward pass
        
        Args:
            data: PyG Data object with:
                - x: (N, num_node_features) node features
                - edge_index: (2, E) edge indices
                - edge_attr: (E, num_edge_features) edge features
                - t: (E,) edge timestamps
        
        Returns:
            logits: (E,) fraud probability for each edge
        """
        x, edge_index, edge_attr, t = data.x, data.edge_index, data.edge_attr, data.t
        
        # Project node features
        x = self.node_proj(x)
        
        # Encode time and concatenate with raw edge features to form edge attr
        time_enc = self.time_encoder(t)
        edge_attr = torch.cat([edge_attr, time_enc], dim=-1)  # (E, edge_feat + hidden)
        edge_attr = self.edge_proj(edge_attr)                 # (E, hidden)
        
        # Pass through TransformerConv layers
        for i, conv in enumerate(self.convs):
            # Message passing with edge features (includes time info)
            m = conv(x, edge_index, edge_attr=edge_attr)
            m = self.conv_projs[i](m)
            
            # Residual connection + norm + dropout
            x = x + self.dropout(m)
            x = self.norm(x)
            
            if i < self.num_layers - 1:
                x = F.relu(x)
        
        # Get source and target node embeddings for each edge
        row, col = edge_index
        x_src = x[row]
        x_dst = x[col]
        
        # Concatenate source and destination embeddings
        edge_embedding = torch.cat([x_src, x_dst], dim=-1)  # (E, hidden_dim * 2)
        
        # Classification
        logits = self.classifier(edge_embedding)
        
        return logits.squeeze(-1)


# ============================================================================
# DATA LOADING AND PREPROCESSING
# ============================================================================

class TransactionDataset:
    """
    Dataset for transaction data with temporal graph structure
    """
    
    def __init__(self, data, window_size=24, stride=6):
        """
        Args:
            data: PyG Data object
            window_size: Number of hours for each temporal window
            stride: Stride for sliding window
        """
        self.data = data
        self.window_size = window_size
        self.stride = stride
        self.temporal_graphs = []
        
        self._create_temporal_graphs()
    
    def _create_temporal_graphs(self):
        """Create temporal subgraphs using sliding window"""
        # Sort edges by timestamp
        timestamps = self.data.t
        edge_index = self.data.edge_index
        edge_attr = self.data.edge_attr
        edge_label = self.data.y
        
        # Sort all edge data by timestamp
        sorted_indices = torch.argsort(timestamps)
        timestamps = timestamps[sorted_indices]
        edge_index = edge_index[:, sorted_indices]
        edge_attr = edge_attr[sorted_indices]
        edge_label = edge_label[sorted_indices]
        
        # Convert timestamps to hours since start
        min_time = timestamps.min()
        timestamps = (timestamps - min_time) / 3600  # convert to hours
        
        # Create sliding windows
        start = 0
        while start < len(timestamps):
            end = start
            while end < len(timestamps) and timestamps[end] - timestamps[start] <= self.window_size:
                end += 1
            
            # Create subgraph for this window
            window_edge_index = edge_index[:, start:end]
            window_edge_attr = edge_attr[start:end]
            window_timestamps = timestamps[start:end]
            window_labels = edge_label[start:end]
            
            # Get unique nodes in this window
            unique_nodes = torch.unique(torch.cat([
                window_edge_index[0],
                window_edge_index[1]
            ]))
            
            # Create node mapping for this window
            node_mapping = {node.item(): idx for idx, node in enumerate(unique_nodes)}
            
            # Remap edge indices
            remapped_edge_index = torch.stack([
                torch.tensor([node_mapping[edge_index[0, i].item()] for i in range(start, end)]),
                torch.tensor([node_mapping[edge_index[1, i].item()] for i in range(start, end)])
            ])
            
            # Get node features for nodes in this window
            window_node_features = self.data.x[unique_nodes]
            
            # Create subgraph
            subgraph = Data(
                x=window_node_features,
                edge_index=remapped_edge_index,
                edge_attr=window_edge_attr,
                t=window_timestamps,
                y=window_labels
            )
            
            self.temporal_graphs.append(subgraph)
            
            # Move window
            start += self.stride
            if start >= end:
                start = end
    
    def __len__(self):
        return len(self.temporal_graphs)
    
    def __getitem__(self, idx):
        return self.temporal_graphs[idx]


class TemporalDataLoader:
    """
    Custom data loader for temporal graphs
    """
    
    def __init__(self, dataset, batch_size=Config.BATCH_SIZE, shuffle=True):
        self.dataset = dataset
        self.batch_size = batch_size
        self.shuffle = shuffle
    
    def __iter__(self):
        self.indices = list(range(len(self.dataset)))
        if self.shuffle:
            np.random.shuffle(self.indices)
        for i in range(0, len(self.indices), self.batch_size):
            batch_indices = self.indices[i:i + self.batch_size]
            batch = [self.dataset[idx] for idx in batch_indices]
            
            # For simplicity, return list of graphs
            # In practice, you might want to batch them properly
            yield batch
    
    def __len__(self):
        return (len(self.dataset) + self.batch_size - 1) // self.batch_size


# ============================================================================
# TRAINING AND EVALUATION
# ============================================================================

class TGNNTrainer:
    """
    Trainer for TGNN model
    """
    
    def __init__(self, model, config=Config):
        self.model = model
        self.config = config
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        print(f"   Using device: {self.device}")
        self.model.to(self.device)
        
        # Optimizer and loss
        self.optimizer = torch.optim.Adam(
            self.model.parameters(),
            lr=config.LEARNING_RATE,
            weight_decay=config.WEIGHT_DECAY
        )
        # pos_weight ~19 matches the 95/5 class imbalance (1/FRAUD_RATIO - 1)
        pos_weight = torch.tensor([1.0 / config.FRAUD_RATIO - 1.0]).to(self.device)
        self.criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
        
        # Learning rate scheduler
        self.scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
            self.optimizer, mode='max', factor=0.5, patience=5
        )
        
        # Metrics tracking
        self.train_losses = []
        self.val_losses = []
        self.train_aucs = []
        self.val_aucs = []
    
    def train_epoch(self, dataloader):
        """Train for one epoch"""
        self.model.train()
        total_loss = 0
        all_preds = []
        all_labels = []
        
        for batch in tqdm(dataloader, desc="Training"):
            # Batch is a list of temporal graphs
            batch_loss = 0
            batch_preds = []
            batch_labels = []
            
            for graph in batch:
                graph = graph.to(self.device)
                
                # Forward pass
                logits = self.model(graph)
                
                # Compute loss (divide by batch size to average gradients)
                loss = self.criterion(logits, graph.y) / len(batch)
                
                # Backward pass (gradients are now properly averaged)
                loss.backward()
                
                batch_loss += loss.item()
                batch_preds.append(logits.detach().cpu())
                batch_labels.append(graph.y.detach().cpu())
            
            # Gradient clipping to prevent exploding gradients
            torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
            
            # Gradient update
            self.optimizer.step()
            self.optimizer.zero_grad()
            
            # Track loss and predictions
            total_loss += batch_loss
            all_preds.extend([p for p in torch.cat(batch_preds)])
            all_labels.extend([l for l in torch.cat(batch_labels)])
        
        avg_loss = total_loss / len(dataloader)
        
        # Calculate AUC
        preds = torch.sigmoid(torch.tensor(all_preds)).numpy()
        labels = torch.tensor(all_labels).numpy()
        auc = roc_auc_score(labels, preds)
        
        return avg_loss, auc
    
    def evaluate(self, dataloader):
        """Evaluate model on validation/test data"""
        self.model.eval()
        total_loss = 0
        all_preds = []
        all_labels = []
        
        with torch.no_grad():
            for batch in tqdm(dataloader, desc="Evaluating"):
                batch_loss = 0
                batch_preds = []
                batch_labels = []
                
                for graph in batch:
                    graph = graph.to(self.device)
                    
                    # Forward pass
                    logits = self.model(graph)
                    
                    # Compute loss
                    loss = self.criterion(logits, graph.y)
                    
                    batch_loss += loss.item()
                    batch_preds.append(logits.detach().cpu())
                    batch_labels.append(graph.y.detach().cpu())
                
                batch_loss /= len(batch)
                total_loss += batch_loss
                all_preds.extend([p for p in torch.cat(batch_preds)])
                all_labels.extend([l for l in torch.cat(batch_labels)])
        
        avg_loss = total_loss / len(dataloader)
        
        # Calculate metrics
        preds = torch.sigmoid(torch.tensor(all_preds)).numpy()
        labels = torch.tensor(all_labels).numpy()
        auc = roc_auc_score(labels, preds)
        
        # Classification report — convert labels to int (float labels produce keys '0.0'/'1.0')
        labels_int = labels.astype(int)
        pred_classes = (preds > 0.5).astype(int)
        report = classification_report(labels_int, pred_classes, output_dict=True, zero_division=0)
        
        return {
            'loss': avg_loss,
            'auc': auc,
            'precision': report.get('1', report.get('1.0', {})).get('precision', 0),
            'recall': report.get('1', report.get('1.0', {})).get('recall', 0),
            'f1': report.get('1', report.get('1.0', {})).get('f1-score', 0)
        }
    
    def train(self, train_loader, val_loader=None, epochs=Config.EPOCHS):
        """Full training loop"""
        best_val_auc = 0
        best_model = None
        
        for epoch in range(epochs):
            print(f"\nEpoch {epoch + 1}/{epochs}")
            print("-" * 50)
            
            # Train
            train_loss, train_auc = self.train_epoch(train_loader)
            self.train_losses.append(train_loss)
            self.train_aucs.append(train_auc)
            
            print(f"Train Loss: {train_loss:.4f}, Train AUC: {train_auc:.4f}")
            
            # Validate
            if val_loader is not None:
                val_metrics = self.evaluate(val_loader)
                self.val_losses.append(val_metrics['loss'])
                self.val_aucs.append(val_metrics['auc'])
                
                print(f"Val Loss: {val_metrics['loss']:.4f}, Val AUC: {val_metrics['auc']:.4f}")
                print(f"Val Precision: {val_metrics['precision']:.4f}, Val Recall: {val_metrics['recall']:.4f}, Val F1: {val_metrics['f1']:.4f}")
                
                # Save best model
                if val_metrics['auc'] > best_val_auc:
                    best_val_auc = val_metrics['auc']
                    best_model = self.model.state_dict()
                    torch.save(best_model, f"{Config.MODEL_DIR}/best_model.pth")
                    print("Best model saved!")
                
                # Step learning rate scheduler based on val AUC
                old_lr = self.optimizer.param_groups[0]['lr']
                self.scheduler.step(val_metrics['auc'])
                new_lr = self.optimizer.param_groups[0]['lr']
                if new_lr < old_lr:
                    print(f"Learning rate reduced from {old_lr:.6f} to {new_lr:.6f}")
            
            # Save checkpoint
            if (epoch + 1) % 10 == 0:
                torch.save(self.model.state_dict(), f"{Config.MODEL_DIR}/checkpoint_epoch_{epoch + 1}.pth")
        
        return best_model
    
    def plot_metrics(self):
        """Plot training and validation metrics"""
        plt.figure(figsize=(15, 5))
        
        # Loss plot
        plt.subplot(1, 2, 1)
        plt.plot(self.train_losses, label='Train Loss')
        if self.val_losses:
            plt.plot(self.val_losses, label='Val Loss')
        plt.xlabel('Epoch')
        plt.ylabel('Loss')
        plt.title('Training and Validation Loss')
        plt.legend()
        
        # AUC plot
        plt.subplot(1, 2, 2)
        plt.plot(self.train_aucs, label='Train AUC')
        if self.val_aucs:
            plt.plot(self.val_aucs, label='Val AUC')
        plt.xlabel('Epoch')
        plt.ylabel('AUC')
        plt.title('Training and Validation AUC')
        plt.legend()
        
        plt.tight_layout()
        plt.savefig(f"{Config.MODEL_DIR}/training_metrics.png")
        plt.close()
        print(f"Metrics plot saved to {Config.MODEL_DIR}/training_metrics.png")


# ============================================================================
# MODEL INFERENCE
# ============================================================================

class TGNNPredictor:
    """
    Inference class for TGNN model
    """
    
    def __init__(self, model_path=None):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = self._load_model(model_path)
    
    def _load_model(self, model_path):
        """Load trained model"""
        if model_path is None:
            model_path = f"{Config.MODEL_DIR}/best_model.pth"
        
        model = TGNN()
        if os.path.exists(model_path):
            model.load_state_dict(torch.load(model_path, map_location=self.device))
            print(f"Model loaded from {model_path}")
        else:
            print("No trained model found. Using randomly initialized model.")
        
        model.to(self.device)
        model.eval()
        return model
    
    def predict(self, data):
        """
        Predict fraud probability for transactions
        
        Args:
            data: PyG Data object or dict with:
                - x: node features
                - edge_index: edge indices
                - edge_attr: edge features
                - t: timestamps
        
        Returns:
            dict: {
                'probabilities': fraud probabilities for each edge,
                'predictions': binary predictions (0 or 1),
                'scores': raw logits
            }
        """
        if isinstance(data, dict):
            x = torch.tensor(data['x'], dtype=torch.float32)
            edge_index = torch.tensor(data['edge_index'], dtype=torch.long)
            edge_attr = torch.tensor(data['edge_attr'], dtype=torch.float32)
            t = torch.tensor(data['t'], dtype=torch.float32)
            
            # 1. Align x (node features) -> must be 2D [N, num_features]
            if x.dim() == 1:
                x = x.unsqueeze(0)
            elif x.dim() == 0:
                x = x.unsqueeze(0).unsqueeze(0)
                
            # 2. Align edge_index -> must be 2D [2, E]
            if edge_index.dim() == 1:
                edge_index = edge_index.unsqueeze(1)
            elif edge_index.dim() == 2:
                # Transpose if shape is [E, 2] to match [2, E]
                if edge_index.size(1) == 2 and edge_index.size(0) != 2:
                    edge_index = edge_index.t()
                # Transpose if shape is [1, 2] to match [2, 1]
                elif edge_index.size(0) == 1 and edge_index.size(1) == 2:
                    edge_index = edge_index.t()
            elif edge_index.dim() == 0:
                edge_index = edge_index.unsqueeze(0).unsqueeze(0)
                
            # 3. Align edge_attr (edge features) -> must be 2D [E, num_edge_features]
            if edge_attr.dim() == 1:
                edge_attr = edge_attr.unsqueeze(0)
            elif edge_attr.dim() == 0:
                edge_attr = edge_attr.unsqueeze(0).unsqueeze(0)
                
            # 4. Align t (timestamps) -> must be 1D [E]
            if t.dim() == 0:
                t = t.unsqueeze(0)
            elif t.dim() > 1:
                t = t.squeeze()
                if t.dim() == 0:
                    t = t.unsqueeze(0)
            
            # Normalize absolute Unix timestamps (seconds) to relative hours since start (matches training)
            if t.numel() > 0:
                t_min = t.min()
                t = (t - t_min) / 3600.0
            
            print(f"DEBUG ALIGNED SHAPES: x={x.shape}, edge_index={edge_index.shape}, edge_attr={edge_attr.shape}, t={t.shape}", flush=True)
            
            data = Data(
                x=x,
                edge_index=edge_index,
                edge_attr=edge_attr,
                t=t
            )
        
        data = data.to(self.device)
        
        with torch.no_grad():
            logits = self.model(data)
            probabilities = torch.sigmoid(logits).cpu().numpy()
            predictions = (probabilities > 0.5).astype(int)
            scores = logits.cpu().numpy()
        
        return {
            'probabilities': probabilities.tolist(),
            'predictions': predictions.tolist(),
            'scores': scores.tolist()
        }
    
    def predict_batch(self, batch):
        """Predict for a batch of temporal graphs"""
        results = []
        for graph in batch:
            results.append(self.predict(graph))
        return results


# ============================================================================
# FASTAPI SERVICE (For Model Serving)
# ============================================================================

"""
To run the FastAPI service:
1. Install fastapi and uvicorn: pip install fastapi uvicorn
2. Save this as serve.py and run: uvicorn serve:app --reload
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="TGNN Fraud Detection API")

# Load predictor at startup
predictor = TGNNPredictor()


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


# To run: uvicorn serve:app --host 0.0.0.0 --port 8000


# ============================================================================
# MAIN EXECUTION
# ============================================================================

if __name__ == "__main__":
    print("=" * 60)
    print("TGNN Fraud Detection Model")
    print("=" * 60)
    
    # Step 1: Generate synthetic data
    print("\n1. Generating synthetic transaction data...")
    generator = SyntheticDataGenerator()
    node_features = generator.generate_node_features()
    edge_data = generator.generate_transactions()
    pyg_data = generator.to_pyg_data()
    generator.save_to_csv()
    print(f"   Generated {len(edge_data['source'])} transactions")
    print(f"   Fraud rate: {edge_data['label'].mean():.2%}")
    
    # Step 2: Create temporal dataset
    print("\n2. Creating temporal graph dataset...")
    dataset = TransactionDataset(pyg_data, window_size=24, stride=6)
    print(f"   Created {len(dataset)} temporal subgraphs")
    
    # Step 3: Split into train/val/test
    print("\n3. Splitting dataset...")
    train_size = int(0.7 * len(dataset))
    val_size = int(0.15 * len(dataset))
    test_size = len(dataset) - train_size - val_size
    
    train_dataset = dataset.temporal_graphs[:train_size]
    val_dataset = dataset.temporal_graphs[train_size:train_size + val_size]
    test_dataset = dataset.temporal_graphs[train_size + val_size:]
    
    print(f"   Train: {len(train_dataset)}, Val: {len(val_dataset)}, Test: {len(test_dataset)}")
    
    # Step 4: Create data loaders
    train_loader = TemporalDataLoader(train_dataset, batch_size=Config.BATCH_SIZE, shuffle=True)
    val_loader = TemporalDataLoader(val_dataset, batch_size=Config.BATCH_SIZE, shuffle=False)
    test_loader = TemporalDataLoader(test_dataset, batch_size=Config.BATCH_SIZE, shuffle=False)
    
    # Step 5: Initialize model
    print("\n4. Initializing TGNN model...")
    model = TGNN(
        num_node_features=Config.NUM_FEATURES,
        num_edge_features=Config.EDGE_FEATURES,
        hidden_dim=Config.HIDDEN_DIM,
        num_layers=Config.NUM_LAYERS,
        heads=Config.HEADS,
        dropout=Config.DROPOut
    )
    print(f"   Model parameters: {sum(p.numel() for p in model.parameters()):,}")
    
    # Load checkpoint if exists (resume training)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    start_epoch = 0
    checkpoint_files = sorted(
        [f for f in os.listdir(Config.MODEL_DIR) if f.startswith('checkpoint_epoch_')],
        key=lambda x: int(x.split('_')[-1].split('.')[0])
    ) if os.path.exists(Config.MODEL_DIR) else []
    
    if checkpoint_files:
        latest_checkpoint = f"{Config.MODEL_DIR}/{checkpoint_files[-1]}"
        model.load_state_dict(torch.load(latest_checkpoint, map_location=device, weights_only=True))
        start_epoch = int(checkpoint_files[-1].split('_')[-1].split('.')[0])
        print(f"   Resumed from checkpoint: {latest_checkpoint} (epoch {start_epoch})")
    elif os.path.exists(f"{Config.MODEL_DIR}/best_model.pth"):
        model.load_state_dict(torch.load(f"{Config.MODEL_DIR}/best_model.pth", map_location=device, weights_only=True))
        print(f"   Loaded best model from previous run")
    else:
        print("   No checkpoint found. Training from scratch.")
    
    # Step 6: Train model
    remaining_epochs = max(Config.EPOCHS - start_epoch, 0)
    if remaining_epochs > 0:
        print(f"\n5. Training model... ({remaining_epochs} epochs remaining)")
        trainer = TGNNTrainer(model)
        best_model = trainer.train(train_loader, val_loader, epochs=remaining_epochs)
        
        # Check if model has converged
        if len(trainer.train_losses) > 5:
            last_5_losses = trainer.train_losses[-5:]
            if abs(last_5_losses[0] - last_5_losses[-1]) < 0.001:
                print("\nModel has converged! Current epochs are enough.")
            else:
                print("\nModel is still improving. Consider training more epochs.")
    else:
        print(f"\n5. Already trained {start_epoch} epochs (target: {Config.EPOCHS}). Skipping training.")
        trainer = TGNNTrainer(model)
    
    # Step 7: Evaluate on test set
    print("\n" + "=" * 60)
    print("FINAL EVALUATION")
    print("=" * 60)
    test_metrics = trainer.evaluate(test_loader)
    print(f"   Test Loss:      {test_metrics['loss']:.4f}")
    print(f"   Test AUC:       {test_metrics['auc']:.4f}")
    print(f"   Test Precision: {test_metrics['precision']:.4f}")
    print(f"   Test Recall:    {test_metrics['recall']:.4f}")
    print(f"   Test F1:        {test_metrics['f1']:.4f}")
    
    # Step 8: Plot metrics
    if remaining_epochs > 0:
        trainer.plot_metrics()
    
    # Step 9: Save final model
    torch.save(model.state_dict(), f"{Config.MODEL_DIR}/final_model.pth")
    print(f"\n   Model saved to {Config.MODEL_DIR}/final_model.pth")
    
    # Step 10: Test inference with sample predictions
    print("\n" + "=" * 60)
    print("SAMPLE PREDICTIONS")
    print("=" * 60)
    predictor = TGNNPredictor(f"{Config.MODEL_DIR}/final_model.pth")
    
    sample_graph = test_dataset[0]
    result = predictor.predict(sample_graph)
    
    n_show = min(10, len(result['predictions']))
    print(f"\n   First {n_show} transactions:")
    print(f"   {'Idx':<5} {'Prob':>8} {'Pred':>6} {'Actual':>7} {'Result':>8}")
    print(f"   {'-'*5} {'-'*8} {'-'*6} {'-'*7} {'-'*8}")
    for i in range(n_show):
        prob = result['probabilities'][i]
        pred = result['predictions'][i]
        actual = int(sample_graph.y[i].item())
        match = 'OK' if pred == actual else 'MISS'
        label = 'FRAUD' if pred == 1 else 'legit'
        print(f"   {i:<5} {prob:>8.4f} {label:>6} {actual:>7} {match:>8}")
    
    # Summary stats
    total = len(result['predictions'])
    correct = sum(1 for p, a in zip(result['predictions'], sample_graph.y.tolist()) if p == int(a))
    fraud_detected = sum(1 for p, a in zip(result['predictions'], sample_graph.y.tolist()) if p == 1 and int(a) == 1)
    total_fraud = sum(1 for a in sample_graph.y.tolist() if int(a) == 1)
    print(f"\n   Accuracy: {correct}/{total} ({correct/total*100:.1f}%)")
    print(f"   Fraud detected: {fraud_detected}/{total_fraud}")
    
    print("\n" + "=" * 60)
    print("TRAINING COMPLETE!")
    print("=" * 60)
    print(f"\nTo serve via API:")
    print(f"  pip install fastapi uvicorn")
    print(f"  python -m uvicorn serve:app --host 0.0.0.0 --port 8000")