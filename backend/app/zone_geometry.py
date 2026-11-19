"""Shapes for rest zones: checking a drawn shape, and how much of a person's box lies inside one.
Plain Python, no extra packages. Points are (x, y) pairs; y grows downward, as in pictures."""


def _side(a, b, c) -> float:
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def edges_cross(points) -> bool:
    """True if two edges of the shape cross each other (a bow-tie shape), which has no clear inside.
    The same check as the web app (frontend/shared/src/schemas.ts, zoneEdgesCross)."""
    n = len(points)
    for i in range(n):
        for j in range(i + 1, n):
            if j == i + 1 or (i == 0 and j == n - 1):
                continue                                   # neighbouring edges share a dot
            a, b = points[i], points[(i + 1) % n]
            c, d = points[j], points[(j + 1) % n]
            if _side(a, b, c) * _side(a, b, d) < 0 and _side(c, d, a) * _side(c, d, b) < 0:
                return True
    return False


def area(points) -> float:
    """Area of a shape whose edges don't cross (shoelace formula)."""
    n = len(points)
    return abs(sum(points[i][0] * points[(i + 1) % n][1] - points[(i + 1) % n][0] * points[i][1]
                   for i in range(n))) / 2


def clip_to_box(points, box):
    """The part of the shape inside the box (x1, y1, x2, y2) (Sutherland-Hodgman: the box is the cutter,
    and any shape whose edges don't cross can be cut by a box this way)."""
    x1, y1, x2, y2 = box
    edges = [(lambda p: p[0] >= x1, lambda p, q: _at_x(p, q, x1)),
             (lambda p: p[0] <= x2, lambda p, q: _at_x(p, q, x2)),
             (lambda p: p[1] >= y1, lambda p, q: _at_y(p, q, y1)),
             (lambda p: p[1] <= y2, lambda p, q: _at_y(p, q, y2))]
    out = list(points)
    for inside, cut in edges:
        if not out:
            break
        src, out = out, []
        for i, cur in enumerate(src):
            prev = src[i - 1]
            if inside(cur):
                if not inside(prev):
                    out.append(cut(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(cut(prev, cur))
    return out


def _at_x(p, q, x):
    t = (x - p[0]) / (q[0] - p[0])
    return x, p[1] + t * (q[1] - p[1])


def _at_y(p, q, y):
    t = (y - p[1]) / (q[1] - p[1])
    return p[0] + t * (q[0] - p[0]), y


def share_of_box_inside(box, points) -> float:
    """How much of the box (0..1) lies inside the shape. Box and points in the same units (pixels)."""
    box_area = (box[2] - box[0]) * (box[3] - box[1])
    if box_area <= 0:
        return 0.0
    part = clip_to_box(points, box)
    return area(part) / box_area if len(part) >= 3 else 0.0
