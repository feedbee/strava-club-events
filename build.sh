#!/bin/bash
set -e

# Configuration
IMAGE_NAME="feedbee/strava-club-events"
TAG="latest"
PLATFORMS="linux/amd64,linux/arm64"

# Build the multi-architecture image
echo "🚀 Building multi-architecture image..."
docker buildx create --use
docker buildx build \
  --platform ${PLATFORMS} \
  -t ${IMAGE_NAME}:${TAG} \
  --push \
  .

echo "✅ Build and push complete!"
echo "Image: ${IMAGE_NAME}:${TAG}"
