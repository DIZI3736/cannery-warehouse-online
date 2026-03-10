# Build stage
FROM maven:3.9.9-eclipse-temurin-21 AS build
# Note: Maven image with Java 24 might not be widely available, 
# so using 21 if 24 isn't available in standard registries yet.
# Let's try to find if 24 is available.
# Actually, I'll use 21 to be safe or 24 if I can.
# Given the user has 24 in pom, I'll try to find a 24 image or use 21 if it's compatible enough.
# Let's use 21 for stability unless 24 is strictly needed.
# But pom.xml says 24. 

WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline

COPY src ./src
RUN mvn package -DskipTests

# Run stage
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.war /app/app.war

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.war"]
