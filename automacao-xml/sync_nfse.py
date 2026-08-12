"""Sincronização NFS-e via ADN (Portal Nacional) — distribuição DFe por NSU."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import requests
from requests_pkcs12 import Pkcs12Adapter

from common.certificates import alerta_expiracao
from common.config import EmpresaConfig, homologacao, nfse_adn_base
from common.db import get_cursor, registrar_captura, save_cursor
from common.decode import decode_gzip_base64
from common.storage import hash_xml, salvar_xml
from common.xml_parser import parse_nfse

NSU_WIDTH = 15
MAX_LOTE = 50


@dataclass
class SyncResult:
    capturados: int
    ultimo_nsu: str
    alerta_certificado: str | None = None
    aviso: str | None = None


def _nsu_int(valor: str | int) -> int:
    """NSU como inteiro. '000000000000000' e '0' são o mesmo número."""
    digits = "".join(c for c in str(valor) if c.isdigit())
    return int(digits) if digits else 0


def formatar_nsu(valor: str | int) -> str:
    digits = "".join(c for c in str(valor) if c.isdigit())
    return digits.zfill(NSU_WIDTH)[-NSU_WIDTH:]


def _session_pfx(pfx: str, senha: str) -> requests.Session:
    session = requests.Session()
    session.mount(
        "https://",
        Pkcs12Adapter(pkcs12_filename=pfx, pkcs12_password=senha),
    )
    return session


def consultar_distribuicao_dfe(empresa: EmpresaConfig, ultimo_nsu: str) -> dict[str, Any]:
    """
    GET /contribuintes/DFe/{UltimoNSU}
    Manual ADN NFS-e v1.2 — até 50 documentos por chamada.
    """
    base = nfse_adn_base()
    session = _session_pfx(empresa.pfx, empresa.senha)

    # Duas formas do NSU no path, tentadas nesta ordem.
    #
    # O código só usava a forma preenchida com zeros à esquerda (15 dígitos) e
    # tratava 404 como erro fatal. Em 12/08/2026 o resultado em produção foi:
    #
    #   404 Client Error: Not Found for url:
    #   https://adn.nfse.gov.br/contribuintes/DFe/000000000000000
    #
    # A documentação do ADN descreve o NSU como número no path, e implementações
    # de referência passam inteiro sem preenchimento. Não achei confirmação de
    # que a rota de contribuintes aceite a forma com zeros — então em vez de
    # escolher no escuro, tenta a preenchida (comportamento atual, para não
    # quebrar quem já funciona) e, se der 404, tenta a inteira. Qual delas
    # respondeu vai para o aviso: na próxima execução já sabemos qual é a certa.
    formas = [formatar_nsu(ultimo_nsu or "0"), str(_nsu_int(ultimo_nsu or "0"))]
    formas = list(dict.fromkeys(formas))  # sem repetir quando são iguais

    ultimo_404: dict[str, Any] | None = None

    for indice, nsu_param in enumerate(formas):
        url = f"{base}/DFe/{nsu_param}"
        for tentativa in range(3):
            try:
                response = session.get(url, timeout=180)
            except requests.RequestException as exc:
                if tentativa < 2:
                    continue
                raise

            if response.status_code in (502, 503, 504) and tentativa < 2:
                continue

            # 404 NÃO é fatal aqui, e é o ponto central desta correção.
            #
            # No ADN, 404 tanto significa "não há documento a partir deste NSU"
            # (resposta de negócio, com JSON no corpo) quanto "rota inexistente"
            # (corpo vazio ou HTML). O código antigo levantava exceção nos dois
            # casos e DESCARTAVA o corpo — que é exatamente o que distingue um do
            # outro. Ficamos sem saber qual dos dois aconteceu.
            if response.status_code == 404:
                corpo = (response.text or "").strip()
                dados = None
                if corpo:
                    try:
                        dados = response.json()
                    except ValueError:
                        dados = None

                if isinstance(dados, dict) and "StatusProcessamento" in dados:
                    # Resposta de negócio: nada novo a distribuir.
                    return dados

                ultimo_404 = {
                    "url": url,
                    "corpo": corpo[:300] or "(vazio)",
                    "forma_nsu": nsu_param,
                }
                # Tenta a próxima forma do NSU, se houver.
                break

            response.raise_for_status()

            if not response.text.strip():
                return {"StatusProcessamento": "NENHUM_DOCUMENTO_LOCALIZADO", "LoteDFe": []}

            dados = response.json()
            if indice > 0:
                # A forma preenchida falhou e esta funcionou: registra, porque
                # resolve a dúvida de qual é o formato correto.
                dados = dict(dados)
                dados["_aviso_formato_nsu"] = (
                    f"NSU aceito na forma inteira ({nsu_param}); "
                    f"a forma com zeros ({formas[0]}) devolveu 404."
                )
            return dados

    if ultimo_404:
        raise RuntimeError(
            "ADN NFS-e respondeu 404 para todas as formas de NSU testadas "
            f"({', '.join(formas)}). Última URL: {ultimo_404['url']} — "
            f"corpo: {ultimo_404['corpo']}. "
            "Corpo vazio ou HTML indica rota/credencial, não ausência de documentos: "
            "confirme se o município compartilha NFS-e com o Ambiente Nacional."
        )

    return {"StatusProcessamento": "NENHUM_DOCUMENTO_LOCALIZADO", "LoteDFe": []}


def _extrair_nsu_resposta(payload: dict[str, Any], lote: list[dict[str, Any]], nsu_atual: str) -> str:
    for key in ("UltNSU", "ultNSU", "UltimoNSU"):
        valor = payload.get(key)
        if valor is not None:
            return formatar_nsu(valor)

    if lote:
        return formatar_nsu(max(int(item.get("NSU", 0)) for item in lote))

    return formatar_nsu(nsu_atual)


def _status_sem_documentos(status: str | None) -> bool:
    if not status:
        return False
    normalizado = status.upper()
    return any(
        trecho in normalizado
        for trecho in (
            "NENHUM",
            "NAO_EXIST",
            "NÃO_EXIST",
            "SEM_DOCUMENTO",
            "NAO_HA",
        )
    )


def sync_empresa_nfse(empresa: EmpresaConfig, company_id: str | None = None) -> SyncResult:
    company_id = company_id or empresa.company_id or empresa.cnpj
    alerta = alerta_expiracao(empresa.pfx, empresa.senha)
    nsu = formatar_nsu(get_cursor(company_id, "nfse") or "0")

    capturados = 0
    aviso = None

    if empresa.serpro_motor:
        aviso = (
            "Empresa optante Simples Nacional: avalie o Motor de Calculo Serpro "
            "(custo adicional) para apuracao automatica alem da captura de XML."
        )

    while True:
        try:
            payload = consultar_distribuicao_dfe(empresa, nsu)
        except requests.HTTPError as exc:
            save_cursor(company_id, "nfse", nsu, status="error", error=str(exc))
            raise

        status = payload.get("StatusProcessamento") or payload.get("statusProcessamento")
        lote = payload.get("LoteDFe") or payload.get("loteDFe") or []

        if _status_sem_documentos(status) or not lote:
            break

        for item in lote:
            tipo = (item.get("TipoDocumento") or item.get("tipoDocumento") or "").upper()
            arquivo = item.get("ArquivoXml") or item.get("arquivoXml")
            chave = item.get("ChaveAcesso") or item.get("chaveAcesso")
            nsu_item = item.get("NSU") or item.get("nsu")

            if not arquivo:
                continue

            # Prioriza XML completo de NFS-e; eventos podem ser armazenados depois.
            if tipo and tipo not in ("NFSE", "NFS-E", "NFS"):
                continue

            try:
                xml_bytes = decode_gzip_base64(arquivo)
            except Exception:
                continue

            chave_arquivo = chave or (str(nsu_item) if nsu_item is not None else hash_xml(xml_bytes)[:50])
            path = salvar_xml(empresa.cnpj, str(chave_arquivo), xml_bytes)
            meta = parse_nfse(xml_bytes, empresa.cnpj)
            # Garante chave nao-vazia para evitar colisao no UNIQUE(company_id, chave).
            if not meta.chave:
                meta.chave = str(chave or chave_arquivo)
            if registrar_captura(company_id, meta, str(path), hash_xml(xml_bytes), xml_bytes):
                capturados += 1

        novo_nsu = _extrair_nsu_resposta(payload, lote, nsu)
        max_nsu = payload.get("MaxNSU") or payload.get("maxNSU")
        save_cursor(company_id, "nfse", novo_nsu)

        if len(lote) < MAX_LOTE:
            break
        if max_nsu is not None and formatar_nsu(novo_nsu) >= formatar_nsu(max_nsu):
            break
        if novo_nsu == nsu:
            break

        nsu = novo_nsu

    save_cursor(company_id, "nfse", nsu, status="ok")
    return SyncResult(
        capturados=capturados,
        ultimo_nsu=nsu,
        alerta_certificado=alerta,
        aviso=aviso,
    )
