# Packaged chess engine

The RoomGoblin Hub image includes Debian Bookworm Stockfish **15.1-4**, a
separate GPL-3.0-or-later UCI executable. This is a pinned reviewed engine, not
a claim to ship the latest upstream release or a certified human Elo rating.
No engine binary, model or source is placed in student SCORM packages.

The image carries the complete matching Debian source set (upstream source,
network, Debian patches and build rules) alongside the executable:

* `/usr/share/doc/roomgoblin-stockfish/source/stockfish_15.1-4.dsc`
* `/usr/share/doc/roomgoblin-stockfish/source/stockfish_15.1.orig.tar.gz`
* `/usr/share/doc/roomgoblin-stockfish/source/stockfish_15.1-4.debian.tar.xz`
* `/usr/share/doc/stockfish/copyright` and `/usr/share/common-licenses/GPL-3`

Recipients can extract these with `docker cp` from a container created from the
same image; the container need not run. Preserve this source set and notices
when redistributing the image or binary. Do not replace them with a source link
for a different version. APT verifies downloads using Debian's signed indices;
the build fails if the exact package or corresponding source is unavailable.

To rebuild, use a Debian Bookworm build environment with `dpkg-dev` and the
dependencies listed in the `.dsc`, unpack with
`dpkg-source -x stockfish_15.1-4.dsc`, enter the extracted directory, then run
`dpkg-buildpackage -b -us -uc`. The included Debian rules select the supported
architecture and network. RoomGoblin makes no changes to this engine's source.

The server invokes only `/usr/local/libexec/roomgoblin-stockfish/stockfish`.
It permits at most two combined legacy/native searches, one thread per native
search, a bounded hash allocation, bounded move time and a termination deadline.
The hash allocation is not a total memory limit: the executable and neural
network also consume RAM. Production release acceptance must measure actual
resource use. Engine failure leaves the board unchanged and reports an error;
strong levels must never silently use the legacy weak engine.

See [Debian's package and corresponding source](https://packages.debian.org/bookworm/stockfish)
and [Stockfish licensing](https://github.com/official-stockfish/Stockfish/blob/sf_15.1/Copying.txt).
