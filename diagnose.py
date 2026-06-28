"""Deep diagnostic: why val precision=0 even after gradient fix."""
import torch, sys, numpy as np
sys.stdout.reconfigure(encoding='utf-8')
from tgnn_fraud_detection import *

Config.NUM_TRANSACTIONS = 2000

gen = SyntheticDataGenerator(num_transactions=2000)
gen.generate_node_features()
gen.generate_transactions()
pyg_data = gen.to_pyg_data()
dataset = TransactionDataset(pyg_data, window_size=24, stride=6)

train_data = dataset.temporal_graphs[:int(0.7*len(dataset))]
val_data = dataset.temporal_graphs[int(0.7*len(dataset)):int(0.85*len(dataset))]

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
model = TGNN().to(device)

# Train 5 epochs with small batch
train_loader = TemporalDataLoader(train_data, batch_size=8, shuffle=True)
val_loader = TemporalDataLoader(val_data, batch_size=8, shuffle=False)
trainer = TGNNTrainer(model)

# Manually train 5 epochs
for epoch in range(5):
    train_loss, train_auc = trainer.train_epoch(train_loader)
    print(f"\nEpoch {epoch+1}: Train Loss={train_loss:.4f}, Train AUC={train_auc:.4f}")

# Now analyze val predictions in detail
print("\n" + "="*60)
print("VAL PREDICTION ANALYSIS")
print("="*60)

model.eval()
all_probs = []
all_labels = []
with torch.no_grad():
    for graph in val_data:
        graph = graph.to(device)
        logits = model(graph)
        probs = torch.sigmoid(logits).cpu().numpy()
        labels = graph.y.cpu().numpy()
        all_probs.extend(probs.tolist())
        all_labels.extend(labels.tolist())

all_probs = np.array(all_probs)
all_labels = np.array(all_labels)

print(f"\nTotal val samples: {len(all_labels)}")
print(f"Val fraud: {int(all_labels.sum())} ({all_labels.mean()*100:.1f}%)")
print(f"Val legit: {int((1-all_labels).sum())} ({(1-all_labels).mean()*100:.1f}%)")

print(f"\nProbability stats:")
print(f"  Overall: min={all_probs.min():.4f}, max={all_probs.max():.4f}, mean={all_probs.mean():.4f}, std={all_probs.std():.4f}")
print(f"  Fraud samples:  min={all_probs[all_labels==1].min():.4f}, max={all_probs[all_labels==1].max():.4f}, mean={all_probs[all_labels==1].mean():.4f}")
print(f"  Legit samples:  min={all_probs[all_labels==0].min():.4f}, max={all_probs[all_labels==0].max():.4f}, mean={all_probs[all_labels==0].mean():.4f}")

for t in [0.1, 0.2, 0.3, 0.4, 0.5]:
    preds = (all_probs > t).astype(int)
    tp = ((preds == 1) & (all_labels == 1)).sum()
    fp = ((preds == 1) & (all_labels == 0)).sum()
    fn = ((preds == 0) & (all_labels == 1)).sum()
    tn = ((preds == 0) & (all_labels == 0)).sum()
    prec = tp / max(tp + fp, 1)
    rec = tp / max(tp + fn, 1)
    print(f"\n  Threshold {t}: TP={tp}, FP={fp}, FN={fn}, TN={tn}, Prec={prec:.4f}, Rec={rec:.4f}")

# Check: does the model output vary at all?
print(f"\nHistogram of probabilities (10 bins):")
counts, edges = np.histogram(all_probs, bins=10)
for i in range(len(counts)):
    print(f"  [{edges[i]:.3f}, {edges[i+1]:.3f}): {counts[i]}")

# Check if node features for fraud-connected nodes differ
print("\n" + "="*60)
print("NODE FEATURE ANALYSIS")
print("="*60)
print("Node features are RANDOM and NOT correlated with fraud.")
print("Fraud is an EDGE property but nodes are shared between")
print("fraud and legit edges. The model can only use edge features")
print("to distinguish fraud, but TransformerConv aggregates node")
print("features via message passing. The edge_attr is used but")
print("the signal may be diluted by the node aggregation.")

# Check what happens with a simple edge-feature-only classifier
print("\n" + "="*60)
print("BASELINE: Edge features only (no GNN)")
print("="*60)
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report

# Collect all edge features and labels from train/val
train_feats, train_labels = [], []
for g in train_data:
    train_feats.append(g.edge_attr.numpy())
    train_labels.append(g.y.numpy())
train_feats = np.concatenate(train_feats)
train_labels = np.concatenate(train_labels)

val_feats, val_labels = [], []
for g in val_data:
    val_feats.append(g.edge_attr.numpy())
    val_labels.append(g.y.numpy())
val_feats = np.concatenate(val_feats)
val_labels = np.concatenate(val_labels)

lr = LogisticRegression(max_iter=1000, class_weight='balanced')
lr.fit(train_feats, train_labels)
lr_preds = lr.predict(val_feats)
lr_probs = lr.predict_proba(val_feats)[:, 1]

from sklearn.metrics import roc_auc_score
print(f"Logistic Regression AUC: {roc_auc_score(val_labels, lr_probs):.4f}")
print(classification_report(val_labels, lr_preds, zero_division=0))
