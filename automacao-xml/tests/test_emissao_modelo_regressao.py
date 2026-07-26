"""Regressão: emitir_nfe/verificar_numeracao_nfe nunca devem repassar o
modelo numérico (55/65) para a ComunicacaoSefaz do pynfe.

Usa o pynfe real instalado (não um stub), mas troca os métodos de rede da
ComunicacaoSefaz por mocks para não depender de certificado/SEFAZ de verdade.
Isso reproduz fielmente o bug original: antes da correção, esses testes
falhavam com `Exception('Modelo não encontrado! Defina modelo="nfe" ou "nfce"')`.
"""
import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from pynfe.processamento.comunicacao import ComunicacaoSefaz
    PYNFE_DISPONIVEL = True
except ImportError:
    PYNFE_DISPONIVEL = False


@unittest.skipUnless(PYNFE_DISPONIVEL, "pynfe não instalado neste ambiente")
class TestVerificarNumeracaoNfeModelo(unittest.TestCase):
    def test_check_nao_gera_erro_modelo_nao_encontrado(self):
        import verificar_numeracao_nfe as vnn

        class FakeStatusResp:
            text = (
                '<retConsStatServ xmlns="http://www.portalfiscal.inf.br/nfe">'
                "<cStat>107</cStat><xMotivo>Servico em Operacao</xMotivo>"
                "</retConsStatServ>"
            )

        with patch.object(
            ComunicacaoSefaz, "__init__", lambda self, *a, **k: None
        ), patch.object(
            ComunicacaoSefaz, "status_servico", return_value=FakeStatusResp()
        ) as mock_status:
            payload = {
                "ambiente": "homologacao",
                "cert_path": "/tmp/fake.pfx",
                "cert_senha": "x",
                "uf": "SP",
                "modelo": 55,
                "serie": 1,
                "numero": 400,
            }
            resultado = vnn._check(payload)

        modelo_usado = mock_status.call_args.kwargs.get("modelo")
        self.assertIn(
            modelo_usado,
            ("nfe", "nfce"),
            "modelo numérico vazou para ComunicacaoSefaz.status_servico "
            f"(recebeu {modelo_usado!r}) — reintroduziria o bug 'Modelo não encontrado'",
        )
        self.assertNotIn("Modelo não encontrado", resultado.get("motivo", ""))
        self.assertTrue(resultado["sefaz_online"])


@unittest.skipUnless(PYNFE_DISPONIVEL, "pynfe não instalado neste ambiente")
class TestEmitirNfeModelo(unittest.TestCase):
    def test_emitir_nao_gera_erro_modelo_nao_encontrado(self):
        import emitir_nfe

        class FakeAutorizacaoResp:
            text = "<retEnviNFe/>"

        with patch.object(
            ComunicacaoSefaz, "__init__", lambda self, *a, **k: None
        ), patch.object(
            ComunicacaoSefaz,
            "autorizacao",
            return_value=(1, FakeAutorizacaoResp()),
        ) as mock_autorizacao, patch.object(
            emitir_nfe, "montar_xml", return_value="<xml/>"
        ), patch(
            "pynfe.processamento.assinatura.AssinaturaA1.__init__",
            lambda self, *a, **k: None,
        ), patch(
            "pynfe.processamento.assinatura.AssinaturaA1.assinar",
            lambda self, xml: xml,
        ):
            payload = {
                "ambiente": "homologacao",
                "cert_path": "/tmp/fake.pfx",
                "cert_senha": "x",
                "modelo": 55,
                "emitente": {"uf": "SP"},
            }
            resultado = emitir_nfe._emitir(payload)

        modelo_usado = mock_autorizacao.call_args.kwargs.get("modelo")
        self.assertIn(
            modelo_usado,
            ("nfe", "nfce"),
            "modelo numérico vazou para ComunicacaoSefaz.autorizacao "
            f"(recebeu {modelo_usado!r}) — reintroduziria o bug 'Modelo não encontrado'",
        )
        self.assertNotIn("Modelo não encontrado", resultado.get("motivo", ""))


if __name__ == "__main__":
    unittest.main()
