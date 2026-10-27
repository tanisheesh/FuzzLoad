# Multi-Stage Unified Dockerfile (Go Data Plane + Python AI Control Plane)
# Ideal for Render Free Web Service or single-container AWS deployment.

FROM golang:1.22-alpine AS go-builder
WORKDIR /go-src
COPY proxy-go/go.mod ./
COPY proxy-go/cmd/ ./cmd/
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /fuzzload-proxy ./cmd/fuzzload-proxy

FROM python:3.12-slim
WORKDIR /app

COPY --from=go-builder /fuzzload-proxy /usr/local/bin/fuzzload-proxy
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app

RUN printf '#!/bin/sh\n/usr/local/bin/fuzzload-proxy &\nexec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}\n' > /start.sh \
    && chmod +x /start.sh

EXPOSE 8000 8080
CMD ["/start.sh"]
