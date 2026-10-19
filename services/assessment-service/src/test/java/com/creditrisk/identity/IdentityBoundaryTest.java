package com.creditrisk.identity;

import static org.assertj.core.api.Assertions.assertThat;

import com.creditrisk.assessment.access.AccessController;
import com.creditrisk.assessment.config.SecurityConfig;
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.*;
import com.sun.net.httpserver.HttpServer;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.web.bind.annotation.*;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class IdentityBoundaryTest {
  private RSAKey key;
  private HttpServer issuer;
  private ConfigurableApplicationContext app;
  private HttpClient client;
  private String base;
  private String issuerUrl;

  @BeforeAll
  void start() throws Exception {
    key = new RSAKeyGenerator(2048).keyID("local-key").generate();
    issuer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    issuer.createContext(
        "/jwks",
        exchange -> {
          byte[] body = new JWKSet(key.toPublicJWK()).toString().getBytes(StandardCharsets.UTF_8);
          exchange.getResponseHeaders().set("Content-Type", "application/json");
          exchange.sendResponseHeaders(200, body.length);
          exchange.getResponseBody().write(body);
          exchange.close();
        });
    issuer.start();
    issuerUrl = "http://127.0.0.1:" + issuer.getAddress().getPort();
    app =
        new SpringApplicationBuilder(ProbeApplication.class)
            .run(
                "--server.port=0",
                "--management.endpoint.health.group.readiness.include=readinessState",
                "--spring.security.oauth2.resourceserver.jwt.issuer-uri=" + issuerUrl,
                "--spring.security.oauth2.resourceserver.jwt.jwk-set-uri=" + issuerUrl + "/jwks");
    base = "http://127.0.0.1:" + app.getEnvironment().getProperty("local.server.port");
    client = HttpClient.newHttpClient();
  }

  @AfterAll
  void stop() {
    if (client != null) client.close();
    if (app != null) app.close();
    if (issuer != null) issuer.stop(0);
  }

  private String token(
      String iss,
      String aud,
      Instant expiry,
      Instant before,
      List<String> roles,
      String branch,
      RSAKey signingKey)
      throws Exception {
    var claims =
        new JWTClaimsSet.Builder()
            .subject("sample-staff")
            .issuer(iss)
            .audience(aud)
            .issueTime(Date.from(Instant.now().minusSeconds(5)))
            .expirationTime(Date.from(expiry))
            .notBeforeTime(Date.from(before))
            .claim("roles", roles);
    if (branch != null) claims.claim("branch_id", branch);
    var jwt =
        new SignedJWT(
            new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.getKeyID()).build(),
            claims.build());
    jwt.sign(new RSASSASigner(signingKey));
    return jwt.serialize();
  }

  private String staff(List<String> roles, String branch) throws Exception {
    return token(
        issuerUrl,
        "credit-risk-api",
        Instant.now().plusSeconds(300),
        Instant.now().minusSeconds(5),
        roles,
        branch,
        key);
  }

  private HttpResponse<String> call(String path, String token, String method) throws Exception {
    var request =
        HttpRequest.newBuilder(URI.create(base + path))
            .header("X-User-Id", "forged-user")
            .header("X-User-Roles", "CREDIT_MANAGER")
            .header("X-Branch-Id", "BR-002")
            .method(method, HttpRequest.BodyPublishers.noBody());
    if (token != null) request.header("Authorization", "Bearer " + token);
    return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
  }

  @Test
  void rejectsMissingAndUntrustedTokens() throws Exception {
    assertThat(call("/api/v1/assessments/probe", null, "GET").statusCode()).isEqualTo(401);
    assertThat(call("/api/v1/assessments/probe", "broken", "GET").statusCode()).isEqualTo(401);
    for (var token :
        List.of(
            token(
                "https://wrong.invalid",
                "credit-risk-api",
                Instant.now().plusSeconds(300),
                Instant.now().minusSeconds(5),
                List.of("OFFICER"),
                "BR-001",
                key),
            token(
                issuerUrl,
                "other-api",
                Instant.now().plusSeconds(300),
                Instant.now().minusSeconds(5),
                List.of("OFFICER"),
                "BR-001",
                key),
            token(
                issuerUrl,
                "credit-risk-api",
                Instant.now().minusSeconds(180),
                Instant.now().minusSeconds(300),
                List.of("OFFICER"),
                "BR-001",
                key),
            token(
                issuerUrl,
                "credit-risk-api",
                Instant.now().plusSeconds(900),
                Instant.now().plusSeconds(300),
                List.of("OFFICER"),
                "BR-001",
                key),
            token(
                issuerUrl,
                "credit-risk-api",
                Instant.now().plusSeconds(300),
                Instant.now().minusSeconds(5),
                List.of("OFFICER"),
                "BR-001",
                new RSAKeyGenerator(2048).generate()))) {
      assertThat(call("/api/v1/assessments/probe", token, "GET").statusCode()).isEqualTo(401);
    }
  }

  @Test
  void healthIsPublicAndOtherManagementPathsArePrivate() throws Exception {
    assertThat(call("/actuator/health/liveness", null, "GET").statusCode()).isEqualTo(200);
    assertThat(call("/actuator/info", staff(List.of("PLATFORM_ADMIN"), null), "GET").statusCode())
        .isEqualTo(403);
    assertThat(call("/internal/anything", staff(List.of("OFFICER"), "BR-001"), "GET").statusCode())
        .isEqualTo(403);
  }

  @Test
  void grantsOnlyStaffWithTheRightRoleAndBranch() throws Exception {
    assertThat(
            call("/api/v1/assessments/probe", staff(List.of("OFFICER"), "BR-001"), "GET")
                .statusCode())
        .isEqualTo(204);
    assertThat(
            call("/api/v1/assessments/probe", staff(List.of("CREDIT_MANAGER"), null), "GET")
                .statusCode())
        .isEqualTo(204);
    assertThat(
            call("/api/v1/assessments/probe", staff(List.of("PLATFORM_ADMIN"), null), "GET")
                .statusCode())
        .isEqualTo(403);
    assertThat(call("/api/v1/assessments/probe", staff(List.of(), "BR-001"), "GET").statusCode())
        .isEqualTo(403);
    assertThat(
            call("/api/v1/assessments/probe", staff(List.of("OFFICER"), null), "GET").statusCode())
        .isEqualTo(403);
    assertThat(
            call("/api/v1/assessments/probe", staff(List.of("OFFICER"), "ANYWHERE"), "GET")
                .statusCode())
        .isEqualTo(403);
  }

  @Test
  void reportsTrustedIdentityAndSeparatesWritePermissions() throws Exception {
    var officer = staff(List.of("OFFICER"), "BR-001");
    var response = call("/api/v1/assessments/access", officer, "GET");
    assertThat(response.statusCode()).isEqualTo(200);
    assertThat(response.body())
        .contains("sample-staff", "BR-001")
        .doesNotContain("forged-user", "BR-002");
    assertThat(call("/api/v1/assessments/probe", officer, "POST").statusCode()).isEqualTo(204);
    assertThat(
            call("/api/v1/assessments/probe", staff(List.of("CREDIT_MANAGER"), null), "POST")
                .statusCode())
        .isEqualTo(204);
    var admin = call("/api/v1/assessments/access", staff(List.of("PLATFORM_ADMIN"), null), "GET");
    assertThat(admin.statusCode()).isEqualTo(200);
    assertThat(admin.body()).contains("\"canRead\":false", "\"canWrite\":false");
  }

  @Configuration(proxyBeanMethods = false)
  @EnableAutoConfiguration(
      excludeName = {
        "org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration",
        "org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration",
        "org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration"
      })
  @Import({SecurityConfig.class, AccessController.class, ProbeController.class})
  static class ProbeApplication {}

  @RestController
  static class ProbeController {
    @RequestMapping(
        path = "/api/v1/assessments/probe",
        method = {RequestMethod.GET, RequestMethod.POST})
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    void probe() {}
  }
}
