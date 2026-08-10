"""IPI na emissão real da NF-e.

As colunas aliquota_ipi/valor_ipi existiam em nfe_itens desde a criação da tabela
e nada as escrevia ou lia: o XML saía sempre com vIPI 0,00 e sem grupo <IPI>.
Quem é contribuinte do imposto (indústria, importador) não conseguia emitir nota
com IPI destacado.

Este teste exercita o XML de verdade (montar_xml → pynfe), porque o que importa é
o documento que chega à SEFAZ:

  - sem IPI informado, o grupo não aparece e nada muda no total (nota de quem não
    é contribuinte precisa continuar saindo igual);
  - CST tributado (50) gera <IPITrib> com vBC/pIPI/vIPI e SOMA no vNF — o IPI é
    tributo "por dentro" do total da nota, diferente de ICMS/PIS/COFINS;
  - CST não tributado (51..55) gera <IPINT>, sem valor, e não soma no total;
  - vPag precisa acompanhar o vNF, senão a SEFAZ rejeita a nota.

Atenção ao nome dos campos no pynfe: ipi_codigo_enquadramento é o CST, e
ipi_classe_enquadramento é o cEnq (999 = tributação normal).
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


def _payload(item_extra=None, quantidade=1, valor_unitario=200):
    item = {
        "codigo": "1",
        "descricao": "MOTOR ELETRICO",
        "ncm": "85011019",
        "cfop": "5101",
        "unidade": "UN",
        "quantidade": quantidade,
        "valor_unitario": valor_unitario,
        # Regime normal: ICMS destacado, para o cenário ser o de uma indústria.
        "icms_modalidade": "00",
        "icms_aliquota": 18,
        "pis_aliquota": 0,
        "cofins_aliquota": 0,
    }
    item.update(item_extra or {})
    return {
        "ambiente": "homologacao",
        "modelo": 55,
        "serie": 1,
        "numero": 901,
        "natureza_operacao": "VENDA",
        "emitente": {
            "cnpj": "12345678000199",
            "razao_social": "INDUSTRIA TESTE",
            "crt": "3",
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


def _montar(payload):
    return ET.fromstring(_xml_bytes(emitir_nfe.montar_xml(payload, retorna_string=True)))


def _dec(root, caminho: str) -> Decimal:
    return Decimal(root.findtext(caminho, namespaces=NS) or "0")


class TestIpiNaEmissao(unittest.TestCase):

    def test_sem_ipi_o_grupo_nao_aparece_e_o_total_nao_muda(self):
        root = _montar(_payload())
        self.assertIsNone(root.find(".//n:det/n:imposto/n:IPI", namespaces=NS))
        self.assertEqual(_dec(root, ".//n:ICMSTot/n:vIPI"), Decimal("0.00"))
        self.assertEqual(_dec(root, ".//n:ICMSTot/n:vNF"), Decimal("200.00"))

    def test_cst_tributado_gera_ipitrib_com_valores(self):
        root = _montar(_payload({"ipi_cst": "50", "ipi_aliquota": 10}))
        ipi = root.find(".//n:det/n:imposto/n:IPI", namespaces=NS)
        self.assertIsNotNone(ipi, "grupo IPI ausente para CST tributado")
        self.assertEqual(ipi.findtext("n:cEnq", namespaces=NS), "999")

        trib = ipi.find("n:IPITrib", namespaces=NS)
        self.assertIsNotNone(trib, "IPITrib ausente para CST 50")
        self.assertEqual(trib.findtext("n:CST", namespaces=NS), "50")
        self.assertEqual(Decimal(trib.findtext("n:vBC", namespaces=NS)), Decimal("200.00"))
        self.assertEqual(Decimal(trib.findtext("n:pIPI", namespaces=NS)), Decimal("10.00"))
        self.assertEqual(Decimal(trib.findtext("n:vIPI", namespaces=NS)), Decimal("20.00"))

    def test_ipi_soma_no_total_e_no_valor_da_nota(self):
        root = _montar(_payload({"ipi_cst": "50", "ipi_aliquota": 10}))
        self.assertEqual(_dec(root, ".//n:ICMSTot/n:vIPI"), Decimal("20.00"))
        # vNF = vProd + vIPI. O IPI compõe o total da nota; ICMS/PIS/COFINS não,
        # porque já estão embutidos no preço do produto.
        self.assertEqual(_dec(root, ".//n:ICMSTot/n:vNF"), Decimal("220.00"))

    def test_vpag_acompanha_o_vnf_com_ipi(self):
        root = _montar(_payload({"ipi_cst": "50", "ipi_aliquota": 10}))
        vnf = _dec(root, ".//n:ICMSTot/n:vNF")
        vpag = _dec(root, ".//n:pag/n:detPag/n:vPag")
        # Divergência entre vPag e vNF é rejeição na SEFAZ.
        self.assertEqual(vpag, vnf)
        self.assertEqual(vpag, Decimal("220.00"))

    def test_cst_nao_tributado_gera_ipint_sem_valor(self):
        root = _montar(_payload({"ipi_cst": "53"}))
        ipi = root.find(".//n:det/n:imposto/n:IPI", namespaces=NS)
        self.assertIsNotNone(ipi, "grupo IPI ausente para CST não tributado")
        self.assertIsNone(ipi.find("n:IPITrib", namespaces=NS))

        ipint = ipi.find("n:IPINT", namespaces=NS)
        self.assertIsNotNone(ipint, "IPINT ausente para CST 53")
        self.assertEqual(ipint.findtext("n:CST", namespaces=NS), "53")
        # Não tributado não soma no total.
        self.assertEqual(_dec(root, ".//n:ICMSTot/n:vIPI"), Decimal("0.00"))
        self.assertEqual(_dec(root, ".//n:ICMSTot/n:vNF"), Decimal("200.00"))

    def test_cenq_especifico_e_respeitado(self):
        root = _montar(_payload({"ipi_cst": "50", "ipi_aliquota": 10, "ipi_cenq": "123"}))
        ipi = root.find(".//n:det/n:imposto/n:IPI", namespaces=NS)
        self.assertEqual(ipi.findtext("n:cEnq", namespaces=NS), "123")

    def test_ipi_por_item_soma_no_total(self):
        payload = _payload({"ipi_cst": "50", "ipi_aliquota": 10})
        segundo = dict(payload["itens"][0])
        segundo.update({"codigo": "2", "descricao": "BOBINA", "valor_unitario": 100})
        payload["itens"].append(segundo)

        root = _montar(payload)
        # 200 × 10% + 100 × 10% = 30
        self.assertEqual(_dec(root, ".//n:ICMSTot/n:vIPI"), Decimal("30.00"))
        self.assertEqual(_dec(root, ".//n:ICMSTot/n:vNF"), Decimal("330.00"))

    def test_aliquota_zero_com_cst_tributado_nao_gera_grupo_invalido(self):
        # IPITrib exige vBC, pIPI e vIPI positivos: sem alíquota o grupo não pode
        # ser montado, ou a SEFAZ rejeita.
        root = _montar(_payload({"ipi_cst": "50", "ipi_aliquota": 0}))
        ipi = root.find(".//n:det/n:imposto/n:IPI", namespaces=NS)
        if ipi is not None:
            self.assertIsNone(ipi.find("n:IPITrib", namespaces=NS))
        self.assertEqual(_dec(root, ".//n:ICMSTot/n:vIPI"), Decimal("0.00"))


if __name__ == "__main__":
    unittest.main()
