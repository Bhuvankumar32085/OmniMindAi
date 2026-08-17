import base64
import re
import logging
import requests
from io import BytesIO
from bs4 import BeautifulSoup
from PIL import Image, UnidentifiedImageError
from requests.exceptions import RequestException, Timeout
from xhtml2pdf import pisa
from configs.llm import get_llm
from configs.models import PDF_MODEL
from langchain_core.messages import SystemMessage, HumanMessage
import os

def _parse_int_env(var_name: str, default: int) -> int:
    val = os.getenv(var_name)
    if val is None:
        return default
    try:
        return int(str(val).strip())
    except (ValueError, TypeError):
        return default

MAX_IMAGE_WIDTH = _parse_int_env("MAX_IMAGE_WIDTH", 500)
MAX_IMAGE_HEIGHT = _parse_int_env("MAX_IMAGE_HEIGHT", 400)
REQUEST_TIMEOUT = _parse_int_env("REQUEST_TIMEOUT", 10)
MAX_HTML_LENGTH = _parse_int_env("MAX_HTML_LENGTH", 500000)
MAX_LLM_RETRIES = _parse_int_env("MAX_LLM_RETRIES", 3)
SAVE_DEBUG_HTML = str(os.getenv("SAVE_DEBUG_HTML", "True")).lower() in ("true", "1", "t")


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """
You are an Expert PDF Designer for OmniMindAI.

CRITICAL RULES FOR xhtml2pdf COMPATIBILITY:
1. Output ONLY pure, valid HTML starting with <html> and ending with </html>.
2. MUST include <head> and <body>.
3. FORBIDDEN TAGS: Never use <svg>, <canvas>, <iframe>, <video>, <audio>, <picture>, <script>, <form>, <main>, <section>, <article>, <figure>. Use ONLY basic tags: <div>, <p>, <h1>-<h6>, <b>, <i>, <br>, <ul>, <li>.
4. FORBIDDEN CSS: Never use flexbox, grid, position:absolute, float, percentages (%), vh, vw, calc, transform, box-shadow, filter, or border-radius.
5. IMAGES: Use public placeholder URLs. Give absolute fixed width/height attributes (e.g., width="400" height="250").
6. TABLES: Only use <table> for small data grids, NEVER for page layout.

Ensure the output is robust, simple HTML4-style.
"""

pdf_llm = get_llm(model=PDF_MODEL, temperature=0.3)

# CSS properties/values we never want reaching xhtml2pdf's parser.
# These are applied ONLY to isolated CSS text (style tag contents / style attribute
# values) -- never to the raw HTML string -- so they can't corrupt tag structure.
DANGEROUS_CSS_PATTERNS = [
    # NOTE: every pattern below starts with a negative lookbehind
    # `(?<![\w-])` so the property-name keyword can only match at the START
    # of a CSS property token. Without this, e.g. r'transform\s*:...' also
    # matches the "transform:" tail inside "text-transform:", silently
    # eating part of a DIFFERENT property and leaving the rest of the
    # declaration dangling/unbalanced -- which is what breaks xhtml2pdf's
    # CSS parser (and previously produced 'NotImplementedType' object is
    # not iterable / "Declaration group closing '}' not found" errors).
    r'(?i)(?<![\w-])display\s*:\s*(flex|grid|inline-block)[^;]*;?',
    r'(?i)(?<![\w-])position\s*:\s*(absolute|fixed|relative)[^;]*;?',
    r'(?i)(?<![\w-])(width|height)\s*:\s*\d+(?:\.\d+)?(%|vh|vw)[^;]*;?',
    r'(?i)(?<![\w-])float\s*:\s*(left|right)[^;]*;?',
    r'(?i)(?<![\w-])border-radius\s*:[^;]*;?',
    r'(?i)(?<![\w-])box-shadow\s*:[^;]*;?',
    r'(?i)(?<![\w-])transform\s*:[^;]*;?',
    r'(?i)(?<![\w-])calc\s*\([^)]*\)',
]

FORBIDDEN_TAGS = ['svg', 'canvas', 'video', 'iframe', 'script', 'picture', 'audio', 'form']


def parse_llm_response(raw_content):
    """Universal Response Parser"""
    if isinstance(raw_content, list):
        return "".join([item.get("text", "") if isinstance(item, dict) else str(item) for item in raw_content])
    return str(raw_content)


def extract_html(text):
    """Extract HTML and enforce limits"""
    if len(text) > MAX_HTML_LENGTH:
        logger.warning("HTML exceeded length limit. Truncating text for regex.")
        text = text[:MAX_HTML_LENGTH]

    match = re.search(r'(?is)(<html.*?>.*?</html>)', text)
    if match:
        return match.group(1)

    # Fallback cleanup
    clean_text = re.sub(r'^```html\s*|```\s*$', '', text.strip(), flags=re.MULTILINE)
    return clean_text if clean_text.lower().startswith('<html') else f"<html><body>{clean_text}</body></html>"


def _clean_css_text(css_text):
    """Strip dangerous CSS properties from a raw block of CSS text."""
    if not css_text:
        return ""
    cleaned = css_text
    for pattern in DANGEROUS_CSS_PATTERNS:
        cleaned = re.sub(pattern, '', cleaned)
    return cleaned


def _is_css_balanced(css_text):
    """Cheap structural sanity check: braces must balance."""
    return css_text.count('{') == css_text.count('}')


def sanitize_html_and_css(html_string):
    """
    HTML validation + sanitization.

    IMPORTANT: We never call soup.prettify() on content that will actually be
    rendered. prettify() re-wraps/re-indents ALL text nodes -- including the
    raw CSS source sitting inside <style> tags -- and can literally split CSS
    property names across lines (e.g. "text-align" -> "text-\n    align"),
    which is what produces "Declaration group closing '}' not found" and
    downstream "'NotImplementedType' object is not iterable" errors in
    xhtml2pdf/reportlab's CSS parser.

    CSS cleaning is applied ONLY to isolated CSS text (style tag contents and
    style="" attribute values), never to the surrounding HTML string, so the
    regexes can't accidentally straddle tag boundaries either.
    """
    soup = BeautifulSoup(html_string, 'html.parser')

    # Validation: Ensure basic structure
    if not soup.html or not soup.body:
        raise ValueError("Invalid HTML structure: Missing <html> or <body> tags.")

    # Remove forbidden tags entirely
    for tag in soup.find_all(FORBIDDEN_TAGS):
        tag.decompose()

    # Clean <style> block contents in isolation
    for style_tag in soup.find_all('style'):
        original_css = style_tag.get_text() or ""
        cleaned_css = _clean_css_text(original_css)
        if not _is_css_balanced(cleaned_css):
            # Don't ship malformed CSS to xhtml2pdf -- drop the whole block
            # rather than risk a hard parser failure on the final PDF.
            logger.warning("Malformed/unbalanced CSS detected in <style> block; removing it for safety.")
            style_tag.decompose()
        else:
            style_tag.string = cleaned_css

    # Clean inline style="" attributes in isolation
    for tag in soup.find_all(style=True):
        cleaned = _clean_css_text(tag.get('style', '')).strip()
        if cleaned:
            tag['style'] = cleaned
        else:
            del tag['style']

    # Use str(soup), NOT prettify() -- preserves exact CSS/text content
    html_str = str(soup)

    # Clean dangerous width/height % attributes on tags (safe: attribute-scoped)
    html_str = re.sub(r'(?i)width\s*=\s*(["\'])\d+%\1', f'width="{MAX_IMAGE_WIDTH}"', html_str)
    html_str = re.sub(r'(?i)height\s*=\s*(["\'])\d+%\1', f'height="{MAX_IMAGE_HEIGHT}"', html_str)

    return html_str


def strip_all_styles(html_string):
    """
    Last-resort fallback: remove every <style> block and every inline style
    attribute. Used only if PDF generation still fails after normal
    sanitization, so the user gets a plain-but-working PDF instead of a
    hard failure.
    """
    soup = BeautifulSoup(html_string, 'html.parser')
    for style_tag in soup.find_all('style'):
        style_tag.decompose()
    for tag in soup.find_all(style=True):
        del tag['style']
    return str(soup)


def download_and_process_image(url):
    """Download with retries, convert with Pillow, compress to JPEG base64"""
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()

        img = Image.open(BytesIO(response.content))

        # Convert to RGB (handles RGBA/PNG transparency issues in PDFs)
        if img.mode in ("RGBA", "P", "LA"):
            background = Image.new("RGB", img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[3] if img.mode == "RGBA" else None)
            img = background
        elif img.mode != "RGB":
            img = img.convert("RGB")

        # Resize if too large (Preserve aspect ratio)
        img.thumbnail((MAX_IMAGE_WIDTH, MAX_IMAGE_HEIGHT), Image.Resampling.LANCZOS)

        buffer = BytesIO()
        img.save(buffer, format="JPEG", quality=75)
        img_b64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

        return f"data:image/jpeg;base64,{img_b64}"

    except (RequestException, Timeout) as e:
        logger.error(f"Network error fetching image {url}: {e}")
    except UnidentifiedImageError:
        logger.error(f"Invalid image format from {url}")
    except Exception as e:
        logger.error(f"Error processing image {url}: {e}")

    # 1x1 White transparent pixel fallback
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII="


def process_images_in_html(html_string):
    """Image Cache Dictionary applied here"""
    urls = set(re.findall(r'src=["\'](https?://[^"\']+)["\']', html_string))
    image_cache = {}

    for url in urls:
        logger.info(f"Processing image: {url}")
        if url not in image_cache:
            image_cache[url] = download_and_process_image(url)
        html_string = html_string.replace(url, image_cache[url])

    return html_string


def save_debug_html(filename, content):
    """Save debug reports"""
    if SAVE_DEBUG_HTML:
        try:
            with open(filename, "w", encoding="utf-8") as f:
                f.write(content)
            logger.info(f"Saved debug file: {filename}")
        except Exception as e:
            logger.warning(f"Could not save debug HTML: {e}")


def _render_pdf(html_string):
    """Run xhtml2pdf and return raw PDF bytes, or raise."""
    pdf_buffer = BytesIO()
    pisa_status = pisa.CreatePDF(html_string, dest=pdf_buffer, encoding='utf-8')

    if pisa_status.err:
        raise RuntimeError("xhtml2pdf encountered internal errors during generation.")

    pdf_bytes = pdf_buffer.getvalue()
    if len(pdf_bytes) == 0:
        raise ValueError("Generated PDF is 0 bytes.")

    return pdf_bytes


def pdf_agent(state):
    logger.info("===== Starting PDF Agent =====")

    user_query = state["query"]
    collected = state.get("collected_requirements", {})
    if collected:
        req_details = "\n".join([f"- {k}: {v}" for k, v in collected.items() if v])
        user_prompt = f"User Query: {user_query}\n\nCollected Requirements & Topic Details:\n{req_details}"
    else:
        user_prompt = user_query

    # Retry LLM
    raw_content = None
    for attempt in range(MAX_LLM_RETRIES):
        try:
            response = pdf_llm.invoke([
                SystemMessage(content=SYSTEM_PROMPT),
                HumanMessage(content=user_prompt),
            ])
            raw_content = response.content
            break
        except Exception as e:
            logger.warning(f"LLM Attempt {attempt + 1} failed: {e}")
            if attempt == MAX_LLM_RETRIES - 1:
                return {"final_response": {"type": "error", "message": "LLM failed after retries."}}

    try:
        # Pipeline execution
        raw_html = parse_llm_response(raw_content)
        save_debug_html("debug_01_original.html", raw_html)

        extracted_html = extract_html(raw_html)

        sanitized_html = sanitize_html_and_css(extracted_html)
        save_debug_html("debug_02_sanitized.html", sanitized_html)

        final_html = process_images_in_html(sanitized_html)
        save_debug_html("debug_03_final.html", final_html)

        # Primary render attempt
        try:
            pdf_bytes = _render_pdf(final_html)
        except Exception as primary_err:
            # Safety net: some CSS constructs xhtml2pdf/reportlab chokes on
            # (e.g. producing 'NotImplementedType' object is not iterable)
            # slip past our sanitizer. Rather than fail the whole request,
            # strip all CSS and retry once so the user still gets a PDF.
            logger.warning(
                f"Primary PDF render failed ({primary_err}); retrying with all CSS stripped."
            )
            fallback_html = strip_all_styles(final_html)
            save_debug_html("debug_04_fallback_no_css.html", fallback_html)
            pdf_bytes = _render_pdf(fallback_html)  # let this raise if it still fails

        base64_pdf = base64.b64encode(pdf_bytes).decode('utf-8')
        logger.info("PDF generated successfully.")

        return {
            "final_response": {
                "type": "pdf",
                "base64_data": base64_pdf,
                "mime_type": "application/pdf"
            }
        }

    except ValueError as ve:
        logger.error(f"Validation Error: {ve}")
        return {"final_response": {"type": "error", "message": str(ve)}}
    except RuntimeError as re_err:
        logger.error(f"Runtime Error: {re_err}")
        return {"final_response": {"type": "error", "message": str(re_err)}}
    except Exception as e:
        logger.error(f"Unexpected Pipeline Error: {e}")
        return {"final_response": {"type": "error", "message": f"System error generating PDF: {str(e)}"}}