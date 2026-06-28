# Deployment Guide

## 🌐 Deployment Options

### Option 1: Local Development
Follow the [Quick Start](#quick-start) in README.md

### Option 2: Docker Deployment

#### Build Docker Images

1. **Python Model:**
   ```bash
   cd TGNN_Fraud_Detection_Model
   docker build -t tgnn-model -f Dockerfile.model .
   ```

2. **Spring Boot Backend:**
   ```bash
   cd fraud-detection-backend
   docker build -t fraud-backend .
   ```

3. **React Frontend:**
   ```bash
   cd fraud-frontend
   docker build -t fraud-frontend .
   ```

#### Run with Docker Compose
Create a `docker-compose.yml` file:
```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: fraud-mysql
    environment:
      MYSQL_ROOT_PASSWORD: yourpassword
      MYSQL_DATABASE: fraud_detection
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - fraud-network

  model-api:
    image: tgnn-model
    container_name: fraud-model
    ports:
      - "8000:8000"
    depends_on:
      - mysql
    networks:
      - fraud-network

  backend:
    image: fraud-backend
    container_name: fraud-backend
    ports:
      - "8080:8080"
    depends_on:
      - mysql
      - model-api
    environment:
      - SPRING_DATASOURCE_URL=jdbc:mysql://mysql:3306/fraud_detection
      - SPRING_DATASOURCE_USERNAME=root
      - SPRING_DATASOURCE_PASSWORD=yourpassword
      - MODEL_API_URL=http://model-api:8000/predict
    networks:
      - fraud-network

  frontend:
    image: fraud-frontend
    container_name: fraud-frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend
    networks:
      - fraud-network

volumes:
  mysql_data:

networks:
  fraud-network:
    driver: bridge
```

Then run:
```bash
docker-compose up -d
```

### Access:
* **Frontend**: `http://localhost:3000`
* **Backend**: `http://localhost:8080`
* **Model**: `http://localhost:8000`
