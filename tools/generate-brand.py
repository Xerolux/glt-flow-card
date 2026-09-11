"""Render the Companion's geometric GLT mark (requires Pillow)."""

from pathlib import Path

from PIL import Image, ImageDraw


def render(size):
    scale = 4
    image = Image.new("RGBA", (size * scale, size * scale))
    draw = ImageDraw.Draw(image)
    unit = size * scale / 256

    def box(values):
        return tuple(round(value * unit) for value in values)

    def line(points, color, width):
        draw.line([box(point) for point in points], fill=color,
                  width=round(width * unit), joint="curve")

    draw.rounded_rectangle(box((8, 8, 248, 248)), radius=round(52 * unit), fill="#102C46")
    # Building, linked process nodes and a clear direction of flow.
    draw.rounded_rectangle(box((72, 52, 166, 200)), radius=round(10 * unit), fill="#F1F7FC")
    for x in (88, 118, 148):
        for y in (72, 102):
            draw.rounded_rectangle(box((x, y, x + 10, y + 14)),
                                   radius=round(2 * unit), fill="#102C46")
    line(((46, 166), (104, 166), (104, 140), (204, 140)), "#20D5BD", 12)
    draw.polygon([box(point) for point in ((192, 122), (213, 140), (192, 158))], fill="#20D5BD")
    draw.ellipse(box((32, 152, 60, 180)), fill="#20D5BD")
    draw.ellipse(box((39, 159, 53, 173)), fill="#102C46")
    return image.resize((size, size), Image.Resampling.LANCZOS)


if __name__ == "__main__":
    target = Path(__file__).resolve().parents[1] / "custom_components/glt_flow_card/brand"
    target.mkdir(exist_ok=True)
    for suffix, size in (("", 256), ("@2x", 512)):
        image = render(size)
        for name in ("icon", "dark_icon", "logo", "dark_logo"):
            image.save(target / f"{name}{suffix}.png", optimize=True)
