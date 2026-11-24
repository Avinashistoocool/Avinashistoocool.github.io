import unittest

from build_data import parse_contributions


class ContributionCalendarTests(unittest.TestCase):
    def test_counts_public_days(self):
        page = (
            '<td data-date="2026-11-24" id="contribution-day-component-0-0" data-level="0"></td>'
            '<tool-tip for="contribution-day-component-0-0">No contributions on November 24th.</tool-tip>'
            '<td data-date="2026-11-25" id="contribution-day-component-1-0" data-level="2"></td>'
            '<tool-tip for="contribution-day-component-1-0">3 contributions on November 25th.</tool-tip>'
        )
        result = parse_contributions(page)
        self.assertEqual(result["total"], 3)
        self.assertEqual([d["date"] for d in result["days"]], ["2026-11-24", "2026-11-25"])

    def test_rejects_incomplete_calendar(self):
        page = '<td data-date="2026-11-25" id="contribution-day-component-1-0" data-level="2"></td>'
        with self.assertRaisesRegex(ValueError, "missing days or contribution counts"):
            parse_contributions(page)


if __name__ == "__main__":
    unittest.main()
