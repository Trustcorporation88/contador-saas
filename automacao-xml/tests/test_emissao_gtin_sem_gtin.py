"""Regressão: item sem GTIN deve ir como literal SEM GTIN (evita cStat 883)."""
from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

SPEC = importlib.util.spec_from_file_location("emitir_nfe", ROOT / "emitir_nfe.py")
emitir_nfe = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(emitir_nfe)


def _payload_minimo():
    return {
        "ambiente": "homologacao",
        "modelo": 55,
        "serie": 1,
        "numero": 823,
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
            "numero_documento": "12345678901",
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
                "descricao": "Produto sem codigo de barras",
                "ncm": "84713012",
                "cfop": "5102",
                "unidade": "UN",
                "quantidade": 1,
                "valor_unitario": 222,
                "icms_modalidade": "102",
            }
        ],
    }


class TestGtinSemGtin(unittest.TestCase):
    def test_default_sem_gtin_quando_ean_ausente(self):
        captured = {}

        fake_nota = MagicMock()

        def fake_add(**kwargs):
            captured.update(kwargs)

        fake_nota.adicionar_produto_servico.side_effect = fake_add
        fake_nota.adicionar_pagamento = MagicMock()

        with (
            patch("pynfe.entidades.emitente.Emitente"),
            patch("pynfe.entidades.cliente.Cliente"),
            patch("pynfe.entidades.notafiscal.NotaFiscal", return_value=fake_nota),
            patch("pynfe.entidades.fonte_dados._fonte_dados") as fonte,
        ):
            fonte.limpar_dados = MagicMock()
            emitir_nfe._construir_nota(_payload_minimo())

        self.assertEqual(captured.get("ean"), "SEM GTIN")
        self.assertEqual(captured.get("ean_tributavel"), "SEM GTIN")

    def test_respeita_ean_informado(self):
        captured = {}
        fake_nota = MagicMock()
        fake_nota.adicionar_produto_servico.side_effect = lambda **kw: captured.update(kw)
        fake_nota.adicionar_pagamento = MagicMock()

        payload = _payload_minimo()
        payload["itens"][0]["ean"] = "7891000100103"
        payload["itens"][0]["ean_tributavel"] = "7891000100103"

        with (
            patch("pynfe.entidades.emitente.Emitente"),
            patch("pynfe.entidades.cliente.Cliente"),
            patch("pynfe.entidades.notafiscal.NotaFiscal", return_value=fake_nota),
            patch("pynfe.entidades.fonte_dados._fonte_dados") as fonte,
        ):
            fonte.limpar_dados = MagicMock()
            emitir_nfe._construir_nota(payload)

        self.assertEqual(captured.get("ean"), "7891000100103")
        self.assertEqual(captured.get("ean_tributavel"), "7891000100103")


if __name__ == "__main__":
    unittest.main()
