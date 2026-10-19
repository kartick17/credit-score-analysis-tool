package com.creditrisk.customerdata.audit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** Foundation mapping only. Business audit writes arrive with the owning use cases. */
@Entity
@Table(name = "audit_entries")
public class AuditEntry {
  @Id private UUID id;

  @Column(name = "actor_id", nullable = false, length = 200)
  private String actorId;

  @Column(nullable = false, length = 80)
  private String action;

  @Column(name = "resource_id")
  private UUID resourceId;

  @Column(nullable = false, length = 30)
  private String outcome;

  @Column(name = "occurred_at", nullable = false)
  private Instant occurredAt;

  protected AuditEntry() {}
}
