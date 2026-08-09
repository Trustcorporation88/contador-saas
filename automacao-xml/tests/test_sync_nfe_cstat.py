"""Regressão: DistDFe com cStat de rejeição não pode parecer sucesso vazio."""
from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path
from unittest.mock import ANY, MagicMock, patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

SPEC = importlib.util.spec_from_file_location("sync_nfe", ROOT / "sync_nfe.py")
sync_nfe = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules["sync_nfe"] = sync_nfe
SPEC.loader.exec_module(sync_nfe)


class TestDistDfeCstat(unittest.TestCase):
    def test_cstat_rejeicao_levanta_erro(self):
        empresa = MagicMock()
        empresa.company_id = "co-1"
        empresa.cnpj = "12345678000199"
        empresa.uf = "SP"
        empresa.pfx = "/tmp/x.pfx"
        empresa.senha = "x"

        xml = """<?xml version="1.0"?>
        <retDistDFeInt xmlns="http://www.portalfiscal.inf.br/nfe">
          <cStat>656</cStat>
          <xMotivo>Rejeicao: Consumo Indevido</xMotivo>
        </retDistDFeInt>"""

        resposta = MagicMock()
        resposta.text = xml
        con = MagicMock()
        con.consulta_distribuicao.return_value = resposta

        with (
            patch.object(sync_nfe, "alerta_expiracao", return_value=None),
            patch.object(sync_nfe, "homologacao", return_value=True),
            patch.object(sync_nfe, "get_cursor", return_value="0"),
            patch.object(sync_nfe, "save_cursor") as save_cursor,
            patch("pynfe.processamento.comunicacao.ComunicacaoSefaz", return_value=con),
        ):
            with self.assertRaises(RuntimeError) as ctx:
                sync_nfe.sync_empresa_nfe(empresa, "co-1")
            self.assertIn("656", str(ctx.exception))
            save_cursor.assert_any_call(
                "co-1",
                "nfe",
                "0",
                status="error",
                error=ANY,
            )

    def test_cstat_137_sem_docs_ok(self):
        empresa = MagicMock()
        empresa.company_id = "co-1"
        empresa.cnpj = "12345678000199"
        empresa.uf = "SP"
        empresa.pfx = "/tmp/x.pfx"
        empresa.senha = "x"

        xml = """<?xml version="1.0"?>
        <retDistDFeInt xmlns="http://www.portalfiscal.inf.br/nfe">
          <cStat>137</cStat>
          <xMotivo>Nenhum documento localizado</xMotivo>
          <ultNSU>0</ultNSU>
          <maxNSU>0</maxNSU>
        </retDistDFeInt>"""

        resposta = MagicMock()
        resposta.text = xml
        con = MagicMock()
        con.consulta_distribuicao.return_value = resposta

        with (
            patch.object(sync_nfe, "alerta_expiracao", return_value=None),
            patch.object(sync_nfe, "homologacao", return_value=True),
            patch.object(sync_nfe, "get_cursor", return_value="0"),
            patch.object(sync_nfe, "save_cursor") as save_cursor,
            patch("pynfe.processamento.comunicacao.ComunicacaoSefaz", return_value=con),
        ):
            result = sync_nfe.sync_empresa_nfe(empresa, "co-1")
            self.assertEqual(result.capturados, 0)
            save_cursor.assert_called_with("co-1", "nfe", "0", status="ok")

    def test_resposta_sem_cstat_e_sem_docs_levanta_erro(self):
        """SOAP inesperado (sem cStat legível e sem docZip) não é sucesso vazio."""
        empresa = MagicMock()
        empresa.company_id = "co-1"
        empresa.cnpj = "12345678000199"
        empresa.uf = "SP"
        empresa.pfx = "/tmp/x.pfx"
        empresa.senha = "x"

        # Envelope SOAP de erro, sem o namespace da NF-e: o findtext de cStat
        # não acha nada e antes disso o loop encerrava como "0 XMLs, tudo ok".
        xml = """<?xml version="1.0"?>
        <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
          <soap:Body><soap:Fault><soap:Reason>
            <soap:Text>Service Unavailable</soap:Text>
          </soap:Reason></soap:Fault></soap:Body>
        </soap:Envelope>"""

        resposta = MagicMock()
        resposta.text = xml
        con = MagicMock()
        con.consulta_distribuicao.return_value = resposta

        with (
            patch.object(sync_nfe, "alerta_expiracao", return_value=None),
            patch.object(sync_nfe, "homologacao", return_value=True),
            patch.object(sync_nfe, "get_cursor", return_value="0"),
            patch.object(sync_nfe, "save_cursor") as save_cursor,
            patch("pynfe.processamento.comunicacao.ComunicacaoSefaz", return_value=con),
        ):
            with self.assertRaises(RuntimeError) as ctx:
                sync_nfe.sync_empresa_nfe(empresa, "co-1")
            self.assertIn("sem cStat", str(ctx.exception))
            save_cursor.assert_any_call("co-1", "nfe", "0", status="error", error=ANY)


if __name__ == "__main__":
    unittest.main()
