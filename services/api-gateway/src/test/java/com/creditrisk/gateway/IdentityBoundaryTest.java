package com.creditrisk.gateway;

import static org.assertj.core.api.Assertions.assertThat;

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
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class IdentityBoundaryTest {
  private RSAKey key;
  private HttpServer issuer;
  private HttpServer target;
  private ConfigurableApplicationContext app;
  private HttpClient client;
  private String base;
  private volatile String forwarded;
  private volatile boolean forged;
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
    target = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    target.createContext(
        "/",
        exchange -> {
          forwarded = exchange.getRequestHeaders().getFirst("Authorization");
          forged =
              exchange.getRequestHeaders().containsKey("X-User-Id")
                  || exchange.getRequestHeaders().containsKey("X-User-Roles")
                  || exchange.getRequestHeaders().containsKey("X-Branch-Id");
          exchange.sendResponseHeaders(204, -1);
          exchange.close();
        });
    target.start();
    var targetUrl = "http://127.0.0.1:" + target.getAddress().getPort();
    app =
        new SpringApplicationBuilder(GatewayApplication.class)
            .run(
                "--server.port=0",
                "--spring.security.oauth2.resourceserver.jwt.issuer-uri=" + issuerUrl,
                "--spring.security.oauth2.resourceserver.jwt.jwk-set-uri=" + issuerUrl + "/jwks",
                "--spring.cloud.gateway.server.webflux.routes[0].id=customers",
                "--spring.cloud.gateway.server.webflux.routes[0].uri=" + targetUrl,
                "--spring.cloud.gateway.server.webflux.routes[0].predicates[0]=Path=/api/v1/customers,/api/v1/customers/**",
                "--spring.cloud.gateway.server.webflux.routes[1].id=assessments",
                "--spring.cloud.gateway.server.webflux.routes[1].uri=" + targetUrl,
                "--spring.cloud.gateway.server.webflux.routes[1].predicates[0]=Path=/api/v1/assessments,/api/v1/assessments/**",
                "--spring.cloud.gateway.server.webflux.routes[2].id=reports",
                "--spring.cloud.gateway.server.webflux.routes[2].uri=" + targetUrl,
                "--spring.cloud.gateway.server.webflux.routes[2].predicates[0]=Path=/api/v1/reports,/api/v1/reports/**");
    base = "http://127.0.0.1:" + app.getEnvironment().getProperty("local.server.port");
    client = HttpClient.newHttpClient();
  }

  @AfterAll
  void stop() {
    if (client != null) client.close();
    if (app != null) app.close();
    if (issuer != null) issuer.stop(0);
    if (target != null) target.stop(0);
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
    assertThat(call("/api/v1/customers/probe", null, "GET").statusCode()).isEqualTo(401);
    assertThat(call("/api/v1/customers/probe", "broken", "GET").statusCode()).isEqualTo(401);
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
      assertThat(call("/api/v1/customers/probe", token, "GET").statusCode()).isEqualTo(401);
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
  void routesOnlyBusinessPathsAndRemovesForgedIdentity() throws Exception {
    var token = staff(List.of("OFFICER"), "BR-001");
    for (String path :
        List.of("/api/v1/customers", "/api/v1/assessments/probe", "/api/v1/reports/probe")) {
      assertThat(call(path, token, "GET").statusCode()).isEqualTo(204);
      assertThat(forwarded).isEqualTo("Bearer " + token);
      assertThat(forged).isFalse();
    }
    assertThat(call("/api/v1/operations/replay", token, "POST").statusCode()).isEqualTo(403);
  }
}
