# Third-party notices

Feedback Agent depends on open-source software installed through pnpm, Pub,
Docker images, and operating-system packages. Each dependency remains subject
to its own license.

## Vendored administration UI

apps/admin is derived from
[pure-admin-thin](https://github.com/pure-admin/pure-admin-thin), Copyright
(c) 2020-present pure-admin, under the MIT License. Its license is preserved
in [apps/admin/LICENSE](apps/admin/LICENSE). Assets and framework code retained
from that project are covered by that notice.

## Installed dependencies

The source repository does not commit node_modules, Flutter build output, or
container image layers. Production builds install dependencies whose licenses
include MIT, Apache-2.0, BSD, ISC, OFL-1.1, CC-BY-4.0, LGPL-3.0-or-later, and
other compatible terms.

Notable runtime cases:

- @img/sharp-libvips-* distributes libvips under LGPL-3.0-or-later as part of
  the Sharp image-processing dependency.
- caniuse-lite data is distributed under CC-BY-4.0.
- pause, a transitive dependency of Passport, declares the MIT License in
  its package README even though its package metadata has no SPDX field.

When redistributing binaries or container images, retain the license and
notice files shipped with those dependencies. Run
pnpm licenses list --prod against the exact release lockfile before each
release because the dependency set can change.
