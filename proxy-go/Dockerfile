FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY pkg/ ./pkg/
COPY cmd/ ./cmd/
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /fuzzload-proxy ./cmd/fuzzload-proxy

FROM alpine:3.24
WORKDIR /app
COPY --from=builder /fuzzload-proxy /app/fuzzload-proxy
EXPOSE 8080 9001 9002 9003 9004
ENTRYPOINT ["/app/fuzzload-proxy"]
CMD ["--port", "8080", "--spawn-workers=true", "--loadgen-rps=120"]
