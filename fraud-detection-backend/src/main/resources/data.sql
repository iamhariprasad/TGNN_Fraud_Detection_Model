INSERT IGNORE INTO users (id, username, email, password, first_name, last_name, role, is_active) VALUES 
(1, 'admin', 'admin@fraud.com', '$2a$10$dummyhash', 'Admin', 'User', 'ADMIN', true),
(2, 'analyst1', 'analyst@fraud.com', '$2a$10$dummyhash', 'John', 'Doe', 'ANALYST', true),
(3, 'user1', 'user1@test.com', '$2a$10$dummyhash', 'Jane', 'Smith', 'USER', true);

INSERT IGNORE INTO accounts (id, user_id, account_number, account_type, balance, status) VALUES 
(1, 3, 'ACC100000001', 'PERSONAL', 50000.00, 'ACTIVE'),
(2, 3, 'ACC100000002', 'BUSINESS', 150000.00, 'ACTIVE'),
(3, 1, 'ACC100000003', 'MERCHANT', 500000.00, 'ACTIVE');
