# syntax=docker/dockerfile:1
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml ./
RUN mvn --batch-mode dependency:go-offline
COPY src ./src
RUN mvn --batch-mode package -Dmaven.test.skip=true

FROM eclipse-temurin:17-jre-alpine
RUN apk add --no-cache curl && addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build --chown=app:app /app/target/sareevelo-backend-0.0.1-SNAPSHOT.jar /app/app.jar
USER app
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70.0"
EXPOSE 9090
HEALTHCHECK --interval=20s --timeout=5s --start-period=60s --retries=5 CMD curl --fail --silent http://127.0.0.1:9090/api/v1/health > /dev/null || exit 1
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
