"""Regressão: cancelamento de NF-e precisa ser real (evento 110111 na SEFAZ).

Cobre dois bugs corrigidos:
1. `cancelar_nfe.py` deve converter o modelo numérico (55/65) para "nfe"/"nfce"
   antes de chamar `ComunicacaoSefaz.evento()` (mesma causa raiz do bug
   "Modelo não encontrado" já coberto em test_emissao_modelo_regressao.py).
2. A leitura do retorno da SEFAZ usava XPath relativo (".//ns:retEvento/...")
   que nunca encontra o próprio elemento raiz — só descendentes — fazendo
   cStat/protocolo saírem sempre vazios mesmo com sucesso (135).
"""
import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from pynfe.processamento.comunicacao import ComunicacaoSefaz
    from pynfe.processamento.assinatura import AssinaturaA1
    PYNFE_DISPONIVEL = True
except ImportError:
    PYNFE_DISPONIVEL = False


PAYLOAD_BASE = {
    "ambiente": "homologacao",
    "cert_path": "/tmp/fake.pfx",
    "cert_senha": "x",
    "uf": "SP",
    "cnpj": "11222333000181",
    "chave": "35260711222333000181550010000004001851931684",
    "protocolo": "135250000000000",
    "justificativa": "Cancelamento a pedido do cliente conforme solicitacao",
    "modelo": 55,
}


@unittest.skipUnless(PYNFE_DISPONIVEL, "pynfe não instalado neste ambiente")
class TestCancelamentoReal(unittest.TestCase):
    def _rodar(self, resposta_xml: str):
        import cancelar_nfe

        class FakeResp:
            text = resposta_xml

        with patch.object(
            ComunicacaoSefaz, "__init__", lambda self, *a, **k: None
        ), patch.object(
            ComunicacaoSefaz, "evento", return_value=FakeResp()
        ) as mock_evento, patch.object(
            AssinaturaA1, "__init__", lambda self, *a, **k: None
        ), patch.object(
            AssinaturaA1, "assinar", lambda self, xml: xml
        ):
            resultado = cancelar_nfe._cancelar(dict(PAYLOAD_BASE))
            modelo_usado = mock_evento.call_args.kwargs.get("modelo")
        return resultado, modelo_usado

    def test_modelo_numerico_nao_vaza_para_comunicacao_sefaz(self):
        resposta = (
            '<retEvento xmlns="http://www.portalfiscal.inf.br/nfe">'
            "<infEvento><cStat>135</cStat>"
            "<xMotivo>Evento registrado e vinculado a NF-e</xMotivo>"
            "<nProt>135260000000001</nProt>"
            "<dhRegEvento>2026-07-26T00:00:00-03:00</dhRegEvento>"
            "</infEvento></retEvento>"
        )
        _, modelo_usado = self._rodar(resposta)
        self.assertIn(
            modelo_usado,
            ("nfe", "nfce"),
            "modelo numérico vazou para ComunicacaoSefaz.evento "
            f"(recebeu {modelo_usado!r}) — reintroduziria o bug 'Modelo não encontrado'",
        )

    def test_cancelamento_bem_sucedido_extrai_cstat_e_protocolo_do_evento_raiz(self):
        # <retEvento> é o elemento RAIZ da resposta (não um descendente) — o
        # parser precisa lidar com isso corretamente.
        resposta = (
            '<retEvento xmlns="http://www.portalfiscal.inf.br/nfe">'
            "<infEvento><cStat>135</cStat>"
            "<xMotivo>Evento registrado e vinculado a NF-e</xMotivo>"
            "<nProt>135260000000001</nProt>"
            "<dhRegEvento>2026-07-26T00:00:00-03:00</dhRegEvento>"
            "</infEvento></retEvento>"
        )
        resultado, _ = self._rodar(resposta)
        self.assertTrue(resultado["ok"])
        self.assertEqual(resultado["cStat"], "135")
        self.assertEqual(resultado["protocolo"], "135260000000001")
        self.assertEqual(resultado["motivo"], "Evento registrado e vinculado a NF-e")

    def test_cancelamento_rejeitado_pela_sefaz_retorna_ok_false(self):
        resposta = (
            '<retEvento xmlns="http://www.portalfiscal.inf.br/nfe">'
            "<infEvento><cStat>573</cStat>"
            "<xMotivo>Duplicidade de evento</xMotivo>"
            "</infEvento></retEvento>"
        )
        resultado, _ = self._rodar(resposta)
        self.assertFalse(resultado["ok"])
        self.assertEqual(resultado["cStat"], "573")

    def test_exige_protocolo_de_autorizacao(self):
        import cancelar_nfe

        payload = dict(PAYLOAD_BASE)
        payload["protocolo"] = ""
        with self.assertRaises(ValueError):
            cancelar_nfe._cancelar(payload)

    def test_exige_justificativa_minima(self):
        import cancelar_nfe

        payload = dict(PAYLOAD_BASE)
        payload["justificativa"] = "curta"
        with self.assertRaises(ValueError):
            cancelar_nfe._cancelar(payload)

    def test_exige_chave_de_acesso_valida(self):
        import cancelar_nfe

        payload = dict(PAYLOAD_BASE)
        payload["chave"] = "123"
        with self.assertRaises(ValueError):
            cancelar_nfe._cancelar(payload)


if __name__ == "__main__":
    unittest.main()
