from progress.services import epley


def test_epley_estimate():
    assert epley(80, 10) == 80 * (1 + 10 / 30)


def test_epley_rejects_invalid_sets():
    assert epley(0, 10) == 0
    assert epley(80, 0) == 0
