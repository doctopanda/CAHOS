"""Verifica la base territorial CAHOS sin descargar datos clínicos.

La separación explícita entre las distintas fuentes impide atribuir como
oficiales las zonas operativas de usuario o límites IMSS no documentados.
"""
import json
import re
import unittest
from collections import Counter
from pathlib import Path

PATH = Path(__file__).resolve().parents[1] / "public" / "mapa-cahos" / "regiones-sonora.json"


class RegionalizationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads(PATH.read_text(encoding="utf-8"))
        cls.items = cls.data["regionalizations"]

    def test_official_districts_are_an_exclusive_partition(self):
        regions = self.items["districts"]["regions"]
        self.assertEqual(len(regions), 6)
        self.assertEqual([len(x["municipalities"]) for x in regions], [32, 7, 17, 8, 5, 3])
        groups = Counter(code for x in regions for code in x["municipalities"])
        self.assertEqual(len(groups), 72)
        self.assertEqual(set(groups.values()), {1})

    def test_coespo_regions_cover_exactly_72_municipalities(self):
        regions = self.items["coespo"]["regions"]
        self.assertEqual(len(regions), 10)
        groups = Counter(code for x in regions for code in x["municipalities"])
        self.assertEqual(len(groups), 72)
        self.assertEqual(set(groups.values()), {1})

    def test_user_zones_keep_overlaps_and_unassigned(self):
        item = self.items["custom"]
        regions = item["regions"]
        self.assertEqual(len(regions), 6)
        self.assertEqual([len(x["municipalities"]) for x in regions], [29, 12, 7, 7, 13, 4])
        groups = Counter(code for x in regions for code in x["municipalities"])
        self.assertEqual(sum(groups.values()), 72)
        self.assertEqual(len(groups), 65)
        self.assertEqual(len([code for code, n in groups.items() if n == 2]), 7)
        self.assertEqual(set(item["unassigned"]).isdisjoint(groups), True)
        self.assertEqual(len(item["unassigned"]), 7)

    def test_imss_does_not_claim_unverified_region_boundaries(self):
        regions = self.items["imss"]["regions"]
        self.assertEqual(len(regions), 10)
        self.assertEqual(len({x["seat_municipality"] for x in regions}), 10)
        self.assertTrue(all(x["municipalities"] == [] for x in regions))
        self.assertEqual(self.items["imss"]["coverage"], "pending_municipal_crosswalk")

    def test_codes_are_sonora_inegi_codes(self):
        for scheme, item in self.items.items():
            for region in item["regions"]:
                for code in region["municipalities"]:
                    self.assertRegex(code, r"^26\d{3}$", scheme)
                if "seat_municipality" in region:
                    self.assertRegex(region["seat_municipality"], r"^26\d{3}$", scheme)


if __name__ == "__main__":
    unittest.main()
