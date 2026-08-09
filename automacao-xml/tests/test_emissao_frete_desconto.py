"""Regressão: frete e desconto informados precisam entrar no XML da NF-e.

Bug: o payload trazia `frete`/`desconto`, mas eles só eram usados no vPag do
pagamento. A NF-e 4.00 não tem frete/desconto "da nota" — vFrete e vDesc do
ICMSTot são o somatório dos itens. Sem ratear nos itens o documento saía com
vFrete/vDesc 0,00, vNF sem o frete/desconto e vPag divergindo do vNF.
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


def _payload(itens, frete=0, desconto=0, icms_mod="102", icms_aliq=0):
    return {
        "ambiente": "homologacao",
        "modelo": 55,
        "serie": 1,
        "numero": 900,
        "natureza_operacao": "VENDA",
        "frete": frete,
        "desconto": desconto,
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
                "codigo": str(i + 1),
                "descricao": item["descricao"],
                "ncm": "85071090",
                "cfop": "5102",
                "unidade": "UN",
                "quantidade": item["quantidade"],
                "valor_unitario": item["valor_unitario"],
                "icms_modalidade": icms_mod,
                "icms_aliquota": icms_aliq,
                "pis_aliquota": 0,
                "cofins_aliquota": 0,
            }
            for i, item in enumerate(itens)
        ],
    }


def _xml_bytes(xml) -> bytes:
    if isinstance(xml, (bytes, bytearray)):
        return bytes(xml)
    if isinstance(xml, str):
        return xml.encode("utf-8")
    return ET.tostring(xml, encoding="utf-8")


def _dec(root, caminho: str) -> Decimal:
    return Decimal(root.findtext(caminho, namespaces=NS) or "0")


def _soma_itens(root, tag: str) -> Decimal:
    return sum(
        (Decimal(n.text or "0") for n in root.findall(f".//n:det/n:prod/n:{tag}", namespaces=NS)),
        Decimal("0"),
    )


def _montar(payload):
    return ET.fromstring(_xml_bytes(emitir_nfe.montar_xml(payload, retorna_string=True)))


class TestFreteDescontoNoXml(unittest.TestCase):
    def test_frete_e_desconto_entram_no_total(self):
        root = _montar(
            _payload(
                [{"descricao": "BATERIA", "quantidade": 1, "valor_unitario": 200}],
                frete=50,
                desconto=30,
            )
        )
        self.assertEqual(_dec(root, ".//n:ICMSTot/n:vProd"), Decimal("200.00"))
        self.assertEqual(_dec(root, ".//n:ICMSTot/n:vFrete"), Decimal("50.00"))
        self.assertEqual(_dec(root, ".//n:ICMSTot/n:vDesc"), Decimal("30.00"))
        # 200 + 50 - 30
        self.assertEqual(_dec(root, ".//n:ICMSTot/n:vNF"), Decimal("220.00"))

    def test_vnf_igual_ao_vpag(self):
        root = _montar(
            _payload(
                [
                    {"descricao": "ITEM A", "quantidade": 2, "valor_unitario": 99.9},
                    {"descricao": "ITEM B", "quantidade": 1, "valor_unitario": 10.05},
                ],
                frete=17.77,
                desconto=5.55,
            )
        )
        self.assertEqual(
            _dec(root, ".//n:ICMSTot/n:vNF"),
            _dec(root, ".//n:pag/n:detPag/n:vPag"),
        )

    def test_rateio_fecha_com_o_total_informado(self):
        """Três itens com valores que não dividem exato: soma dos itens = total."""
        root = _montar(
            _payload(
                [
                    {"descricao": "A", "quantidade": 1, "valor_unitario": 10},
                    {"descricao": "B", "quantidade": 1, "valor_unitario": 10},
                    {"descricao": "C", "quantidade": 1, "valor_unitario": 10},
                ],
                frete=10,
                desconto=1,
            )
        )
        self.assertEqual(_soma_itens(root, "vFrete"), Decimal("10.00"))
        self.assertEqual(_soma_itens(root, "vDesc"), Decimal("1.00"))
        self.assertEqual(_dec(root, ".//n:ICMSTot/n:vFrete"), Decimal("10.00"))
        self.assertEqual(_dec(root, ".//n:ICMSTot/n:vDesc"), Decimal("1.00"))
        self.assertEqual(_dec(root, ".//n:ICMSTot/n:vNF"), Decimal("39.00"))

    def test_base_icms_considera_frete_e_desconto(self):
        """Regime normal (CST 00): vBC = vProd + vFrete - vDesc."""
        root = _montar(
            _payload(
                [{"descricao": "ITEM", "quantidade": 1, "valor_unitario": 100}],
                frete=20,
                desconto=10,
                icms_mod="00",
                icms_aliq=18,
            )
        )
        self.assertEqual(_dec(root, ".//n:ICMS00/n:vBC"), Decimal("110.00"))
        self.assertEqual(_dec(root, ".//n:ICMS00/n:vICMS"), Decimal("19.80"))
        self.assertEqual(_dec(root, ".//n:ICMSTot/n:vBC"), Decimal("110.00"))
        self.assertEqual(_dec(root, ".//n:ICMSTot/n:vICMS"), Decimal("19.80"))

    def test_sem_frete_nem_desconto_nao_muda_nada(self):
        root = _montar(
            _payload([{"descricao": "ITEM", "quantidade": 3, "valor_unitario": 33.33}])
        )
        self.assertEqual(_dec(root, ".//n:ICMSTot/n:vFrete"), Decimal("0.00"))
        self.assertEqual(_dec(root, ".//n:ICMSTot/n:vDesc"), Decimal("0.00"))
        self.assertEqual(_dec(root, ".//n:ICMSTot/n:vNF"), Decimal("99.99"))
        self.assertEqual(_soma_itens(root, "vFrete"), Decimal("0"))

    def test_desconto_maior_que_a_nota_e_recusado(self):
        with self.assertRaises(ValueError):
            _montar(
                _payload(
                    [{"descricao": "ITEM", "quantidade": 1, "valor_unitario": 100}],
                    desconto=150,
                )
            )


class TestRateio(unittest.TestCase):
    def test_residuo_vai_para_o_ultimo_item(self):
        partes = emitir_nfe._ratear(
            Decimal("10.00"),
            [Decimal("10"), Decimal("10"), Decimal("10")],
        )
        self.assertEqual(sum(partes), Decimal("10.00"))
        self.assertEqual(partes, [Decimal("3.33"), Decimal("3.33"), Decimal("3.34")])

    def test_total_zero_nao_rateia(self):
        self.assertEqual(
            emitir_nfe._ratear(Decimal("0"), [Decimal("5"), Decimal("5")]),
            [Decimal("0"), Decimal("0")],
        )

    def test_itens_zerados_dividem_igualmente(self):
        partes = emitir_nfe._ratear(Decimal("10.00"), [Decimal("0"), Decimal("0")])
        self.assertEqual(sum(partes), Decimal("10.00"))


if __name__ == "__main__":
    unittest.main()
