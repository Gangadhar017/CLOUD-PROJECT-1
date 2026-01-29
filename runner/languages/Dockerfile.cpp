FROM gcc:13-alpine

RUN apk add --no-cache \
    musl-dev \
    linux-headers

WORKDIR /workspace

RUN adduser -D -u 1000 runner && \
    chown -R runner:runner /workspace

USER runner

ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ENV HOME=/tmp
