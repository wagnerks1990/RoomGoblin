# GitHub Wiki synchronization

The repository `wiki/` directory is the authoritative tracked mirror. The
`Sync Wiki` workflow publishes it after relevant changes to `main` and supports
manual dispatch.

Configure the repository Actions secret `WIKI_TOKEN` with permission to push
this repository's Wiki. The workflow prefers it over the legacy `WIKI_PUSH_TOKEN`
and automatic GitHub token for both clone and push. Temporary askpass helpers
read the step environment, keeping credentials out of Git arguments and remote
configuration; each helper is removed on success or failure.

Create the initial Wiki page through GitHub if the Wiki Git repository has not
yet been initialized. Keep secrets and private classroom data out of the mirror;
files absent from the mirror are removed during synchronization.

See `docs/WIKI-SYNC.md` in the main repository for local synchronization and the
full documentation contract.
