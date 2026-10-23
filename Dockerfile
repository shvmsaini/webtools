# Single image for the Operations Console: builds the React UI, builds the
# Spring Boot backend, and serves the UI as static content from the backend
# on port 8080 (same origin, so the UI's default relative /api calls work).
#
# Build from this directory (webtools/):
#   docker build -t ops-console .
# Run:
#   docker run -p 8080:8080 -v ops-wallpapers:/app/data/wallpapers ops-console
#   open http://localhost:8080

# ---------- Stage 1: UI ----------
FROM node:20-alpine AS ui-build
WORKDIR /src/ops-console-ui

COPY ops-console-ui/package.json ops-console-ui/package-lock.json ./
RUN npm ci

COPY ops-console-ui/ ./
RUN npm run build

# ---------- Stage 2: backend ----------
FROM maven:3.9-eclipse-temurin-17 AS server-build
WORKDIR /src/server

COPY ops-console/server/pom.xml ./
RUN mvn -q dependency:go-offline

COPY ops-console/server/src ./src
# Bundle the built UI into the jar so Spring serves it from classpath:/static/
COPY --from=ui-build /src/ops-console-ui/dist/ ./src/main/resources/static/
RUN mvn -q -DskipTests package

# ---------- Stage 3: runtime ----------
FROM eclipse-temurin:17-jre
WORKDIR /app

RUN useradd --system --create-home opsconsole \
    && mkdir -p /app/data/wallpapers \
    && chown -R opsconsole:opsconsole /app/data

COPY --from=server-build /src/server/target/ops-console-1.0.0.jar /app/app.jar

USER opsconsole
EXPOSE 8080

ENV JAVA_OPTS="-Xmx512m"
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -Dops.console.wallpaper.dir=/app/data/wallpapers -jar /app/app.jar"]
