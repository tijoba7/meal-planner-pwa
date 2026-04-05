# Mise — Project-wide Agent Instructions

## Git Workflow

After every commit, push to GitHub:

```
git push origin main
```

If the push fails due to divergence, pull with rebase first:

```
git pull --rebase origin main
git push origin main
```

Do not force-push. If rebase conflicts arise, resolve them before pushing.
