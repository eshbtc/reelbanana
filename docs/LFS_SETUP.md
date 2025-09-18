# Git LFS Setup (Optional but Recommended)

This repo contains large media assets (videos, audio, screenshots). To keep the repository lean and fast, we configure Git LFS for common binary types.

## One-time setup

1) Install Git LFS (macOS example):

   brew install git-lfs
   git lfs install

2) Pull LFS files when cloning (new clones do this automatically):

   git lfs pull

## Migrating existing large files (optional)

If large media were committed before LFS rules, you can migrate history. This rewrites history—coordinate with your team before doing this on shared branches.

- Preview which files are large:

  git lfs migrate info --include="*.mp4,*.webm,*.mov,*.mp3,*.png,*.jpg,*.jpeg,*.gif,*.webp"

- Migrate on a feature branch:

  git checkout -b chore/lfs-migrate
  git lfs migrate import --include="*.mp4,*.webm,*.mov,*.mp3,*.png,*.jpg,*.jpeg,*.gif,*.webp"
  git push origin chore/lfs-migrate --force

Open a PR and communicate the change to collaborators.

## Notes

- `.gitattributes` is configured to route the above file types through LFS for future commits.
- `.gitignore` already excludes `dist/` and most test artifacts; LFS rules complement that for tracked media.
- CI/CD and hosting workflows are unaffected by LFS usage in source control.

