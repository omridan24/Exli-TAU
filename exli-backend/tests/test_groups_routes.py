"""
Route/method registration checks for routes/groups.py.

Why this exists: a POST to a path that only has PATCH/DELETE registered (e.g.
/groups/<id>/expenses/<expense_id>) answers 405, not 404. That is exactly what a
client sees when it calls an endpoint the deployed backend doesn't have yet, so
these tests pin the routes the frontend (exli-front/src/config/groupsApi.js)
relies on, with the exact HTTP methods it uses.
"""
import os
import sys

import pytest
from werkzeug.exceptions import MethodNotAllowed, NotFound

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask
from extensions import limiter
from routes.groups import groups_bp


@pytest.fixture(scope="module")
def app():
    app = Flask(__name__)
    limiter.init_app(app)
    app.register_blueprint(groups_bp)
    return app


def _match(app, path, method):
    return app.url_map.bind("localhost").match(path, method=method)


def test_apply_default_split_is_a_post_route(app):
    endpoint, args = _match(app, "/groups/g1/expenses/apply-default-split", "POST")
    assert endpoint == "groups.apply_default_split"
    assert args == {"group_id": "g1"}


def test_apply_default_split_rejects_other_methods(app):
    # (PATCH/DELETE are deliberately not checked: they match the '/expenses/<expense_id>' route.)
    for method in ("GET", "PUT"):
        with pytest.raises(MethodNotAllowed):
            _match(app, "/groups/g1/expenses/apply-default-split", method)


def test_apply_default_split_is_not_swallowed_by_the_expense_id_route(app):
    # '/expenses/<expense_id>' is PATCH/DELETE only; a literal path must win over it for POST.
    endpoint, _ = _match(app, "/groups/g1/expenses/apply-default-split", "POST")
    assert endpoint != "groups.edit_expense"
    endpoint, args = _match(app, "/groups/g1/expenses/abc123", "PATCH")
    assert endpoint == "groups.edit_expense" and args["expense_id"] == "abc123"


def test_an_unregistered_post_on_an_expense_path_is_a_405_not_a_404(app):
    # Documents the symptom of a backend that predates the route.
    with pytest.raises(MethodNotAllowed):
        _match(app, "/groups/g1/expenses/some-new-endpoint", "POST")
    with pytest.raises(NotFound):
        _match(app, "/groups/g1/no-such-thing", "POST")


@pytest.mark.parametrize("path,method", [
    ("/groups/g1", "PATCH"),
    ("/groups/g1/split-rules", "PUT"),
    ("/groups/g1/income-ratios", "GET"),
    ("/groups/g1/income-ratio", "GET"),
    ("/groups/g1/expenses", "POST"),
    ("/groups/g1/expenses/from-personal", "POST"),
    ("/groups/g1/expenses/from-personal/batch", "POST"),
])
def test_routes_the_frontend_calls_exist_with_the_methods_it_uses(app, path, method):
    _match(app, path, method)


def test_unauthenticated_post_reaches_the_handler_and_is_rejected_as_401(app):
    response = app.test_client().post("/groups/g1/expenses/apply-default-split")
    assert response.status_code == 401
