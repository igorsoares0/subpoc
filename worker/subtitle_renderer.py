"""
Subtitle renderer using Playwright (headless Chromium).

Renders subtitle text with the EXACT same CSS as the Next.js editor preview,
producing transparent PNG images that FFmpeg can overlay onto the video.
This guarantees pixel-perfect WYSIWYG: preview == final render.
"""

import os
import tempfile
import hashlib
from pathlib import Path
from playwright.sync_api import sync_playwright, Browser

FONTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")

# Mapping from logical font name to the local .ttf files in worker/fonts/.
# Each entry lists (file, weight, style) tuples so we can generate @font-face rules.
_FONT_FILES: dict[str, list[tuple[str, int, str]]] = {
    "Inter": [
        ("Inter-VF.ttf", 400, "normal"),
    ],
    "Montserrat": [
        ("Montserrat-Regular.ttf", 400, "normal"),
        ("Montserrat-Medium.ttf", 500, "normal"),
        ("Montserrat-SemiBold.ttf", 600, "normal"),
        ("Montserrat-Bold.ttf", 700, "normal"),
        ("Montserrat-Black.ttf", 900, "normal"),
    ],
    "Poppins": [
        ("Poppins-Regular.ttf", 400, "normal"),
        ("Poppins-Medium.ttf", 500, "normal"),
        ("Poppins-SemiBold.ttf", 600, "normal"),
        ("Poppins-Bold.ttf", 700, "normal"),
        ("Poppins-Black.ttf", 900, "normal"),
    ],
    "Roboto": [
        ("Roboto-VF.ttf", 400, "normal"),
    ],
}


def _build_font_face_css() -> str:
    """Generate @font-face rules for all bundled fonts."""
    rules = []
    for family, files in _FONT_FILES.items():
        for filename, weight, style in files:
            font_path = os.path.join(FONTS_DIR, filename).replace("\\", "/")
            # Variable fonts cover all weights; set a range
            if filename.endswith("-VF.ttf"):
                weight_str = "100 900"
            else:
                weight_str = str(weight)
            rules.append(
                f"@font-face {{\n"
                f"  font-family: '{family}';\n"
                f"  src: url('file:///{font_path}') format('truetype');\n"
                f"  font-weight: {weight_str};\n"
                f"  font-style: {style};\n"
                f"}}"
            )
    return "\n".join(rules)


def _hex_to_rgba(hex_color: str, opacity: float = 1.0) -> str:
    """Convert #RRGGBB hex to rgba() CSS string."""
    hex_color = hex_color.lstrip("#")
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)
    return f"rgba({r}, {g}, {b}, {opacity})"


def _build_text_shadow(outline_width: int, outline_color: str) -> str:
    """Build the same 8-directional + drop-shadow CSS text-shadow as the editor."""
    w = outline_width
    oc = outline_color
    sd = max(1, round(w * 0.4))
    return (
        f"{w}px 0 0 {oc}, -{w}px 0 0 {oc}, "
        f"0 {w}px 0 {oc}, 0 -{w}px 0 {oc}, "
        f"{w}px {w}px 0 {oc}, -{w}px -{w}px 0 {oc}, "
        f"{w}px -{w}px 0 {oc}, -{w}px {w}px 0 {oc}, "
        f"{sd}px {sd}px 0 {oc}"
    )


def _build_sentence_html(
    text: str,
    style: dict,
    video_width: int,
    video_height: int,
    position: dict | None = None,
) -> str:
    """Build the HTML for a single sentence-mode subtitle frame."""
    font_face_css = _build_font_face_css()
    font_family = style.get("fontFamily", "Arial")
    font_size = style.get("fontSize", 20)
    font_weight = style.get("fontWeight", 700)
    color = style.get("color", "#FFFFFF")
    bg_color = style.get("backgroundColor", "#000000")
    bg_opacity = style.get("backgroundOpacity", 0)
    alignment = style.get("alignment", "center")
    has_outline = style.get("outline", False)
    outline_color = style.get("outlineColor", "#000000")
    outline_width = style.get("outlineWidth", 2)
    uppercase = style.get("uppercase", False)

    # Position (percentage)
    x_pct = 50
    y_pct = 90
    if position and isinstance(position, dict):
        x_pct = position.get("x", 50)
        y_pct = position.get("y", 90)

    display_text = text.upper() if uppercase else text

    # Background
    if bg_opacity > 0:
        bg_css = _hex_to_rgba(bg_color, bg_opacity)
    else:
        bg_css = "transparent"

    # Outline via text-shadow (same as editor)
    if has_outline and bg_opacity <= 0:
        text_shadow = _build_text_shadow(outline_width, outline_color)
    else:
        text_shadow = "none"

    # Box padding matching the editor's formula
    box_padding = max(int(video_width * 0.015), 6)

    # Max width: 90% of video (matching editor's maxWidth constraint)
    max_width = int(video_width * 0.9)

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
{font_face_css}
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{
  width: {video_width}px;
  height: {video_height}px;
  background: transparent;
  position: relative;
  overflow: hidden;
}}
.subtitle-container {{
  position: absolute;
  left: {x_pct}%;
  top: {y_pct}%;
  transform: translate(-50%, -50%);
  max-width: {max_width}px;
  text-align: {alignment};
}}
.subtitle-text {{
  font-family: '{font_family}', sans-serif;
  font-size: {font_size}px;
  font-weight: {font_weight};
  color: {color};
  background-color: {bg_css};
  padding: {box_padding}px;
  text-shadow: {text_shadow};
  text-align: {alignment};
  white-space: pre-wrap;
  word-wrap: break-word;
}}
</style>
</head>
<body>
  <div class="subtitle-container">
    <div class="subtitle-text">{display_text}</div>
  </div>
</body>
</html>"""


def _build_wordgroup_html(
    words: list[dict],
    active_index: int,
    style: dict,
    video_width: int,
    video_height: int,
    position: dict | None = None,
) -> str:
    """Build HTML for a word-group subtitle frame (karaoke/Hormozi style)."""
    font_face_css = _build_font_face_css()
    font_family = style.get("fontFamily", "Arial")
    font_size = style.get("fontSize", 20)
    font_weight = style.get("fontWeight", 700)
    base_color = style.get("color", "#FFFFFF")
    bg_color = style.get("backgroundColor", "#000000")
    bg_opacity = style.get("backgroundOpacity", 0)
    has_outline = style.get("outline", False)
    outline_color = style.get("outlineColor", "#000000")
    outline_width = style.get("outlineWidth", 2)
    highlight_color = style.get("highlightColor", "#FFD700")
    highlight_bg = style.get("highlightBg")
    highlight_bg_opacity = style.get("highlightBgOpacity", 0.95)
    uppercase = style.get("uppercase", False)

    # Position (percentage)
    x_pct = 50
    y_pct = 90
    if position and isinstance(position, dict):
        x_pct = position.get("x", 50)
        y_pct = position.get("y", 90)

    # Background
    if bg_opacity > 0:
        bg_css = _hex_to_rgba(bg_color, bg_opacity)
    else:
        bg_css = "transparent"

    # Outline text-shadow (only when no background box)
    if has_outline and bg_opacity <= 0:
        text_shadow = _build_text_shadow(outline_width, outline_color)
    else:
        text_shadow = "none"

    box_padding = max(int(video_width * 0.015), 6)
    max_width = int(video_width * 0.9)

    # Build word spans
    word_spans = []
    for idx, w in enumerate(words):
        word_text = w["word"].upper() if uppercase else w["word"]
        is_active = idx == active_index

        span_styles = []
        margin = "margin-right: 0.3em;" if idx < len(words) - 1 else ""

        if is_active and highlight_bg:
            # Active word with background highlight
            hbg = _hex_to_rgba(highlight_bg, highlight_bg_opacity)
            span_styles.append(f"color: {highlight_color or '#FFFFFF'};")
            span_styles.append("text-shadow: none;")
            span_styles.append(f"background-color: {hbg};")
            span_styles.append("padding: 2px 6px;")
            span_styles.append("border-radius: 4px;")
        elif is_active:
            # Active word with color highlight only
            span_styles.append(f"color: {highlight_color};")
            span_styles.append(f"text-shadow: {text_shadow};")
        else:
            # Inactive word
            span_styles.append(f"color: {base_color};")
            if highlight_bg:
                span_styles.append("text-shadow: none;" if bg_opacity > 0 else f"text-shadow: {text_shadow};")
            else:
                span_styles.append(f"text-shadow: {text_shadow};")

        style_str = " ".join(span_styles) + " " + margin
        word_spans.append(f'<span style="{style_str}">{word_text}</span>')

    words_html = "".join(word_spans)

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
{font_face_css}
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{
  width: {video_width}px;
  height: {video_height}px;
  background: transparent;
  position: relative;
  overflow: hidden;
}}
.subtitle-container {{
  position: absolute;
  left: {x_pct}%;
  top: {y_pct}%;
  transform: translate(-50%, -50%);
  max-width: {max_width}px;
  text-align: center;
}}
.subtitle-text {{
  font-family: '{font_family}', sans-serif;
  font-size: {font_size}px;
  font-weight: {font_weight};
  background-color: {bg_css};
  padding: {box_padding}px;
  text-align: center;
  white-space: nowrap;
}}
</style>
</head>
<body>
  <div class="subtitle-container">
    <div class="subtitle-text">{words_html}</div>
  </div>
</body>
</html>"""


def _content_hash(html: str) -> str:
    """Short hash of HTML content for caching/dedup."""
    return hashlib.md5(html.encode("utf-8")).hexdigest()[:12]


class SubtitleRenderer:
    """
    Renders subtitle HTML to transparent PNG using Playwright (sync API).
    Called via asyncio.to_thread() from the async rendering pipeline to
    avoid Windows SelectorEventLoop subprocess limitations.
    Reuses a single browser instance across renders for performance.
    """

    def __init__(self):
        self._playwright = None
        self._browser: Browser | None = None
        self._png_cache: dict[str, str] = {}  # html_hash -> png_path

    def _ensure_browser(self):
        if self._browser is None:
            self._playwright = sync_playwright().start()
            self._browser = self._playwright.chromium.launch(headless=True)

    def close(self):
        if self._browser:
            self._browser.close()
            self._browser = None
        if self._playwright:
            self._playwright.stop()
            self._playwright = None

    def render_html_to_png(
        self,
        html: str,
        video_width: int,
        video_height: int,
        output_path: str | None = None,
        full_frame: bool = True,
    ) -> str:
        """
        Render HTML string to a transparent PNG.

        If full_frame=True, captures entire page (video resolution) for direct overlay.
        If full_frame=False, captures just the subtitle element (tight crop).
        Returns the path to the PNG file.
        """
        # Check cache
        h = _content_hash(html)
        if h in self._png_cache and os.path.exists(self._png_cache[h]):
            return self._png_cache[h]

        self._ensure_browser()

        if output_path is None:
            output_path = os.path.join(
                tempfile.gettempdir(), f"sub_{h}.png"
            )

        page = self._browser.new_page(
            viewport={"width": video_width, "height": video_height},
        )
        try:
            page.set_content(html, wait_until="networkidle")
            if full_frame:
                page.screenshot(path=output_path, omit_background=True)
            else:
                element = page.query_selector(".subtitle-container")
                if element:
                    element.screenshot(path=output_path, omit_background=True)
                else:
                    page.screenshot(path=output_path, omit_background=True)
        finally:
            page.close()

        self._png_cache[h] = output_path
        return output_path

    def render_sentence(
        self,
        text: str,
        style: dict,
        video_width: int,
        video_height: int,
        position: dict | None = None,
    ) -> str:
        """Render a sentence-mode subtitle to full-frame PNG. Returns PNG path."""
        html = _build_sentence_html(
            text, style, video_width, video_height, position
        )
        return self.render_html_to_png(
            html, video_width, video_height, full_frame=True
        )

    def render_wordgroup(
        self,
        words: list[dict],
        active_index: int,
        style: dict,
        video_width: int,
        video_height: int,
        position: dict | None = None,
    ) -> str:
        """Render a word-group subtitle frame to full-frame PNG. Returns PNG path."""
        html = _build_wordgroup_html(
            words, active_index, style, video_width, video_height, position
        )
        return self.render_html_to_png(
            html, video_width, video_height, full_frame=True
        )

    def render_blank_frame(self, video_width: int, video_height: int) -> str:
        """Render a blank transparent frame at video resolution."""
        html = f"""<!DOCTYPE html>
<html><head><style>
body {{ width: {video_width}px; height: {video_height}px; background: transparent; }}
</style></head><body></body></html>"""
        return self.render_html_to_png(
            html, video_width, video_height, full_frame=True
        )
