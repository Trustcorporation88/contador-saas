"""Regressão cStat 602: total vPIS deve bater com a soma dos itens.

Bug: CST PIS 07 (PISNT, sem vPIS no item) + pis_valor > 0 somado em
totais_icms_pis → SEFAZ rejeita 602.
"""
from __future__ import annotations

import importlib.util
import sys
import unittest
from decimal import Decimal
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

SPEC = importlib.util.spec_from_file_location("emitir_nfe", ROOT / "emitir_nfe.py")
emitir_nfe = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(emitir_nfe)

NS = {"n": "http://www.portalfiscal.inf.br/nfe"}


def _payload(pis_aliq=0.65, pis_mod=None, cofins_aliq=3, cofins_mod=None, icms_mod="102"):
    item = {
        "codigo": "1",
        "descricao": "BATERIA",
        "ncm": "85071090",
        "cfop": "5102",
        "unidade": "UN",
        "quantidade": 1,
        "valor_unitario": 222,
        "icms_modalidade": icms_mod,
        "icms_aliquota": 18 if icms_mod == "00" else 0,
        "pis_aliquota": pis_aliq,
        "cofins_aliquota": cofins_aliq,
    }
    if pis_mod is not None:
        item["pis_modalidade"] = pis_mod
    if cofins_mod is not None:
        item["cofins_modalidade"] = cofins_mod
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
            "razao_social": "DEST TESTE",
            "indicador_ie": 9,
            "logradouro": "Rua B",
            "numero": "2",
            "bairro": "Centro",
            "municipio": "Sao Paulo",
            "cod_municipio": "3550308",
            "uf": "SP",
            "cep": "01001000",
        },
        "itens": [item],
    }


def _xml_bytes(xml) -> bytes:
    if isinstance(xml, (bytes, bytearray)):
        return bytes(xml)
    if isinstance(xml, str):
        return xml.encode("utf-8")
    return ET.tostring(xml, encoding="utf-8")


def _totais_do_xml(xml_bytes: bytes):
    root = ET.fromstring(xml_bytes)
    total_vpis = root.findtext(".//n:ICMSTot/n:vPIS", namespaces=NS) or "0"
    itens_vpis = [
        Decimal(n.text or "0")
        for n in root.findall(".//n:det/n:imposto/n:PIS//n:vPIS", namespaces=NS)
    ]
    return Decimal(total_vpis), sum(itens_vpis, Decimal("0"))


class TestPisTotal602(unittest.TestCase):
    def test_cst07_com_aliquota_nao_infla_total(self):
        """Formulário manda PIS 0,65% mas CST padrão 07 → valor deve zerar."""
        xml = emitir_nfe.montar_xml(
            _payload(pis_aliq=0.65, pis_mod="07", cofins_aliq=3, cofins_mod="07"),
            retorna_string=True,
        )
        total, soma_itens = _totais_do_xml(_xml_bytes(xml))
        self.assertEqual(total, Decimal("0.00"))
        self.assertEqual(soma_itens, Decimal("0"))
        self.assertEqual(total, soma_itens)

    def test_aliquota_sem_modalidade_usa_01_e_bate_total(self):
        xml = emitir_nfe.montar_xml(
            _payload(pis_aliq=0.65, pis_mod=None, cofins_aliq=3, cofins_mod=None, icms_mod="00"),
            retorna_string=True,
        )
        total, soma_itens = _totais_do_xml(_xml_bytes(xml))
        # 222 * 0.65% = 1.443 → 1.44
        self.assertEqual(total, Decimal("1.44"))
        self.assertEqual(soma_itens, Decimal("1.44"))
        self.assertEqual(total, soma_itens)

    def test_simples_estilo_formulario_822_total_zero(self):
        """Caso real 822: CSOSN 102 + alíquotas PIS/COFINS no form."""
        xml = emitir_nfe.montar_xml(
            _payload(pis_aliq=0.65, pis_mod="07", cofins_aliq=3, cofins_mod="07", icms_mod="102"),
            retorna_string=True,
        )
        total, soma_itens = _totais_do_xml(_xml_bytes(xml))
        self.assertEqual(total, soma_itens)


if __name__ == "__main__":
    unittest.main()
