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
import sys

RESULT_PREFIX = "NFE_CHECK:"


def _digits(value) -> str:
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def _check(payload: dict) -> dict:
    from pynfe.processamento.comunicacao import ComunicacaoSefaz
    from pynfe.utils.flags import NAMESPACE_NFE
    from lxml import etree

    ambiente = str(payload.get("ambiente", "homologacao")).lower()
    homologacao = ambiente != "producao"
    cert_path = payload["cert_path"]
    cert_senha = payload["cert_senha"]
    uf = str(payload["uf"]).upper()
    modelo = int(payload.get("modelo", 55))
    serie = int(payload.get("serie", 1))
    numero = int(payload["numero"])
    chave = _digits(payload.get("chave"))

    con = ComunicacaoSefaz(uf, cert_path, cert_senha, homologacao)
    ns = {"ns": NAMESPACE_NFE}

    # 1) Status do serviço SEFAZ
    sefaz_online = False
    status_motivo = ""
    try:
        status = con.status_servico(modelo=modelo)
        # pynfe pode retornar tupla/objeto — normaliza
        texto = getattr(status, "text", None) or str(status)
        try:
            root = etree.fromstring(
                texto.encode("utf-8") if isinstance(texto, str) else texto
            )
            cs = root.xpath("//ns:cStat/text()", namespaces=ns)
            xm = root.xpath("//ns:xMotivo/text()", namespaces=ns)
            cstat_status = cs[0] if cs else ""
            status_motivo = xm[0] if xm else ""
            sefaz_online = cstat_status in ("107", "108", "109") or "em operacao" in status_motivo.lower() or "em operação" in status_motivo.lower()
            # 107 = Serviço em Operação
            if cstat_status == "107":
                sefaz_online = True
        except Exception:
            # Se status_servico retornou estrutura diferente, considera online se não explodiu
            sefaz_online = True
            status_motivo = "Status SEFAZ alcançado"
    except Exception as exc:
        return {
            "ok": False,
            "sefaz_online": False,
            "ja_emitida_sefaz": None,
            "cStat": "",
            "motivo": f"SEFAZ inacessível: {exc}",
            "fonte": "sefaz_status",
            "serie": serie,
            "numero": numero,
        }

    if not sefaz_online:
        return {
            "ok": False,
            "sefaz_online": False,
            "ja_emitida_sefaz": None,
            "cStat": "",
            "motivo": status_motivo or "SEFAZ fora de operação",
            "fonte": "sefaz_status",
            "serie": serie,
            "numero": numero,
        }

    # 2) Se temos chave, consulta protocolo na SEFAZ (prova definitiva)
    if len(chave) == 44:
        try:
            resp = con.consulta_nota(modelo=modelo, chave=chave)
            texto = getattr(resp, "text", None) or str(resp)
            root = etree.fromstring(
                texto.encode("utf-8") if isinstance(texto, str) else texto
            )
            cs = root.xpath("//ns:cStat/text()", namespaces=ns)
            xm = root.xpath("//ns:xMotivo/text()", namespaces=ns)
            cstat = cs[0] if cs else ""
            motivo = xm[0] if xm else ""
            # 100 = autorizada; 101 = cancelada; 110 = denegada; 217 = não encontrada
            ja = cstat in ("100", "150", "101", "110", "301", "302")
            disponivel = cstat in ("217",)  # NF-e inexistente
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
        "cStat": "107",
        "motivo": (
            f"SEFAZ online. Sem chave de acesso para consultar o número {numero}/{serie} "
            "previamente. A duplicidade é rejeitada na autorização (cStat 539)."
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
