#!/bin/bash

set -e

MODE="fast"
if [[ "$1" == "--full" || "$1" == "full" || "$1" == "-f" ]]; then
	MODE="full"
elif [[ -n "$1" ]]; then
	echo "Unknown option: $1"
	echo "Usage: ./rebuild.sh [--full|-f|full]"
	exit 1
fi

if [[ "$MODE" == "full" ]]; then
	echo "Rebuilding Proverb Guessing Game (clean build)..."
	echo

	# Stop and remove all containers, networks, and images
	echo "Cleaning up existing containers and images..."
	docker-compose down --rmi all --remove-orphans

	# Remove any dangling images
	docker image prune -f

	# Build and start fresh
	echo "Building everything from scratch..."
	docker-compose up --build -d
else
	echo "Rebuilding Proverb Guessing Game (fast rebuild: frontend)..."
	echo

	# Build and restart only app services
	echo "Building app services..."
	docker-compose up --build -d postgres frontend
fi

# Wait a moment for services to start
sleep 10

# Check status
echo
echo "Checking service status..."
docker-compose ps

echo
echo "========================================"
if [[ "$MODE" == "full" ]]; then
	echo "Clean rebuild completed!"
else
	echo "Fast rebuild completed!"
fi
echo "========================================"
echo "Frontend:  http://localhost:3000"
echo "Database:  postgres:5432"
echo "========================================"
echo