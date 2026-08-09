"""Regressão: a forma de pagamento escolhida precisa chegar no XML.

Bug: o formulário oferecia dinheiro/cartão/boleto/PIX/sem pagamento e o DTO
recebia o valor, mas o backend mandava forma_pagamento '01' fixo no payload —
toda nota saía como paga em dinheiro, no valor cheio.
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


def _payload(forma_pagamento=None, valor_unitario=100):
    payload = {
        "ambiente": "homologacao",
        "modelo": 55,
        "serie": 1,
        "numero": 901,
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
        "itens": [
            {
                "codigo": "1",
                "descricao": "PRODUTO",
                "ncm": "85071090",
                "cfop": "5102",
                "unidade": "UN",
                "quantidade": 1,
                "valor_unitario": valor_unitario,
                "icms_modalidade": "102",
                "icms_aliquota": 0,
                "pis_aliquota": 0,
                "cofins_aliquota": 0,
            }
        ],
    }
    if forma_pagamento is not None:
        payload["forma_pagamento"] = forma_pagamento
    return payload


def _pagamento(forma_pagamento=None, valor_unitario=100):
    xml = emitir_nfe.montar_xml(_payload(forma_pagamento, valor_unitario), retorna_string=True)
    root = ET.fromstring(xml.encode("utf-8") if isinstance(xml, str) else xml)
    return (
        root.findtext(".//n:detPag/n:tPag", namespaces=NS),
        Decimal(root.findtext(".//n:detPag/n:vPag", namespaces=NS) or "0"),
        Decimal(root.findtext(".//n:ICMSTot/n:vNF", namespaces=NS) or "0"),
    )


class TestFormaPagamento(unittest.TestCase):
    def test_pix(self):
        t_pag, v_pag, v_nf = _pagamento("17")
        self.assertEqual(t_pag, "17")
        self.assertEqual(v_pag, v_nf)

    def test_cartao_credito(self):
        t_pag, v_pag, v_nf = _pagamento("03")
        self.assertEqual(t_pag, "03")
        self.assertEqual(v_pag, v_nf)

    def test_boleto(self):
        self.assertEqual(_pagamento("15")[0], "15")

    def test_omitido_usa_dinheiro(self):
        self.assertEqual(_pagamento(None)[0], "01")

    def test_normaliza_um_digito(self):
        self.assertEqual(_pagamento("3")[0], "03")

    def test_sem_pagamento_zera_vpag(self):
        """tPag 90: a SEFAZ exige vPag 0,00, mesmo com vNF cheio."""
        t_pag, v_pag, v_nf = _pagamento("90")
        self.assertEqual(t_pag, "90")
        self.assertEqual(v_pag, Decimal("0.00"))
        self.assertEqual(v_nf, Decimal("100.00"))

    def test_forma_normal_nao_e_zerada(self):
        _, v_pag, v_nf = _pagamento("01")
        self.assertEqual(v_pag, v_nf)
        self.assertNotEqual(v_pag, Decimal("0.00"))


if __name__ == "__main__":
    unittest.main()
