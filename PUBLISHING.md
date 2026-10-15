# GitHub Pages publishing

Target repository: https://github.com/dreamcan/dreamcan.github.io
Target website: https://dreamcan.github.io/

The publish checkout contains the DreamCan website and its assets (about 364 MiB).
Legacy 4DCodeBench video collections and offline outputs are retained in the original
workspace and excluded from this publish checkout.

The current SSH account is HeegerGao. GitHub rejected write access to this repository.
Grant that account repository write access and accept the invitation, or configure
an authorized SSH identity before pushing:

```sh
cd /home/gck/Desktop/dreamcan-pages-publish
git push origin main
```

The workflow `.github/workflows/pages.yml` enables and deploys GitHub Pages on push.
If automatic enablement is refused, a repository administrator must select
Settings → Pages → Build and deployment → Source → GitHub Actions and rerun it.

This checkout starts from the existing remote main branch; publishing does not
require a force push. If main changes before publishing, fetch and integrate it first.
