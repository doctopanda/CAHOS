"""CAHOS: integrity of custom six-region operational map, Nov 2026."""
import json
import unittest
from collections import Counter
from pathlib import Path


class RegionalizacionOperativaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        source = Path(__file__).resolve().parents[1] / "public" / "data" / "cahos_macrozonas_operativas.json"
        cls.data = json.loads(source.read_text(encoding="utf-8"))
        cls.municipalities = {item["code"]: item for item in cls.data["municipalities"]}
        cls.zones = {z["id"]: z for z in cls.data["zones"]}

    def test_all_municipalities_unique(self):
        self.assertEqual(len(self.municipalities), 72)
        self.assertTrue(all(code.startswith("26") and len(code) == 5 for code in self.municipalities))

    def test_six_operational_zones_match_specification(self):
        self.assertEqual({z: len(v["codes"]) for z, v in self.zones.items()},
                         {"sierra": 29, "frontera": 12, "desierto": 7,
                          "valles_sur": 7, "rio_centro": 13, "litoral": 4})

    def test_no_duplicate_members_within_a_zone(self):
        for zone in self.zones.values():
            self.assertEqual(len(zone["codes"]), len(set(zone["codes"])))

    def test_all_groups_resolve_to_known_municipalities(self):
        for zone in self.zones.values():
            self.assertTrue(set(zone["codes"]).issubset(self.municipalities.keys()))

    def test_overlap_and_unassigned_are_explicit(self):
        counts = Counter(code for zone in self.zones.values() for code in zone["codes"])
        self.assertEqual(len(counts), 65)
        self.assertEqual(len([code for code, n in counts.items() if n > 1]), 7)
        self.assertEqual(sum(counts.values()), 72)
        self.assertEqual(len([code for code in self.municipalities if code not in counts]), 7)
        for code, info in self.municipalities.items():
            expected = {z for z, zone in self.zones.items() if code in zone["codes"]}
            self.assertEqual(set(info["zones"]), expected)

    def test_litoral_valleys_union_is_unique(self):
        a, b = set(self.zones["litoral"]["codes"]), set(self.zones["valles_sur"]["codes"])
        self.assertEqual(len(a & b), 2)
        self.assertEqual(len(a | b), 9)

    def test_custom_region_not_mislabeled_as_official(self):
        self.assertEqual(self.data["status"], "propuesta_operativa_no_oficial")
        self.assertNotEqual(self.data["source"], "")


if __name__ == "__main__":
    unittest.main()
