"""
Unit tests for services/group_image_service.py. Mocks firebase_admin.storage.bucket()
instead of hitting real Firebase Storage.
"""
import io
import os
import sys
from unittest.mock import patch

import pytest
from PIL import Image
from werkzeug.exceptions import HTTPException

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tests.fake_firestore import FakeClient
import services.group_image_service as svc
import services.groups_service as groups_svc

OWNER = "owner-uid"
MEMBER = "member-uid"
BUCKET_NAME = "exli-24.firebasestorage.app"


def make_member(role="member"):
    return {
        "role": role, "status": "active", "displayName": "Name", "photoURL": None,
        "email": "x@example.com", "joinedAt": "t", "addedBy": OWNER,
    }


def make_group(**overrides):
    group = {
        "name": "Us", "ownerId": OWNER, "memberIds": [OWNER],
        "members": {OWNER: make_member(role="admin")},
        "settings": {}, "imageUrl": None, "status": "active",
    }
    group.update(overrides)
    return group


@pytest.fixture
def db():
    return FakeClient()


def seed_group(db, gid="g1", **overrides):
    db.collection("groups").document(gid).set(make_group(**overrides))
    return gid


def make_image_file(filename="pic.png", size=(100, 100)):
    image = Image.new("RGB", size, color="blue")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)
    file_storage = io.BytesIO(buffer.read())
    file_storage.filename = filename
    return file_storage


class FakeBlob:
    def __init__(self, bucket, path):
        self.bucket = bucket
        self.path = path
        self.uploaded_bytes = None
        self.uploaded_content_type = None

    def upload_from_file(self, file_obj, content_type=None):
        self.uploaded_bytes = file_obj.read()
        self.uploaded_content_type = content_type

    def delete(self):
        self.bucket.deleted_paths.append(self.path)


class FakeBucket:
    def __init__(self, name):
        self.name = name
        self.blobs = {}
        self.deleted_paths = []

    def blob(self, path):
        return self.blobs.setdefault(path, FakeBlob(self, path))


@pytest.fixture
def fake_bucket():
    bucket = FakeBucket(BUCKET_NAME)
    with patch.object(svc.firebase_storage, "bucket", return_value=bucket):
        yield bucket


class TestUploadGroupImage:
    def test_admin_can_upload_and_group_is_updated(self, db, fake_bucket):
        gid = seed_group(db)
        url = svc.upload_group_image(db, OWNER, gid, make_image_file())

        assert url.startswith(f"https://firebasestorage.googleapis.com/v0/b/{BUCKET_NAME}/o/groupImages%2F{gid}%2F")
        assert url.endswith("?alt=media")
        assert db.collection("groups").document(gid).get().to_dict()["imageUrl"] == url

    def test_non_admin_cannot_upload(self, db, fake_bucket):
        gid = seed_group(db, members={
            OWNER: make_member(role="admin"),
            MEMBER: make_member(role="member"),
        }, memberIds=[OWNER, MEMBER])

        with pytest.raises(groups_svc.ForbiddenError):
            svc.upload_group_image(db, MEMBER, gid, make_image_file())

    def test_replacing_image_deletes_the_old_blob(self, db, fake_bucket):
        gid = seed_group(db)
        first_url = svc.upload_group_image(db, OWNER, gid, make_image_file())
        second_url = svc.upload_group_image(db, OWNER, gid, make_image_file())

        assert first_url != second_url
        assert len(fake_bucket.deleted_paths) == 1

    def test_large_image_is_resized_and_converted_to_webp(self, db, fake_bucket):
        gid = seed_group(db)
        svc.upload_group_image(db, OWNER, gid, make_image_file(size=(2000, 1000)))

        uploaded_blob = next(iter(fake_bucket.blobs.values()))
        resized = Image.open(io.BytesIO(uploaded_blob.uploaded_bytes))
        assert max(resized.size) <= svc.MAX_IMAGE_DIMENSION
        assert uploaded_blob.uploaded_content_type == "image/webp"

    def test_unrecognizable_file_rejected_before_reaching_pillow(self, db, fake_bucket):
        gid = seed_group(db)
        bad_file = io.BytesIO(b"just some plain bytes, not a real image at all, padded")
        bad_file.filename = "not-an-image.png"

        # utils.security.validate_file_safety runs first and calls Flask's abort()
        # directly (matching how every other upload endpoint in this backend
        # validates files) rather than raising a typed GroupServiceError.
        with pytest.raises(HTTPException):
            svc.upload_group_image(db, OWNER, gid, bad_file)

    def test_group_not_found(self, db, fake_bucket):
        with pytest.raises(groups_svc.NotFoundError):
            svc.upload_group_image(db, OWNER, "does-not-exist", make_image_file())
