"""Best-effort office-document -> PDF conversion via headless LibreOffice."""
import logging
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)

CONVERT_TIMEOUT_SECONDS = 30


def convert_to_pdf(src_path: Path, out_dir: Path) -> Path | None:
    """Convert `src_path` (docx/odt/pptx/odp/xlsx/ods) to PDF in `out_dir`.
    Returns the resulting PDF path, or None if conversion failed/unavailable."""
    try:
        subprocess.run(
            ["soffice", "--headless", "--convert-to", "pdf", "--outdir", str(out_dir), str(src_path)],
            capture_output=True, timeout=CONVERT_TIMEOUT_SECONDS, check=True,
        )
    except Exception as e:
        logger.warning("PDF conversion failed for %s: %s", src_path.name, e)
        return None

    pdf_path = out_dir / (src_path.stem + ".pdf")
    return pdf_path if pdf_path.exists() else None
