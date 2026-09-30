"""
Group cover image upload. See docs/groups/02-phase2-ui-and-splits-plan.md §7
(Debate O, option C: upload goes through the backend, not straight from the
client to Storage).

Images are served through Firebase Storage's own public download-URL format,
governed by exli-front/storage.rules (`groupImages/** -> allow read: if true`),
NOT by making the GCS object public via IAM/ACLs. That sidesteps
`Blob.make_public()`, which fails outright on a bucket with uniform
bucket-level access enabled (the default for newer Firebase Storage buckets).
Only the backend (Admin SDK) can write there at all, matching the same
"backend writes, rules control reads" split already used for Firestore.
"""
import io
import urllib.parse
import uuid

from PIL import Image, UnidentifiedImageError
from firebase_admin import storage as firebase_storage

from config import Config, logger
from utils.security import validate_file_safety
from services.groups_service import get_group_or_404, ensure_permission, log_activity, ValidationError

MAX_IMAGE_DIMENSION = 512
MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8MB — generous for a phone photo, small next to the 20MB doc limit


def _public_download_url(bucket_name, blob_path):
    encoded_path = urllib.parse.quote(blob_path, safe="")
    return f"https://firebasestorage.googleapis.com/v0/b/{bucket_name}/o/{encoded_path}?alt=media"


def _blob_path_from_public_url(url, bucket_name):
    prefix = f"https://firebasestorage.googleapis.com/v0/b/{bucket_name}/o/"
    if not url or not url.startswith(prefix):
        return None
    encoded_path = url[len(prefix):].split("?")[0]
    return urllib.parse.unquote(encoded_path)


def _check_size(file_storage):
    file_storage.seek(0, io.SEEK_END)
    size = file_storage.tell()
    file_storage.seek(0)
    if size > MAX_UPLOAD_BYTES:
        raise ValidationError(f"Image must be under {MAX_UPLOAD_BYTES // (1024 * 1024)}MB.")


def _resize_to_webp(file_storage):
    try:
        image = Image.open(file_storage)
        image = image.convert("RGB")
    except UnidentifiedImageError:
        raise ValidationError("Could not read this image file.")

    image.thumbnail((MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION))
    buffer = io.BytesIO()
    image.save(buffer, format="WEBP", quality=85)
    buffer.seek(0)
    return buffer


def _delete_old_image(bucket, old_image_url):
    """Best-effort cleanup so old cover images don't pile up forever in Storage."""
    blob_path = _blob_path_from_public_url(old_image_url, bucket.name)
    if not blob_path:
        return
    try:
        bucket.blob(blob_path).delete()
    except Exception as e:
        logger.warning(f"Could not delete old group image at {blob_path}: {e}")


def upload_group_image(db, uid, group_id, file_storage):
    """Admin only (same permission as other group-details edits)."""
    snap = get_group_or_404(db, group_id)
    group = snap.to_dict()
    ensure_permission(group, uid, "group.update")

    validate_file_safety(file_storage)  # magic-byte check; aborts(400) on anything unsafe
    _check_size(file_storage)
    image_buffer = _resize_to_webp(file_storage)

    bucket = firebase_storage.bucket(Config.FIREBASE_STORAGE_BUCKET)
    blob_path = f"groupImages/{group_id}/{uuid.uuid4().hex}.webp"
    blob = bucket.blob(blob_path)
    blob.upload_from_file(image_buffer, content_type="image/webp")

    image_url = _public_download_url(bucket.name, blob_path)
    _delete_old_image(bucket, group.get("imageUrl"))

    snap.reference.update({"imageUrl": image_url})
    log_activity(db, group_id, "IMAGE_UPDATED", uid)
    logger.info(f"Group {group_id} image updated by {uid}")
    return image_url
