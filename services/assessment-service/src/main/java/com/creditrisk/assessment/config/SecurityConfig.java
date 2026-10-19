package com.creditrisk.assessment.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {
  @Bean
  SecurityFilterChain security(HttpSecurity http) throws Exception {
    var roles = new JwtGrantedAuthoritiesConverter();
    roles.setAuthoritiesClaimName("roles");
    roles.setAuthorityPrefix("ROLE_");
    var converter = new JwtAuthenticationConverter();
    converter.setJwtGrantedAuthoritiesConverter(roles);
    return http.csrf(csrf -> csrf.disable())
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .requestCache(cache -> cache.disable())
        .authorizeHttpRequests(
            a ->
                a.requestMatchers(
                        "/actuator/health",
                        "/actuator/health/liveness",
                        "/actuator/health/readiness")
                    .permitAll()
                    .requestMatchers(HttpMethod.GET, "/api/v1/assessments/access")
                    .authenticated()
                    .requestMatchers("/api/v1/assessments", "/api/v1/assessments/**")
                    .access(
                        (authentication, context) -> {
                          var actor = authentication.get();
                          if (!(actor instanceof JwtAuthenticationToken jwt))
                            return new AuthorizationDecision(false);
                          var authorities =
                              actor.getAuthorities().stream().map(Object::toString).toList();
                          var branch = jwt.getToken().getClaimAsString("branch_id");
                          boolean officer =
                              authorities.contains("ROLE_OFFICER")
                                  && branch != null
                                  && branch.matches("BR-[0-9]{3}");
                          boolean manager = authorities.contains("ROLE_CREDIT_MANAGER");
                          boolean read = context.getRequest().getMethod().equals("GET");
                          return new AuthorizationDecision(
                              (read || context.getRequest().getMethod().equals("POST"))
                                  && (officer || manager));
                        })
                    .anyRequest()
                    .denyAll())
        .oauth2ResourceServer(o -> o.jwt(j -> j.jwtAuthenticationConverter(converter)))
        .build();
  }
}
