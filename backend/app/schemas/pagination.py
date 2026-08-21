from math import ceil


def get_total_pages(total: int, page_size: int) -> int:
    """Return zero pages for an empty collection and a ceiling otherwise."""
    return ceil(total / page_size) if total else 0