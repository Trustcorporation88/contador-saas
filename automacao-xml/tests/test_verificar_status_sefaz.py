"""Regressão: status SEFAZ não pode virar 'fora de operação' por parse frágil."""
from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

SPEC = importlib.util.spec_from_file_location(
    "verificar_numeracao_nfe", ROOT / "verificar_numeracao_nfe.py"
)
vnn = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules["verificar_numeracao_nfe"] = vnn
SPEC.loader.exec_module(vnn)


SOAP_107 = """<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Body>
    <nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
      <retConsStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
        <tpAmb>2</tpAmb>
        <cStat>107</cStat>
        <xMotivo>Servico em Operacao</xMotivo>
        <cUF>35</cUF>
      </retConsStatServ>
    </nfeResultMsg>
  </soap:Body>
</soap:Envelope>"""

SOAP_109 = """<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Body>
    <retConsStatServ xmlns="http://www.portalfiscal.inf.br/nfe">
      <cStat>109</cStat>
      <xMotivo>Servico Paralisado sem Previsao</xMotivo>
    </retConsStatServ>
  </soap:Body>
</soap:Envelope>"""


class TestStatusSefazParse(unittest.TestCase):
    def test_extract_cstat_de_soap(self):
        cstat, motivo = vnn._extract_cstat_motivo(SOAP_107)
        self.assertEqual(cstat, "107")
        self.assertIn("Operacao", motivo)

    def test_apenas_107_e_online(self):
        self.assertTrue(vnn._status_online("107", "Servico em Operacao"))
        self.assertFalse(vnn._status_online("108", "Paralisado Momentaneamente"))
        self.assertFalse(vnn._status_online("109", "Paralisado sem Previsao"))
        self.assertFalse(vnn._status_online("", ""))

    def test_check_com_soap_107_online(self):
        resp = MagicMock()
        resp.text = SOAP_107
        con = MagicMock()
        con.status_servico.return_value = resp

        with patch("pynfe.processamento.comunicacao.ComunicacaoSefaz", return_value=con):
            result = vnn._check(
                {
                    "ambiente": "homologacao",
                    "cert_path": "/tmp/x.pfx",
                    "cert_senha": "x",
                    "uf": "SP",
                    "modelo": 55,
                    "serie": 1,
                    "numero": 11,
                }
            )
        self.assertTrue(result["sefaz_online"])
        self.assertTrue(result["ok"])
        self.assertEqual(result["cStat"], "107")

    def test_check_109_offline_com_cstat(self):
        resp = MagicMock()
        resp.text = SOAP_109
        con = MagicMock()
        con.status_servico.return_value = resp

        with patch("pynfe.processamento.comunicacao.ComunicacaoSefaz", return_value=con):
            result = vnn._check(
                {
                    "ambiente": "homologacao",
                    "cert_path": "/tmp/x.pfx",
                    "cert_senha": "x",
                    "uf": "SP",
                    "modelo": 55,
                    "serie": 1,
                    "numero": 11,
                }
            )
        self.assertFalse(result["sefaz_online"])
        self.assertIn("109", result["motivo"])
        self.assertNotEqual(result["motivo"], "SEFAZ fora de operação")

    def test_resposta_sem_cstat_nao_inventa_offline(self):
        resp = MagicMock()
        resp.text = "<soap:Envelope xmlns:soap='http://www.w3.org/2003/05/soap-envelope'><soap:Body/></soap:Envelope>"
        con = MagicMock()
        con.status_servico.return_value = resp

        with patch("pynfe.processamento.comunicacao.ComunicacaoSefaz", return_value=con):
            result = vnn._check(
                {
                    "ambiente": "homologacao",
                    "cert_path": "/tmp/x.pfx",
                    "cert_senha": "x",
                    "uf": "SP",
                    "modelo": 55,
                    "serie": 1,
                    "numero": 11,
                }
            )
        self.assertTrue(result["sefaz_online"])
        self.assertTrue(result["ok"])
        self.assertEqual(result["fonte"], "sefaz_status_parcial")


if __name__ == "__main__":
    unittest.main()
