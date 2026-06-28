package com.fraud.repository;

import com.fraud.model.FraudAlert;
import com.fraud.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AlertRepository extends JpaRepository<FraudAlert, Long> {
    List<FraudAlert> findByStatus(FraudAlert.AlertStatus status);
    List<FraudAlert> findByAssignedTo(User user);
    List<FraudAlert> findBySeverity(FraudAlert.Severity severity);
    Page<FraudAlert> findByStatusOrderByCreatedAtDesc(FraudAlert.AlertStatus status, Pageable pageable);
    Long countByStatus(FraudAlert.AlertStatus status);
}
