"""Verifica se número/série de NF-e já foi usado (local + SEFAZ quando possível).

Uso:
    python verificar_numeracao_nfe.py <payload.json>

Payload:
  ambiente, cert_path, cert_senha, uf, modelo, serie, numero, chave? (opcional)

Saída (stdout) prefixada com NFE_CHECK:
  { ok, sefaz_online, ja_emitida_sefaz, cStat, motivo, fonte }
"""
from __future__ import annotations

import json
import re
import sys

RESULT_PREFIX = "NFE_CHECK:"


def _digits(value) -> str:
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def _texto_resposta(resp) -> str:
    texto = getattr(resp, "text", None)
    if texto is None:
        texto = str(resp)
    if isinstance(texto, bytes):
        return texto.decode("utf-8", errors="replace")
    return str(texto)


def _extract_cstat_motivo(xml_text: str) -> tuple[str, str]:
    """Extrai cStat/xMotivo de SOAP ou XML puro (namespaces variáveis)."""
    from lxml import etree

    raw = (xml_text or "").strip()
    if not raw:
        return "", ""

    try:
        root = etree.fromstring(raw.encode("utf-8") if isinstance(raw, str) else raw)
    except Exception:
        # Fallback regex se o XML vier truncado/envelope estranho
        cs = re.search(r"<cStat>\s*(\d+)\s*</cStat>", raw)
        xm = re.search(r"<xMotivo>\s*([^<]+)\s*</xMotivo>", raw)
        return (cs.group(1) if cs else ""), (xm.group(1).strip() if xm else "")

    cs_nodes = root.xpath("//*[local-name()='cStat']/text()")
    xm_nodes = root.xpath("//*[local-name()='xMotivo']/text()")
    cstat = str(cs_nodes[0]).strip() if cs_nodes else ""
    motivo = str(xm_nodes[0]).strip() if xm_nodes else ""
    return cstat, motivo


def _status_online(cstat: str, motivo: str) -> bool:
    # 107 = Serviço em Operação. 108/109 = paralisado (OFFLINE).
    if cstat == "107":
        return True
    motivo_l = (motivo or "").lower()
    return "em operacao" in motivo_l or "em operação" in motivo_l


def _check(payload: dict) -> dict:
    from pynfe.processamento.comunicacao import ComunicacaoSefaz

    from common.nfe_utils import modelo_pynfe

    ambiente = str(payload.get("ambiente", "homologacao")).lower()
    homologacao = ambiente != "producao"
    cert_path = payload["cert_path"]
    cert_senha = payload["cert_senha"]
    uf = str(payload["uf"]).upper().strip()
    modelo_raw = payload.get("modelo", 55)
    modelo = modelo_pynfe(modelo_raw)  # "nfe" ou "nfce" — exigido pelo pynfe
    serie = int(payload.get("serie", 1))
    numero = int(payload["numero"])
    chave = _digits(payload.get("chave"))

    if not uf or len(uf) != 2:
        return {
            "ok": False,
            "sefaz_online": False,
            "ja_emitida_sefaz": None,
            "cStat": "",
            "motivo": "UF da empresa não configurada (cadastro da empresa). Informe a UF para consultar a SEFAZ.",
            "fonte": "config",
            "serie": serie,
            "numero": numero,
        }

    con = ComunicacaoSefaz(uf, cert_path, cert_senha, homologacao)

    # 1) Status do serviço SEFAZ
    try:
        status = con.status_servico(modelo=modelo)
        texto = _texto_resposta(status)
        cstat_status, status_motivo = _extract_cstat_motivo(texto)
        sefaz_online = _status_online(cstat_status, status_motivo)

        # Resposta HTTP ok mas sem cStat legível: não inventar "fora de operação".
        if not cstat_status and not status_motivo:
            snippet = re.sub(r"\s+", " ", texto)[:180]
            return {
                "ok": True,
                "sefaz_online": True,
                "ja_emitida_sefaz": None,
                "disponivel": None,
                "cStat": "",
                "motivo": (
                    "SEFAZ respondeu, mas o status não veio no formato esperado. "
                    "Pode seguir com a emissão; a confirmação definitiva ocorre na autorização. "
                    f"Detalhe: {snippet or 'resposta vazia'}"
                ),
                "fonte": "sefaz_status_parcial",
                "serie": serie,
                "numero": numero,
            }
    except Exception as exc:
        return {
            "ok": False,
            "sefaz_online": False,
            "ja_emitida_sefaz": None,
            "cStat": "",
            "motivo": f"SEFAZ inacessível ({uf}/{ambiente}): {exc}",
            "fonte": "sefaz_status",
            "serie": serie,
            "numero": numero,
        }

    if not sefaz_online:
        return {
            "ok": False,
            "sefaz_online": False,
            "ja_emitida_sefaz": None,
            "cStat": cstat_status,
            "motivo": (
                f"SEFAZ {uf} indisponível (cStat {cstat_status or 's/c'}): "
                f"{status_motivo or 'serviço paralisado'}"
            ),
            "fonte": "sefaz_status",
            "serie": serie,
            "numero": numero,
        }

    # 2) Se temos chave, consulta protocolo na SEFAZ (prova definitiva)
    if len(chave) == 44:
        try:
            resp = con.consulta_nota(modelo=modelo, chave=chave)
            texto = _texto_resposta(resp)
            cstat, motivo = _extract_cstat_motivo(texto)
            # 100 = autorizada; 101 = cancelada; 110 = denegada; 217 = não encontrada
            ja = cstat in ("100", "150", "101", "110", "301", "302")
            disponivel = cstat in ("217",)
            return {
                "ok": True,
                "sefaz_online": True,
                "ja_emitida_sefaz": ja,
                "disponivel": disponivel or (not ja and cstat == "217"),
                "cStat": cstat,
                "motivo": motivo,
                "fonte": "sefaz_consulta_chave",
                "serie": serie,
                "numero": numero,
                "chave": chave,
            }
        except Exception as exc:
            return {
                "ok": False,
                "sefaz_online": True,
                "ja_emitida_sefaz": None,
                "cStat": "",
                "motivo": f"Falha na consulta por chave: {exc}",
                "fonte": "sefaz_consulta_chave",
                "serie": serie,
                "numero": numero,
            }

    # Sem chave: SEFAZ online, mas ocupação do número só confirma na autorização (cStat 539)
    return {
        "ok": True,
        "sefaz_online": True,
        "ja_emitida_sefaz": None,
        "disponivel": None,
        "cStat": cstat_status or "107",
        "motivo": (
            f"SEFAZ {uf} online ({status_motivo or 'Serviço em Operação'}). "
            f"Sem chave de acesso para consultar o número {numero}/{serie} previamente. "
            "A duplicidade é rejeitada na autorização (cStat 539)."
        ),
        "fonte": "sefaz_status",
        "serie": serie,
        "numero": numero,
    }


def main() -> int:
    if len(sys.argv) < 2:
        print(RESULT_PREFIX + json.dumps({"ok": False, "motivo": "payload não informado"}))
        return 2
    try:
        with open(sys.argv[1], "r", encoding="utf-8") as fh:
            payload = json.load(fh)
    except Exception as exc:
        print(RESULT_PREFIX + json.dumps({"ok": False, "motivo": f"payload inválido: {exc}"}))
        return 2

    try:
        result = _check(payload)
        print(RESULT_PREFIX + json.dumps(result, ensure_ascii=False))
        return 0 if result.get("ok") else 1
    except Exception as exc:
        print(
            RESULT_PREFIX
            + json.dumps({"ok": False, "motivo": str(exc), "sefaz_online": False})
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
