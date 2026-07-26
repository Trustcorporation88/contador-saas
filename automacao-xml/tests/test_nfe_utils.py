"""Testes de regressão para common.nfe_utils.modelo_pynfe.

Cobre o bug reportado: 'SEFAZ inacessível: Modelo não encontrado! Defina
modelo="nfe" ou "nfce"'. A causa era passar o código numérico do modelo
fiscal (55/65) direto para a ComunicacaoSefaz do pynfe, que exige a string
"nfe"/"nfce" para montar a URL do webservice.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.nfe_utils import modelo_pynfe


class TestModeloPynfe(unittest.TestCase):
    def test_modelo_numerico_55_vira_nfe(self):
        self.assertEqual(modelo_pynfe(55), "nfe")

    def test_modelo_numerico_65_vira_nfce(self):
        self.assertEqual(modelo_pynfe(65), "nfce")

    def test_modelo_string_numerica(self):
        self.assertEqual(modelo_pynfe("55"), "nfe")
        self.assertEqual(modelo_pynfe("65"), "nfce")

    def test_modelo_ja_como_string_pynfe(self):
        self.assertEqual(modelo_pynfe("nfe"), "nfe")
        self.assertEqual(modelo_pynfe("nfce"), "nfce")
        self.assertEqual(modelo_pynfe("NFE"), "nfe")
        self.assertEqual(modelo_pynfe("NFCE"), "nfce")

    def test_modelo_ausente_ou_invalido_usa_nfe_como_fallback(self):
        self.assertEqual(modelo_pynfe(None), "nfe")
        self.assertEqual(modelo_pynfe(""), "nfe")
        self.assertEqual(modelo_pynfe("qualquer-coisa"), "nfe")

    def test_nunca_retorna_valor_numerico(self):
        # Garante que o valor nunca vaza como int/str numérica para a
        # ComunicacaoSefaz, que compara literalmente com "nfe"/"nfce".
        for entrada in (55, 65, "55", "65", "nfe", "nfce", None, 0):
            resultado = modelo_pynfe(entrada)
            self.assertIn(resultado, ("nfe", "nfce"))


if __name__ == "__main__":
    unittest.main()
