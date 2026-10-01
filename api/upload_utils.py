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


def save_image(file, target_dir) -> str:
    """Ein hochgeladenes Bild in target_dir ablegen und den Dateinamen
    zurückgeben — für die Bild-Knöpfe der Vorlagen-Editoren (Caputh-Fragen,
    TaskCrawler-Folien). Gleichnamige Dateien werden nicht überschrieben,
    sondern bekommen ein -2, -3 … angehängt."""
    import re
    from pathlib import Path
    from fastapi import HTTPException

    name = Path(file.filename or "bild").name
    stem, ext = Path(name).stem, Path(name).suffix.lower()
    if ext not in IMAGE_EXTENSIONS:
        raise HTTPException(400, f"Nur Bilder erlaubt ({', '.join(sorted(IMAGE_EXTENSIONS))}).")
    data = file.file.read(MAX_FILE_BYTES + 1)
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(413, "Das Bild ist größer als 20 MB.")
    stem = re.sub(r"[^A-Za-z0-9_-]+", "_", stem).strip("_")[:60] or "bild"
    target = Path(target_dir)
    target.mkdir(parents=True, exist_ok=True)
    fname, n = f"{stem}{ext}", 2
    while (target / fname).exists():
        fname, n = f"{stem}-{n}{ext}", n + 1
    (target / fname).write_bytes(data)
    return fname
