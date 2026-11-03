from pipeline.validate.truth import check_hashes


def test_ground_truth_is_intact():
    assert check_hashes() == []
