"""
Shared Flask extension instances.

`limiter` is created here (without an app) so blueprint modules like routes/groups.py
can do `from extensions import limiter` and use `@limiter.limit(...)` directly,
without importing main.py (which would be circular, since main.py imports the
blueprint). main.py calls `limiter.init_app(app)` to attach it.
"""
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, storage_uri="memory://")
