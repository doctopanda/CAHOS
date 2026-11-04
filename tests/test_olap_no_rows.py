"""Regression tests for a valid but empty NON EMPTY MDX result.

Run without a Windows MSOLAP connection, secrets, or downloaded case data.
Only the parser function is loaded via AST; the server is never started.
"""
import ast
import unittest
from pathlib import Path


def parser():
    source = Path(__file__).resolve().parents[1] / "extractor" / "servidor.py"
    tree = ast.parse(source.read_text(encoding="utf-8"))
    target = next(n for n in tree.body if isinstance(n, ast.FunctionDef)
                  and n.name == "normalise_flat_response")
    code = compile(ast.Module(body=[target], type_ignores=[]), str(source), "exec")
    namespace = {"WITH_HIERARCHIES": {"years": "[Años].[Año]"}}
    exec(code, namespace)
    return namespace["normalise_flat_response"]


class EmptyMdxTests(unittest.TestCase):
    def test_no_rows_and_no_columns(self):
        self.assertEqual(parser()({"rows": [], "columns": []}, ["years"]), [])

    def test_no_rows_with_unexpected_column_headers(self):
        self.assertEqual(parser()({"rows": [], "columns": ["provider-generated-header"]}, ["years"]), [])

    def test_rows_without_columns_are_a_real_error(self):
        with self.assertRaisesRegex(RuntimeError, "metadatos de columnas"):
            parser()({"rows": [["2026", 5]], "columns": []}, ["years"])

    def test_malformed_rows_are_a_real_error(self):
        with self.assertRaisesRegex(RuntimeError, "estructura de filas"):
            parser()({"rows": "not-a-list", "columns": []}, ["years"])


if __name__ == "__main__":
    unittest.main()
