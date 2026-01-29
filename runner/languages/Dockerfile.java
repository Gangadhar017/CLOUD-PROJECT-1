FROM eclipse-temurin:17-jdk-alpine

RUN apk add --no-cache \
    bash

WORKDIR /workspace

RUN adduser -D -u 1000 runner && \
    chown -R runner:runner /workspace

USER runner

ENV PATH=/opt/java/openjdk/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ENV HOME=/tmp
ENV JAVA_TOOL_OPTIONS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"
