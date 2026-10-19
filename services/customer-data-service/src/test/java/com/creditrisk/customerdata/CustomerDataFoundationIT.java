package com.creditrisk.customerdata;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.DriverManager;
import org.junit.jupiter.api.Test;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.testcontainers.postgresql.PostgreSQLContainer;

class CustomerDataFoundationIT {
  @Test
  void migrationsReadinessAndRestart() throws Exception {
    try (var db = new PostgreSQLContainer("postgres:17.11")) {
      db.start();
      try (var connection =
              DriverManager.getConnection(db.getJdbcUrl(), db.getUsername(), db.getPassword());
          var sql = connection.createStatement()) {
        for (int startup = 0; startup < 2; startup++) {
          try (var app =
              new SpringApplicationBuilder(CustomerDataApplication.class)
                  .run(
                      "--server.port=0",
                      "--spring.datasource.url=" + db.getJdbcUrl(),
                      "--spring.datasource.username=" + db.getUsername(),
                      "--spring.datasource.password=" + db.getPassword())) {
            var port = app.getEnvironment().getProperty("local.server.port");
            try (var client = HttpClient.newHttpClient()) {
              var response =
                  client.send(
                      HttpRequest.newBuilder(
                              URI.create("http://127.0.0.1:" + port + "/actuator/health/readiness"))
                          .build(),
                      HttpResponse.BodyHandlers.ofString());
              assertThat(response.statusCode()).isEqualTo(200);
              assertThat(response.body()).contains("UP");
            }
            try (var rows =
                sql.executeQuery(
                    "SELECT count(*) FROM flyway_schema_history WHERE success AND version='1'")) {
              rows.next();
              assertThat(rows.getInt(1)).isEqualTo(1);
            }
            if (startup == 0)
              sql.executeUpdate(
                  "INSERT INTO audit_entries(id,actor_id,action,outcome) VALUES ('00000000-0000-0000-0000-000000000001','synthetic-test','FOUNDATION_TEST','SUCCESS')");
            try (var rows = sql.executeQuery("SELECT count(*) FROM audit_entries")) {
              rows.next();
              assertThat(rows.getInt(1)).isEqualTo(1);
            }
          }
        }
      }
    }
  }
}
