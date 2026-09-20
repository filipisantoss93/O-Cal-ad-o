import importlib.util
import tempfile
import unittest
import zipfile
from pathlib import Path

IMPORTER = Path(__file__).resolve().parents[1] / "import-receita-cnpj.py"
spec = importlib.util.spec_from_file_location("rfb_cnpj_importer", IMPORTER)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def zipped(path, line):
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("RFB.CSV", line.encode("latin-1"))


class CnpjImporterTests(unittest.TestCase):
    def test_natureza_privada_sem_pessoa_fisica(self):
        self.assertTrue(module.private_nature("2062"))
        self.assertFalse(module.private_nature("1244"))
        self.assertFalse(module.private_nature("2135"))
        self.assertFalse(module.private_nature("4014"))
        self.assertFalse(module.private_nature(""))

    def test_cnae_permitido_com_mapeamento(self):
        self.assertTrue(module.eligible_cnae("5611201"))
        self.assertTrue(module.eligible_cnae("4711302"))
        self.assertFalse(module.eligible_cnae("9999999"))
        self.assertFalse(module.eligible_cnae(""))

    def test_piloto_prezerva_complemento_e_exclui_contatos(self):
        row = [""] * 30
        row[0], row[1], row[2] = "12345678", "0001", "95"
        row[4], row[5], row[11] = "LOJA TESTE", "02", "4711302"
        row[13], row[14], row[15], row[16] = "RUA", "COMERCIAL", "100", "SALA 3"
        row[17], row[18], row[19], row[20] = "CENTRO", "19800000", "SP", "6210"
        row[21], row[22], row[27] = "11", "999999999", "nome@example.org"
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / "estabs.zip"
            zipped(archive, ";".join('"' + field + '"' for field in row) + "\n")
            records, stats = module.selected_establishments(
                archive, {"6210": "Assis"}, "SP", "Assis", 3
            )
        self.assertEqual(stats["eligible_before_nature"], 1)
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["complemento"], "SALA 3")
        self.assertEqual(records[0]["logradouro"], "RUA COMERCIAL")
        self.assertEqual(records[0]["cnpj"], "12345678000195")
        self.assertFalse(any("telefone" in key or "email" in key or "socio" in key
                             for key in records[0]))

    def test_rejeita_layout_errado(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / "bad.zip"
            zipped(archive, "um;dois\n")
            with self.assertRaises(ValueError):
                list(module.csv_rows(archive, 30))


if __name__ == "__main__":
    unittest.main()
