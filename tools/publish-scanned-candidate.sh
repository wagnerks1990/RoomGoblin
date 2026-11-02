#!/usr/bin/env bash
set -euo pipefail

[[ $# == 3 && "$1" =~ ^[0-9a-f]{40}$ ]] || { echo 'Expected commit and two exact image tags' >&2; exit 2; }
revision=$1
shift
candidate=''
verify_image() {
  local image=$1 identity observed
  [[ "$image" == *":sha-$revision" ]] || { echo 'Image tag does not match commit' >&2; return 1; }
  identity=$(docker image inspect --format '{{.Id}}' "$image")
  observed=$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$image")
  [[ -n "$identity" && "$observed" == "$revision" ]] || { echo 'Image revision mismatch' >&2; return 1; }
  if [[ -z "$candidate" ]]; then candidate=$identity; fi
  [[ "$identity" == "$candidate" ]] || { echo 'Publication candidate changed' >&2; return 1; }
}

# Both aliases must still identify the one image already scanned and smoke-tested.
for image in "$@"; do verify_image "$image"; done
for image in "$@"; do
  for attempt in 1 2 3; do
    verify_image "$image"
    if docker push "$image"; then break; fi
    if [[ "$attempt" == 3 ]]; then echo 'Publication failed after three attempts' >&2; exit 1; fi
    sleep "$((attempt * 5))"
  done
done
