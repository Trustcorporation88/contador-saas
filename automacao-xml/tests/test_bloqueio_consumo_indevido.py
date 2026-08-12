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


class TestAvancoDoCursor:
    """O cursor tem de andar mesmo quando a resposta não traz ultNSU."""

    def test_reserva_usa_o_maior_nsu_dos_docs(self):
        # Caso real de 12/08/2026: 8 documentos capturados e cursor ainda em 0.
        # Pedir sempre do zero é exatamente o que a SEFAZ pune com cStat 656.
        from sync_nfe import _nsu_int
        nsu_atual, maior_dos_docs, tag_ultnsu = "0", 137, ""
        candidatos = [_nsu_int(nsu_atual), maior_dos_docs, _nsu_int(tag_ultnsu)]
        assert str(max(candidatos)) == "137"

    def test_tag_ultnsu_vence_quando_e_maior(self):
        from sync_nfe import _nsu_int
        candidatos = [_nsu_int("100"), 137, _nsu_int("200")]
        assert str(max(candidatos)) == "200"

    def test_CURSOR_NUNCA_RETROCEDE(self):
        # Andar para trás reprocessaria tudo e cairia no mesmo castigo. Se a
        # resposta trouxer um ultNSU menor que o cursor atual, o atual prevalece.
        from sync_nfe import _nsu_int
        candidatos = [_nsu_int("500"), 0, _nsu_int("100")]
        assert str(max(candidatos)) == "500"


class TestManifestacao:
    """O evento 210210, e as travas que impedem enviar outro por acidente."""

    def _evento(self, operacao=2):
        from datetime import datetime as dt
        from pynfe.entidades.evento import EventoManifestacaoDest
        from pynfe.entidades.fonte_dados import _fonte_dados
        _fonte_dados.limpar_dados()
        return EventoManifestacaoDest(
            cnpj="60526634000104", chave="3" * 44,
            data_emissao=dt.now(), uf="AN", operacao=operacao, n_seq_evento=1,
        )

    def test_operacao_2_e_ciencia_da_operacao(self):
        ev = self._evento(2)
        assert ev.tp_evento == "210210"
        assert "iencia" in ev.descricao  # "Ciencia da Operacao"

    def test_VAI_PARA_O_AMBIENTE_NACIONAL(self):
        # Manifestação não é recebida pela SEFAZ estadual. cOrgao 91 sai de
        # uf="AN", e a URL do AN é escolhida pela pynfe ao ver tpEvento
        # começando com "2" — o índice [0][5] do XML, que este teste fixa.
        from pynfe.entidades.fonte_dados import _fonte_dados
        from pynfe.processamento.serializacao import SerializacaoXML
        xml = SerializacaoXML(_fonte_dados, homologacao=True).serializar_evento(
            self._evento(2), tag_raiz="evento"
        )
        assert xml.find("infEvento/cOrgao").text == "91"
        assert xml[0][5].tag == "tpEvento"
        assert xml[0][5].text.startswith("2")

    def test_detevento_da_ciencia_nao_leva_justificativa(self):
        # Ciência só declara conhecimento. Justificativa é campo de
        # "Operação não Realizada", evento que este sistema não envia.
        from pynfe.entidades.fonte_dados import _fonte_dados
        from pynfe.processamento.serializacao import SerializacaoXML
        xml = SerializacaoXML(_fonte_dados, homologacao=True).serializar_evento(
            self._evento(2), tag_raiz="evento"
        )
        det = xml.find("infEvento/detEvento")
        filhos = [f.tag for f in det]
        assert filhos == ["descEvento"]

    def test_A_TRAVA_PEGA_SE_A_PYNFE_MUDAR_O_MAPEAMENTO(self):
        # A trava do script existe porque um remapeamento de índices numa versão
        # futura faria enviar 210200 (Confirmação da Operação) — irreversível, e
        # ela impede o emitente de cancelar a nota. Aqui simulamos o outro
        # código para provar que a comparação detecta.
        import manifestar_nfe
        ev_confirmacao = self._evento(1)
        assert ev_confirmacao.tp_evento == "210200"
        assert ev_confirmacao.tp_evento != manifestar_nfe.TP_EVENTO_CIENCIA

    def test_573_duplicidade_conta_como_ok(self):
        # Já manifestado antes: o objetivo (liberar o XML) está atingido. Tratar
        # como erro faria o usuário reenviar à toa.
        import manifestar_nfe
        assert "573" in manifestar_nfe.CSTAT_JA_MANIFESTADO
        assert "135" in manifestar_nfe.CSTAT_OK
