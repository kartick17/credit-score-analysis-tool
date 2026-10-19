package com.creditrisk.assessment.access;

import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AccessController {
  @GetMapping("/api/v1/assessments/access")
  public Access access(@AuthenticationPrincipal Jwt jwt) {
    List<String> roles = jwt.getClaimAsStringList("roles");
    if (roles == null) roles = List.of();
    String branch = jwt.getClaimAsString("branch_id");
    boolean officer = roles.contains("OFFICER") && branch != null && branch.matches("BR-[0-9]{3}");
    boolean manager = roles.contains("CREDIT_MANAGER");
    return new Access(
        jwt.getSubject(),
        roles.stream()
            .filter(role -> List.of("OFFICER", "CREDIT_MANAGER", "PLATFORM_ADMIN").contains(role))
            .toList(),
        branch,
        officer || manager,
        officer || manager);
  }

  public record Access(
      String subject, List<String> roles, String branchId, boolean canRead, boolean canWrite) {}
}
