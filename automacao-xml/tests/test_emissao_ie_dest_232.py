"""Regressão cStat 232: IE do destinatário não informada indevidamente."""
from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

SPEC = importlib.util.spec_from_file_location("emitir_nfe", ROOT / "emitir_nfe.py")
emitir_nfe = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(emitir_nfe)

NS = {"n": "http://www.portalfiscal.inf.br/nfe"}


def _payload(indicador_ie=9, inscricao_estadual="0000"):
    return {
        "ambiente": "homologacao",
        "modelo": 55,
        "serie": 1,
        "numero": 822,
        "natureza_operacao": "VENDA",
        "emitente": {
            "cnpj": "12345678000199",
            "razao_social": "EMITENTE TESTE",
            "crt": "1",
            "inscricao_estadual": "123",
            "logradouro": "Rua A",
            "numero": "1",
            "bairro": "Centro",
            "municipio": "Sao Paulo",
            "cod_municipio": "3550308",
            "uf": "SP",
            "cep": "01001000",
        },
        "destinatario": {
            "numero_documento": "18589872000100",
            "razao_social": "AFB PONCE CONTABILIDADE LTDA",
            "indicador_ie": indicador_ie,
            "inscricao_estadual": inscricao_estadual,
            "logradouro": "AL CONEGO ANIBAL DIFRANCIA",
            "numero": "7-60",
            "bairro": "PARQUE ALTO SUMARE",
            "municipio": "BAURU",
            "cod_municipio": "3506003",
            "uf": "SP",
            "cep": "17020690",
        },
        "itens": [
            {
                "codigo": "1",
                "descricao": "BATERIA",
                "ncm": "85071090",
                "cfop": "5102",
                "unidade": "UN",
                "quantidade": 1,
                "valor_unitario": 222,
                "icms_modalidade": "102",
                "pis_modalidade": "07",
                "cofins_modalidade": "07",
            }
        ],
    }


def _dest_xml(payload):
    xml = emitir_nfe.montar_xml(payload, retorna_string=True)
    raw = xml.encode("utf-8") if isinstance(xml, str) else bytes(xml)
    root = ET.fromstring(raw)
    dest = root.find(".//n:dest", namespaces=NS)
    assert dest is not None
    ind = dest.findtext("n:indIEDest", namespaces=NS)
    ie = dest.findtext("n:IE", namespaces=NS)
    return ind, ie


class TestIeDest232(unittest.TestCase):
    def test_nao_contribuinte_com_0000_nao_envia_ie(self):
        """Caso do print: indicador 9 + IE 0000 → indIEDest=9 sem tag IE."""
        ind, ie = _dest_xml(_payload(9, "0000"))
        self.assertEqual(ind, "9")
        self.assertIsNone(ie)

    def test_isento_envia_ind_2(self):
        ind, ie = _dest_xml(_payload(2, ""))
        self.assertEqual(ind, "2")
        # pynfe não exige tag IE para isento
        self.assertTrue(ie is None or ie == "ISENTO")

    def test_isento_literal_preservado_na_normalizacao(self):
        ind, ie_val, isento = emitir_nfe._normalizar_ie_destinatario(
            {"indicador_ie": 2, "inscricao_estadual": "ISENTO"}
        )
        self.assertEqual(ind, 2)
        self.assertEqual(ie_val, "ISENTO")
        self.assertTrue(isento)

    def test_contribuinte_exige_ie_digitos(self):
        ind, ie_val, isento = emitir_nfe._normalizar_ie_destinatario(
            {"indicador_ie": 1, "inscricao_estadual": "10.20.30-4"}
        )
        self.assertEqual(ind, 1)
        self.assertEqual(ie_val, "1020304")
        self.assertFalse(isento)


if __name__ == "__main__":
    unittest.main()
