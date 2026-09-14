FROM node:22-bookworm-slim AS browser-build

WORKDIR /build

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY public/display/sendspin-entry.js ./public/display/sendspin-entry.js
RUN npx --no-install esbuild public/display/sendspin-entry.js --bundle --format=esm --target=es2022 --outfile=public/display/sendspin.bundle.js

FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      libreoffice-core \
      libreoffice-writer \
      libreoffice-impress \
      fonts-dejavu-core \
      fonts-liberation \
      poppler-utils \
      ca-certificates \
      python3-venv \
 && rm -rf /var/lib/apt/lists/*

COPY src/esphome/requirements.txt /tmp/esphome-requirements.txt
RUN python3 -m venv /opt/esphome \
 && /opt/esphome/bin/python -m pip install --no-cache-dir --only-binary=:all: -r /tmp/esphome-requirements.txt \
 && /opt/esphome/bin/python -m pip check \
 && /opt/esphome/bin/python -m pip uninstall -y pip setuptools \
 && rm /tmp/esphome-requirements.txt

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts \
 && rm -rf /usr/local/lib/node_modules/npm \
 && rm -f /usr/local/bin/npm /usr/local/bin/npx

COPY VERSION ./VERSION
COPY src ./src
# Run native-client contract tests in the exact Python/runtime image being shipped.
# Test sources are removed from the final image and do not touch physical devices.
COPY test/esphome_worker_test.py ./test/esphome_worker_test.py
COPY test/esphome_worker_entry_test.py ./test/esphome_worker_entry_test.py
RUN PYTHONDONTWRITEBYTECODE=1 /opt/esphome/bin/python -m unittest discover -s test -p 'esphome_worker*_test.py' -v \
 && rm -rf /app/test
COPY config ./config
COPY public ./public
COPY --from=browser-build /build/public/display/sendspin.bundle.js ./public/display/sendspin.bundle.js
COPY tools/prepare-display-fonts.sh ./tools/prepare-display-fonts.sh
COPY tools/verify-image-permissions.js ./tools/verify-image-permissions.js
RUN bash tools/prepare-display-fonts.sh

# Stamp independently loaded client/runtime surfaces from the single release
# VERSION file. This prevents backend/display/controller/agent drift when a new
# alpha is cut and keeps version convergence mechanically testable.
RUN RELEASE_VERSION="$(cat VERSION)" \
 && sed -i -E "s/[0-9]+\.[0-9]+\.[0-9]+-alpha\.[0-9]+/${RELEASE_VERSION}/g" \
      public/controller/app.js \
      public/controller/index.html \
      public/controller/display.html \
      public/display/index.html \
      public/lab-agent/ClassroomHubAgent.ps1

# Local Docker contexts retain file modes. A root-edited 0600 server.js must not
# produce an image that only root can start. Normalize packaged, non-secret
# application files inside the image only; never chmod host data or secrets.
# The isolated, root-owned native-client runtime also needs to tolerate a
# restrictive build umask without giving the application write access.
RUN chmod 0755 /app \
 && find /app/src /app/public /app/config /app/tools -type d -exec chmod 0755 {} + \
 && find /app/src /app/public /app/config /app/tools -type f -exec chmod 0644 {} + \
 && chmod 0644 /app/VERSION /app/package.json /app/package-lock.json \
 && find /opt/esphome -type d -exec chmod 0755 {} + \
 && find /opt/esphome -type f -exec chmod 0644 {} + \
 && find /opt/esphome/bin -type f -exec chmod 0755 {} +

RUN groupadd --gid 10001 classroom-hub \
 && useradd --uid 10001 --gid 10001 --home-dir /tmp/classroom-hub --no-create-home --shell /usr/sbin/nologin classroom-hub \
 && mkdir -p /app/data/media /app/data/convert-tmp /app/data/presentations /app/data/presentation-upload-tmp /tmp/classroom-hub \
 && chown -R 10001:10001 /app/data /tmp/classroom-hub

ENV NODE_ENV=production
ENV HOME=/tmp/classroom-hub
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch(require('./src/network').localHttpUrl(process.env.PORT||3000,process.env.BIND_ADDRESS)+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

USER 10001:10001
# Fail the build, rather than the deployed container, on unreadable source/assets.
RUN node tools/verify-image-permissions.js && node --check src/server.js \
 && PYTHONPATH=/app/src/esphome /opt/esphome/bin/python -c "from aioesphomeapi import APIClient; import discovery, worker_entry, ast, os; from zeroconf import ServiceStateChange; names=set(); discovery.service_changed(names, zeroconf=None, service_type=discovery.SERVICE, name='fixture.'+discovery.SERVICE, state_change=ServiceStateChange.Added); assert names; ast.parse(open('src/esphome/worker.py').read()); assert not os.access('/opt/esphome', os.W_OK)"
CMD ["node", "--require", "./src/direct-display-compat.js", "src/startup-recovery.js"]
