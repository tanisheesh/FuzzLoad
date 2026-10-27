FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY cmd/ ./cmd/
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /fuzzload-proxy ./cmd/fuzzload-proxy

FROM alpine:3.20
WORKDIR /app
COPY --from=builder /fuzzload-proxy /app/fuzzload-proxy
EXPOSE 8080 9001 9002 9003 9004
CMD ["/app/fuzzload-proxy"]
