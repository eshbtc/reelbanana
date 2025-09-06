
#!/bin/bash

# Restore script for Dockerfiles after AI Studio overwrites them
echo "Restoring Dockerfiles from backup..."

# Find the most recent backup
latest_backup=$(ls -t dockerfile-backups/ | head -1 | cut -d'_' -f1-2)

if [ -z "$latest_backup" ]; then
    echo "No backups found! Please run backup-dockerfiles.sh first."
    exit 1
fi

echo "Restoring from backup: $latest_backup"

# Restore each Dockerfile
cp dockerfile-backups/${latest_backup}_upload-assets_Dockerfile_* backend/upload-assets/Dockerfile
cp dockerfile-backups/${latest_backup}_narrate_Dockerfile_* backend/narrate/Dockerfile
cp dockerfile-backups/${latest_backup}_align-captions_Dockerfile_* backend/align-captions/Dockerfile
cp dockerfile-backups/${latest_backup}_render_Dockerfile_* backend/render/Dockerfile

echo "Dockerfiles restored successfully!"
