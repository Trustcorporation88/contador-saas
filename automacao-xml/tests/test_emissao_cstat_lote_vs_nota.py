"""Regressão: emitir_nfe.py não pode confundir o cStat do LOTE com o cStat
da NOTA na resposta de autorização síncrona.

Bug real observado em produção: a tela mostrava "SEFAZ rejeitou a NF-e
(104): Lote processado" — mas cStat 104 significa apenas "Lote processado"
(um status neutro sobre o envelope, não sobre a nota). O motivo real de
aceite/rejeição da nota está em outro elemento, mais profundo no XML
(retEnviNFe/protNFe/infProt/cStat), e como os dois elementos têm o mesmo
nome local ("cStat"), pegar o primeiro encontrado com XPath "//ns:cStat"
sempre captura o do lote, escondendo o motivo real da rejeição.
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
    "modelo": 55,
    "emitente": {"uf": "SP"},
}


@unittest.skipUnless(PYNFE_DISPONIVEL, "pynfe não instalado neste ambiente")
class TestCstatLoteVsNota(unittest.TestCase):
    def _rodar_emissao(self, resposta_xml: str):
        import emitir_nfe

        class FakeResp:
            text = resposta_xml

        with patch.object(
            ComunicacaoSefaz, "__init__", lambda self, *a, **k: None
        ), patch.object(
            ComunicacaoSefaz, "autorizacao", return_value=(1, FakeResp())
        ), patch.object(
            emitir_nfe, "montar_xml", return_value='<xml Id="x"/>'
        ), patch.object(
            AssinaturaA1, "__init__", lambda self, *a, **k: None
        ), patch.object(
            AssinaturaA1, "assinar", lambda self, xml: xml
        ):
            return emitir_nfe._emitir(dict(PAYLOAD_BASE))

    def test_lote_processado_mas_nota_rejeitada_reporta_motivo_da_nota(self):
        # Cenário exato do bug: retEnviNFe/cStat=104 ("Lote processado") só
        # informa que o LOTE foi processado; a nota, dentro dele, foi negada
        # (aqui simulando cStat 110 = Uso Denegado — poderia ser qualquer
        # outro código de rejeição de nota).
        resposta = """<retEnviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <cStat>104</cStat>
  <xMotivo>Lote processado</xMotivo>
  <protNFe versao="4.00">
    <infProt>
      <chNFe>35260711222333000181550010000004001851931684</chNFe>
      <cStat>110</cStat>
      <xMotivo>Uso Denegado</xMotivo>
    </infProt>
  </protNFe>
</retEnviNFe>"""
        resultado = self._rodar_emissao(resposta)

        self.assertFalse(resultado["ok"])
        self.assertEqual(
            resultado["cStat"],
            "110",
            "deveria reportar o cStat da NOTA (110), não o do lote (104) — "
            f"'Lote processado' não é um motivo de rejeição, recebeu cStat={resultado['cStat']!r}",
        )
        self.assertEqual(resultado["motivo"], "Uso Denegado")
        self.assertNotEqual(
            resultado["motivo"],
            "Lote processado",
            "104/'Lote processado' nunca deveria aparecer como motivo de rejeição da nota",
        )

    def test_lote_processado_e_nota_autorizada_normalmente(self):
        # Caminho feliz: cStat 104 (lote) + cStat 100 (nota autorizada) —
        # este vai pelo branch de SUCESSO (status==0), não pelo de falha, mas
        # serve de guarda para não regredir o caso comum.
        resposta = """<retEnviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <cStat>104</cStat>
  <xMotivo>Lote processado</xMotivo>
  <protNFe versao="4.00">
    <infProt>
      <chNFe>35260711222333000181550010000004001851931684</chNFe>
      <dhRecbto>2026-07-27T00:00:00-03:00</dhRecbto>
      <nProt>135260000000001</nProt>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso da NF-e</xMotivo>
    </infProt>
  </protNFe>
</retEnviNFe>"""
        # Esse XML entraria pelo branch de sucesso da pynfe (envio[0]==0), que
        # já tem cobertura própria; aqui só garantimos que o parser de FALHA
        # (se algum dia essa resposta cair nele por outro motivo) também
        # reportaria corretamente o cStat da nota, não do lote.
        resultado = self._rodar_emissao(resposta)
        self.assertEqual(resultado["cStat"], "100")
        self.assertEqual(resultado["motivo"], "Autorizado o uso da NF-e")

    def test_falha_de_lote_sem_protnfe_ainda_reporta_cstat_do_lote(self):
        # Sem protNFe (falha antes de processar a nota em si, ex.: XML
        # malformado) — aí o cStat do lote É o motivo real, e deve continuar
        # sendo usado (não há nada mais específico para buscar).
        resposta = """<retEnviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <cStat>225</cStat>
  <xMotivo>Falha no Schema XML</xMotivo>
</retEnviNFe>"""
        resultado = self._rodar_emissao(resposta)
        self.assertEqual(resultado["cStat"], "225")
        self.assertEqual(resultado["motivo"], "Falha no Schema XML")


if __name__ == "__main__":
    unittest.main()
