FROM golang:1.22-alpine

RUN apk add --no-cache \
    gcc \
    musl-dev \
    linux-headers

WORKDIR /workspace

RUN adduser -D -u 1000 runner && \
    chown -R runner:runner /workspace

USER runner

ENV PATH=/usr/local/go/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ENV HOME=/tmp
ENV GOPATH=/tmp/go
ENV GOCACHE=/tmp/go-cache
