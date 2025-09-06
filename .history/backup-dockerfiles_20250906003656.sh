#!/bin/bash

# Backup script for Dockerfiles to prevent AI Studio from overwriting them
echo "Backing up Dockerfiles..."

# Create backup directory
mkdir -p dockerfile-backups

# Backup each Dockerfile with timestamp
timestamp=$(date +"%Y%m%d_%H%M%S")

cp backend/upload-assets/Dockerfile dockerfile-backups/upload-assets_Dockerfile_$timestamp
cp backend/narrate/Dockerfile dockerfile-backups/narrate_Dockerfile_$timestamp
cp backend/align-captions/Dockerfile dockerfile-backups/align-captions_Dockerfile_$timestamp
cp backend/render/Dockerfile dockerfile-backups/render_Dockerfile_$timestamp

echo "Dockerfiles backed up to dockerfile-backups/ with timestamp: $timestamp"
