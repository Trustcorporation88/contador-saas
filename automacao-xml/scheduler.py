"""Orquestrador multi-empresa para captura automática de XML fiscal."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from common.config import EmpresaConfig, get_certs_dir
from common.db import ensure_schema
from sync_nfe import sync_empresa_nfe
from sync_nfse import sync_empresa_nfse

RESULT_PREFIX = "CAPTURE_RESULT:"


def carregar_empresas_json(path: Path) -> list[EmpresaConfig]:
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    empresas: list[EmpresaConfig] = []
    for item in data:
        empresas.append(
            EmpresaConfig(
                company_id=item.get("company_id", item["cnpj"]),
                cnpj=item["cnpj"],
                uf=item["uf"],
                pfx=item.get("pfx") or str(get_certs_dir() / f"{item['cnpj']}.pfx"),
                senha=item["senha"],
                serpro_motor=bool(item.get("serpro_motor", False)),
            )
        )
    return empresas


def main() -> int:
    parser = argparse.ArgumentParser(description="Captura automática NF-e e NFS-e")
    parser.add_argument("--config", help="Arquivo JSON com empresas", default=str(ROOT / "empresas.json"))
    parser.add_argument("--company-id", help="Sincronizar apenas uma empresa (company_id ou CNPJ)")
    parser.add_argument("--tipo", choices=["nfe", "nfse", "all"], default="all")
    args = parser.parse_args()

    ensure_schema()
    config_path = Path(args.config)
    if not config_path.exists():
        print(f"Arquivo de configuração não encontrado: {config_path}")
        print("Crie empresas.json ou configure certificados via API do O Contador.")
        return 1

    empresas = carregar_empresas_json(config_path)
    if args.company_id:
        empresas = [e for e in empresas if e.company_id == args.company_id or e.cnpj == args.company_id]

    if not empresas:
        print("Nenhuma empresa para sincronizar.")
        return 1

    summary = {
        "ok": True,
        "nfe_capturados": 0,
        "nfse_capturados": 0,
        "nfe_nsu": None,
        "nfse_nsu": None,
        "errors": [],
        "warnings": [],
    }

    for empresa in empresas:
        company_id = empresa.company_id
        print(f"Sincronizando {empresa.cnpj} ({company_id})...")

        if args.tipo in ("nfe", "all"):
            try:
                result = sync_empresa_nfe(empresa, company_id)
                print(f"  NF-e: {result.capturados} XML(s), NSU={result.ultimo_nsu}")
                summary["nfe_capturados"] += int(result.capturados or 0)
                summary["nfe_nsu"] = result.ultimo_nsu
                if result.alerta_certificado:
                    msg = str(result.alerta_certificado)
                    print(f"  AVISO: {msg}")
                    summary["warnings"].append(msg)
            except Exception as exc:
                print(f"  NF-e ERRO: {exc}")
                summary["ok"] = False
                summary["errors"].append(f"NF-e: {exc}")

        if args.tipo in ("nfse", "all"):
            try:
                result = sync_empresa_nfse(empresa, company_id)
                print(f"  NFS-e: {result.capturados} XML(s), NSU={result.ultimo_nsu}")
                summary["nfse_capturados"] += int(result.capturados or 0)
                summary["nfse_nsu"] = result.ultimo_nsu
                if result.aviso:
                    print(f"  INFO: {result.aviso}")
                    summary["warnings"].append(str(result.aviso))
                if result.alerta_certificado:
                    msg = str(result.alerta_certificado)
                    print(f"  AVISO: {msg}")
                    summary["warnings"].append(msg)
            except Exception as exc:
                print(f"  NFS-e ERRO: {exc}")
                summary["ok"] = False
                summary["errors"].append(f"NFS-e: {exc}")

    print(RESULT_PREFIX + json.dumps(summary, ensure_ascii=False))
    return 0 if summary["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
