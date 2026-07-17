"""Shared file-upload validation used by any router accepting user uploads
(Schreibraum files, Stundenplaner materials, ...)."""

ALLOWED_MIMES = {
    # Images
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
    # Documents
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # docx
    "application/vnd.oasis.opendocument.text",  # odt
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",  # pptx
    "application/vnd.oasis.opendocument.presentation",  # odp
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # xlsx
    "application/vnd.oasis.opendocument.spreadsheet",  # ods
    # Text
    "text/plain", "text/csv", "text/markdown",
}
ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg",
    ".pdf", ".docx", ".odt", ".pptx", ".odp", ".xlsx", ".ods",
    ".txt", ".csv", ".md",
}
MAX_FILE_BYTES = 20 * 1024 * 1024  # 20 MB

# Office formats worth attempting a PDF conversion for (see api/doc_convert.py)
CONVERTIBLE_EXTENSIONS = {".docx", ".odt", ".pptx", ".odp", ".xlsx", ".ods"}

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}
