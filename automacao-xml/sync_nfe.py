"""Sincronização NF-e (produto/comércio) via Distribuição DFe — SEFAZ."""
from __future__ import annotations

import base64
import gzip
import xml.etree.ElementTree as ET
from dataclasses import dataclass

from common.certificates import alerta_expiracao
from common.config import EmpresaConfig, homologacao
from common.db import get_cursor, registrar_captura, save_cursor
from common.storage import hash_xml, salvar_xml
from common.xml_parser import parse_nfe


NS = {"ns": "http://www.portalfiscal.inf.br/nfe"}


@dataclass
class SyncResult:
    capturados: int
    ultimo_nsu: str
    alerta_certificado: str | None = None


def _decode_doc_zip(texto: str) -> bytes:
    raw = base64.b64decode(texto.strip())
    try:
        return gzip.decompress(raw)
    except OSError:
        return raw


def _nsu_int(valor: str | int | None) -> int:
    digits = "".join(c for c in str(valor or "0") if c.isdigit())
    return int(digits) if digits else 0


def sync_empresa_nfe(empresa: EmpresaConfig, company_id: str | None = None) -> SyncResult:
    company_id = company_id or empresa.company_id or empresa.cnpj
    alerta = alerta_expiracao(empresa.pfx, empresa.senha)

    try:
        from pynfe.processamento.comunicacao import ComunicacaoSefaz
    except ImportError as exc:
        raise RuntimeError("Instale pynfe: pip install -r requirements.txt") from exc

    con = ComunicacaoSefaz(
        empresa.uf.lower(),
        empresa.pfx,
        empresa.senha,
        homologacao=homologacao(),
    )

    nsu = get_cursor(company_id, "nfe")
    capturados = 0

    try:
        while True:
            resposta = con.consulta_distribuicao(
                cnpj=empresa.cnpj,
                chave="",
                nsu=int(nsu),
                consulta_nsu_especifico=False,
            )
            root = ET.fromstring(resposta.text)
            c_stat = (root.findtext(".//ns:cStat", namespaces=NS) or "").strip()
            x_motivo = (root.findtext(".//ns:xMotivo", namespaces=NS) or "").strip()
            # 137 = nenhum documento; 138 = documento(s) localizado(s).
            # Qualquer outro cStat (215, 656, rejeição de certificado/CNPJ, etc.)
            # não pode ser tratado como "lista vazia OK" — isso escondia a falha.
            if c_stat and c_stat not in ("137", "138"):
                msg = f"SEFAZ DistDFe rejeitou (cStat {c_stat}): {x_motivo or 'sem motivo'}"
                save_cursor(company_id, "nfe", nsu, status="error", error=msg)
                raise RuntimeError(msg)

            docs = root.findall(".//ns:docZip", NS)

            if not docs:
                # Sem cStat legível E sem documentos: a resposta não é uma lista
                # vazia legítima (137), é uma resposta que não conseguimos
                # interpretar — SOAP inesperado, namespace diferente, erro de
                # infraestrutura. Tratar como sucesso aqui esconde a falha, que é
                # justamente o que o resto desta função corrige.
                if not c_stat:
                    msg = (
                        "Resposta da SEFAZ DistDFe sem cStat e sem documentos — "
                        "não foi possível confirmar a consulta. "
                        f"Trecho: {resposta.text[:200].strip()}"
                    )
                    save_cursor(company_id, "nfe", nsu, status="error", error=msg)
                    raise RuntimeError(msg)
                # cStat 137/138 sem docs: fim normal (sem XMLs novos).
                break

            for doc in docs:
                if not doc.text:
                    continue
                xml_bytes = _decode_doc_zip(doc.text)
                meta = parse_nfe(xml_bytes, empresa.cnpj)

                # Nome de arquivo estavel: chave da NF-e ou o NSU do docZip.
                chave_arquivo = meta.chave or doc.attrib.get("chNFe") or doc.attrib.get("NSU") or "doc"
                path = salvar_xml(empresa.cnpj, chave_arquivo, xml_bytes)

                # So registra documentos identificaveis (NF-e completa ou resumo);
                # eventos sao apenas arquivados no disco para nao bloquear, via
                # UNIQUE(chave), o registro da nota real com a mesma chave.
                if (
                    meta.tipo_doc != "nfe_evento"
                    and meta.chave
                    and registrar_captura(
                        company_id, meta, str(path), hash_xml(xml_bytes), xml_bytes,
                    )
                ):
                    capturados += 1

            ultimo_nsu = root.findtext(".//ns:ultNSU", namespaces=NS) or nsu
            max_nsu = root.findtext(".//ns:maxNSU", namespaces=NS)
            save_cursor(company_id, "nfe", ultimo_nsu)
            nsu = ultimo_nsu

            if len(docs) < 50:
                break
            if max_nsu and _nsu_int(ultimo_nsu) >= _nsu_int(max_nsu):
                break
    except Exception as exc:
        save_cursor(company_id, "nfe", nsu, status="error", error=str(exc))
        raise

    save_cursor(company_id, "nfe", nsu, status="ok")
    return SyncResult(capturados=capturados, ultimo_nsu=nsu, alerta_certificado=alerta)
