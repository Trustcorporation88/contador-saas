"""Trava de consumo indevido (cStat 656) e o 404 do ADN NFS-e.

De onde vem, caso real de 12/08/2026: a captura fiscal desta empresa ficou com o
cursor de NF-e preso em 0 e repetia o mesmo erro:

    SEFAZ DistDFe rejeitou (cStat 656): Rejeicao: Consumo Indevido
    (Deve ser utilizado o ultNSU nas solicitacoes subsequentes. Tente apos 1 hora)

O ciclo era este: consulta rejeitada NÃO avança o NSU, então o pedido seguinte
repete exatamente o que causou o bloqueio — e cada tentativa renova a punição.
Não havia nada no código impedindo clicar de novo dentro da hora.

E o 404 do NFS-e era tratado como erro fatal com o CORPO DESCARTADO. No ADN, 404
significa tanto "não há documento a partir deste NSU" (com JSON no corpo) quanto
"rota inexistente" (corpo vazio ou HTML) — e era justamente o corpo que
distinguia um caso do outro.

Rodar:  cd automacao-xml && python3 -m pytest tests/test_bloqueio_consumo_indevido.py -v
"""

import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone

import pytest

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if RAIZ not in sys.path:
    sys.path.insert(0, RAIZ)


@pytest.fixture()
def banco_local(monkeypatch):
    """Banco SQLite temporário. Nunca tocar no Postgres de produção num teste."""
    tmp = tempfile.mkdtemp()
    monkeypatch.delenv("DATABASE_URL", raising=False)
    # A variável é FISCAL_SYNC_DB (conferido em common/config.py). Escrevi
    # FISCAL_DB_PATH na primeira versão e o teste iria gravar no banco padrão.
    monkeypatch.setenv("FISCAL_SYNC_DB", os.path.join(tmp, "teste.sqlite3"))

    for modulo in [m for m in list(sys.modules) if m.startswith("common")]:
        del sys.modules[modulo]

    from common import db as db_mod
    return db_mod


EMPRESA = "empresa-de-teste"


class TestBloqueio:

    def test_sem_bloqueio_no_inicio(self, banco_local):
        assert banco_local.bloqueio_ativo(EMPRESA, "nfe") is None

    def test_GRAVA_E_LE_O_BLOQUEIO(self, banco_local):
        # O comportamento central: registrar até quando a SEFAZ nos deixou de
        # fora, para recusar localmente em vez de bater nela outra vez.
        ate = datetime.now(timezone.utc) + timedelta(hours=1, minutes=5)
        banco_local.save_cursor(
            EMPRESA, "nfe", "0", status="error", error="cStat 656", bloqueado_ate=ate
        )

        lido = banco_local.bloqueio_ativo(EMPRESA, "nfe")
        assert lido is not None
        # Tolerância de um minuto: ida e volta pelo banco perde precisão.
        assert abs((lido - ate).total_seconds()) < 60

    def test_bloqueio_no_passado_nao_conta(self, banco_local):
        # Passada a hora, tem de liberar sozinho — senão a captura fica travada
        # para sempre e alguém precisa mexer no banco à mão.
        passado = datetime.now(timezone.utc) - timedelta(minutes=1)
        banco_local.save_cursor(
            EMPRESA, "nfe", "0", status="error", error="antigo", bloqueado_ate=passado
        )
        assert banco_local.bloqueio_ativo(EMPRESA, "nfe") is None

    def test_GRAVACAO_SEGUINTE_NAO_APAGA_O_BLOQUEIO(self, banco_local):
        # O detalhe que faz a trava valer. save_cursor é chamado em todo caminho,
        # inclusive no de erro; se `bloqueado_ate=None` sobrescrevesse, a próxima
        # tentativa limparia o castigo e o ciclo voltaria — a trava existiria no
        # código e não na prática.
        ate = datetime.now(timezone.utc) + timedelta(hours=1)
        banco_local.save_cursor(EMPRESA, "nfe", "0", bloqueado_ate=ate)

        banco_local.save_cursor(EMPRESA, "nfe", "0", status="error", error="outra falha")

        assert banco_local.bloqueio_ativo(EMPRESA, "nfe") is not None

    def test_limpar_bloqueio_libera(self, banco_local):
        ate = datetime.now(timezone.utc) + timedelta(hours=1)
        banco_local.save_cursor(EMPRESA, "nfe", "0", bloqueado_ate=ate)
        banco_local.limpar_bloqueio(EMPRESA, "nfe")
        assert banco_local.bloqueio_ativo(EMPRESA, "nfe") is None

    def test_bloqueio_e_por_tipo_de_documento(self, banco_local):
        # NF-e e NFS-e são serviços diferentes, de órgãos diferentes: castigo em
        # um não é castigo no outro.
        ate = datetime.now(timezone.utc) + timedelta(hours=1)
        banco_local.save_cursor(EMPRESA, "nfe", "0", bloqueado_ate=ate)

        assert banco_local.bloqueio_ativo(EMPRESA, "nfe") is not None
        assert banco_local.bloqueio_ativo(EMPRESA, "nfse") is None


class TestNsuNfse:

    def test_nsu_inteiro_ignora_zeros_a_esquerda(self):
        from sync_nfse import _nsu_int
        assert _nsu_int("000000000000000") == 0
        assert _nsu_int("000000000000042") == 42
        assert _nsu_int("") == 0

    def test_as_duas_formas_do_nsu_sao_distintas(self):
        # É essa diferença que o 404 do ADN pode estar acusando: a rota talvez
        # espere 0 e não 000000000000000.
        from sync_nfse import _nsu_int, formatar_nsu
        assert formatar_nsu(0) == "000000000000000"
        assert str(_nsu_int(0)) == "0"
        assert formatar_nsu(0) != str(_nsu_int(0))


class SessaoFalsa:
    """Sessão HTTP de mentira: devolve respostas roteirizadas por URL."""

    def __init__(self, roteiro):
        self.roteiro = roteiro
        self.chamadas: list[str] = []

    def get(self, url, timeout=None):  # noqa: ARG002
        self.chamadas.append(url)
        for sufixo, resposta in self.roteiro:
            if url.endswith(sufixo):
                return resposta
        raise AssertionError(f"URL inesperada no teste: {url}")


class RespostaFalsa:
    def __init__(self, status_code, text="", json_data=None):
        self.status_code = status_code
        self.text = text
        self._json = json_data

    def json(self):
        if self._json is None:
            raise ValueError("corpo não é JSON")
        return self._json

    def raise_for_status(self):
        if self.status_code >= 400:
            import requests
            raise requests.HTTPError(f"{self.status_code} Client Error", response=self)


class TestQuatrocentosEQuatroDoAdn:
    """O 404 do ADN NFS-e: dois significados, e o corpo é quem distingue."""

    def _empresa(self):
        from common.config import EmpresaConfig
        return EmpresaConfig(
            company_id="empresa-de-teste", cnpj="60526634000104", uf="SP",
            pfx="/nao/existe.pfx", senha="x",
        )

    def test_404_COM_JSON_DE_NEGOCIO_NAO_E_ERRO(self, monkeypatch):
        # "Não há documento a partir deste NSU" é resposta normal, não falha.
        # Antes isto virava exceção e a tela mostrava erro num caso de sucesso.
        import sync_nfse
        corpo = {"StatusProcessamento": "NENHUM_DOCUMENTO_LOCALIZADO", "LoteDFe": []}
        sessao = SessaoFalsa([("/DFe/000000000000000",
                              RespostaFalsa(404, '{"StatusProcessamento":"x"}', corpo))])
        monkeypatch.setattr(sync_nfse, "_session_pfx", lambda *a, **k: sessao)

        resultado = sync_nfse.consultar_distribuicao_dfe(self._empresa(), "0")

        assert resultado["StatusProcessamento"] == "NENHUM_DOCUMENTO_LOCALIZADO"
        # Não tentou a segunda forma: a primeira já respondeu de verdade.
        assert len(sessao.chamadas) == 1

    def test_404_SEM_CORPO_VIRA_ERRO_QUE_DIZ_O_QUE_ACONTECEU(self, monkeypatch):
        # Rota inexistente ou certificado não aceito. O erro tem de carregar a
        # URL e o corpo, que é a evidência que faltava para diagnosticar.
        import sync_nfse
        sessao = SessaoFalsa([
            ("/DFe/000000000000000", RespostaFalsa(404, "")),
            ("/DFe/0", RespostaFalsa(404, "")),
        ])
        monkeypatch.setattr(sync_nfse, "_session_pfx", lambda *a, **k: sessao)

        with pytest.raises(RuntimeError) as erro:
            sync_nfse.consultar_distribuicao_dfe(self._empresa(), "0")

        texto = str(erro.value)
        assert "404" in texto
        assert "(vazio)" in texto
        assert "Ambiente Nacional" in texto
        # Tentou as DUAS formas antes de desistir.
        assert len(sessao.chamadas) == 2

    def test_QUANDO_A_FORMA_INTEIRA_FUNCIONA_O_AVISO_REGISTRA(self, monkeypatch):
        # O ponto da tentativa dupla: descobrir qual formato o ADN aceita, em vez
        # de eu escolher no escuro. Se a inteira responde, isso fica anotado.
        import sync_nfse
        sessao = SessaoFalsa([
            ("/DFe/000000000000000", RespostaFalsa(404, "")),
            ("/DFe/0", RespostaFalsa(200, '{"LoteDFe":[]}', {"LoteDFe": []})),
        ])
        monkeypatch.setattr(sync_nfse, "_session_pfx", lambda *a, **k: sessao)

        resultado = sync_nfse.consultar_distribuicao_dfe(self._empresa(), "0")

        assert "_aviso_formato_nsu" in resultado
        assert "inteira" in resultado["_aviso_formato_nsu"]
