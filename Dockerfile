# go-quai for StartOS: built from a pinned upstream tag.
# The tag is passed from startos/manifest/index.ts (images['go-quai'].source.dockerBuild.buildArgs).
ARG GO_QUAI_VERSION=v0.56.0

# Upstream's own Dockerfile uses golang:1.23, but go.mod declares `go 1.24`,
# so build with 1.24 directly instead of relying on a toolchain download.
FROM golang:1.24-alpine AS builder
ARG GO_QUAI_VERSION
RUN apk add --no-cache git make gcc musl-dev
WORKDIR /src
RUN git clone --depth 1 --branch "${GO_QUAI_VERSION}" https://github.com/dominant-strategies/go-quai.git .
RUN go mod download && make go-quai

# Dashboard server and stats collector (standard library only, no network needed)
COPY dashboard /dash
RUN cd /dash && CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o /dash/quai-dashboard .

FROM alpine:3.22
RUN apk add --no-cache ca-certificates curl tar zstd

# go-quai reads VERSION and params/*.json relative to its working directory,
# and writes ./nodelogs there too. Keep the binary's files together in
# /opt/go-quai and send nodelogs to the persistent volume.
WORKDIR /opt/go-quai
COPY --from=builder /src/build/bin/go-quai /usr/local/bin/go-quai
COPY --from=builder /src/VERSION ./VERSION
COPY --from=builder /src/params/genesis_alloc.json ./params/genesis_alloc.json
COPY --from=builder /src/params/forfeiture_addresses.json ./params/forfeiture_addresses.json
RUN ln -s /data/nodelogs /opt/go-quai/nodelogs

COPY --from=builder /dash/quai-dashboard /usr/local/bin/quai-dashboard
COPY dashboard/index.html /opt/dashboard/index.html
COPY dashboard/fonts /opt/dashboard/fonts

COPY docker_entrypoint.sh /usr/local/bin/docker_entrypoint.sh
COPY bootstrap.sh /usr/local/bin/bootstrap.sh
RUN chmod +x /usr/local/bin/docker_entrypoint.sh /usr/local/bin/bootstrap.sh /usr/local/bin/go-quai /usr/local/bin/quai-dashboard
