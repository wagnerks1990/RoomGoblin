#!/usr/bin/env bash
# Check availability quietly before pulling. Never substitute another revision.
ROOMGOBLIN_IMAGE_HELPER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$ROOMGOBLIN_IMAGE_HELPER_DIR/image-identity.sh"

roomgoblin_remote_manifest(){
  local image="$1" deadline="$2" remaining=$(( $2 - SECONDS ))
  (( remaining > 0 )) || return 1
  (( remaining > 20 )) && remaining=20
  timeout "$remaining" docker manifest inspect "$image" >/dev/null 2>&1
}

roomgoblin_wait_image_pair(){
  local revision="$1" hub="$2" maintenance="$3"
  local attempts="${CLASSROOM_HUB_IMAGE_WAIT_ATTEMPTS:-120}" deadline attempt=0 message status remaining
  [[ "$revision" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid source revision" >&2; return 1; }
  [[ "$attempts" =~ ^[1-9][0-9]*$ && "$attempts" -le 180 ]] || {
    echo "CLASSROOM_HUB_IMAGE_WAIT_ATTEMPTS must be between 1 and 180" >&2; return 1;
  }
  command -v timeout >/dev/null || { echo "The coreutils timeout command is required" >&2; return 1; }
  docker info >/dev/null 2>&1 || { echo "Docker is unavailable; start Docker before updating." >&2; return 1; }
  deadline=$((SECONDS + attempts * 10))
  echo "Checking validated image pair for $revision ..."
  while (( SECONDS < deadline )); do
    if roomgoblin_remote_manifest "$hub" "$deadline" && roomgoblin_remote_manifest "$maintenance" "$deadline"; then
      echo "Both images are available. Downloading and verifying source revision ..."
      timeout 900 docker pull --quiet "$hub" && timeout 900 docker pull --quiet "$maintenance" || {
        echo "Image download failed. Existing services have not been changed; retry when registry access is restored." >&2; return 1;
      }
      roomgoblin_verify_image_revision "$hub" "$revision" && roomgoblin_verify_image_revision "$maintenance" "$revision" || return 1
      return 0
    fi
    if (( attempt % 6 == 0 )); then
      message="Images are not available yet; waiting for CI publication."
      if command -v python3 >/dev/null; then
        remaining=$((deadline - SECONDS)); (( remaining > 0 )) || break
        (( remaining > 10 )) && remaining=10
        status=0
        message="$(timeout "$remaining" python3 "$ROOMGOBLIN_IMAGE_HELPER_DIR/image-readiness.py" "$revision")" || status=$?
        if (( status == 2 )); then echo "$message" >&2; return 1; fi
        [[ -n "$message" ]] || message="CI status unavailable; still checking the exact image pair."
      fi
      echo "$message"
    fi
    attempt=$((attempt + 1)); remaining=$((deadline - SECONDS))
    (( remaining > 0 )) || break
    (( remaining > 10 )) && remaining=10
    sleep "$remaining"
  done
  echo "Publication is not ready. Existing services have not been changed. Use deploy/update-production.sh for published builds, or retry this exact revision after CI succeeds." >&2
  return 1
}
