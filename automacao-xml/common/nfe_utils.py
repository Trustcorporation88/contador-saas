"""Utilidades compartilhadas para chamadas à SEFAZ via pynfe."""
from __future__ import annotations


def modelo_pynfe(modelo) -> str:
    """Converte o código numérico do modelo fiscal (55/65) — ou já a string
    "nfe"/"nfce" — no valor que a `ComunicacaoSefaz` do pynfe espera para
    montar a URL do serviço (`status_servico`, `consulta_nota`, `autorizacao`,
    `consulta_recibo`, etc).

    Sem essa conversão, passar o inteiro 55/65 direto faz o pynfe explodir com
    `Exception('Modelo não encontrado! Defina modelo="nfe" ou "nfce"')`, pois
    ele compara `modelo == "nfe"` / `modelo == "nfce"` literalmente.
    """
    valor = str(modelo).strip().lower()
    if valor in ("nfe", "nfce"):
        return valor
    if valor in ("65", "65.0"):
        return "nfce"
    # 55 é o padrão (NF-e) e também o fallback para qualquer valor não reconhecido.
    return "nfe"
