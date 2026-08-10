"""O XML capturado da SEFAZ precisa ficar no banco, não só no filesystem.

A tabela `fiscal_xml_captures` guardava `xml_path` (um caminho) e `xml_hash`, e
NÃO o documento. Em produção `getXmlRoot()` desvia para `os.tmpdir()` por causa de
um EACCES no volume do Railway, então o arquivo apontado deixava de existir no
deploy seguinte e o registro ficava apontando para o vazio.

O XML autorizado É o documento fiscal — o DANFE é só a representação impressa — e
a guarda é de 5 anos. O `xml_hash` não recupera nada: serve para provar alteração,
não para reconstruir.

Estes testes rodam contra um PostgreSQL real (BACKUP_TEST_DATABASE_URL) porque o
que importa é o que fica GRAVADO. Um teste com banco em memória ou mock passaria
sem provar persistência.
"""
from __future__ import annotations

import importlib
import os
import sys
import unittest
import uuid
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

TEST_URL = os.environ.get("BACKUP_TEST_DATABASE_URL")


def _carregar_db_module():
    """Importa common.db com a DATABASE_URL do teste já no ambiente.

    Import normal (e não spec_from_file_location) porque common/db.py usa import
    relativo — carregá-lo solto quebra a resolução do pacote.
    """
    os.environ["DATABASE_URL"] = TEST_URL or ""
    import common.db as modulo
    importlib.reload(modulo)
    return modulo


def _hash_xml(conteudo: bytes) -> str:
    """hash_xml vive em common.storage, não em common.db."""
    from common.storage import hash_xml
    return hash_xml(conteudo)


XML_EXEMPLO = (
    b'<?xml version="1.0" encoding="UTF-8"?>'
    b'<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">'
    b"<NFe><infNFe><ide><nNF>1234</nNF></ide>"
    b"<det><prod><xProd>CAF\xc3\x89 ESPECIAL</xProd></prod></det>"
    b"</infNFe></NFe></nfeProc>"
)


@unittest.skipUnless(TEST_URL, "BACKUP_TEST_DATABASE_URL não definida")
class TestPersistenciaDoXmlCapturado(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.db = _carregar_db_module()
        # Estado ANTES da correção: tabela sem a coluna de conteúdo.
        with cls.db.db_connection() as conn:
            cur = conn.cursor()
            cur.execute("DROP TABLE IF EXISTS fiscal_xml_captures")
        cls.db.ensure_schema()
        cls.company_id = f"empresa-teste-{uuid.uuid4().hex[:8]}"

    @classmethod
    def tearDownClass(cls):
        with cls.db.db_connection() as conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM fiscal_xml_captures WHERE company_id LIKE 'empresa-teste-%%'")

    def _meta(self, chave: str):
        return self.db.MetadadosXml(
            tipo_doc="nfe",
            chave=chave,
            direcao="entrada",
            emitente_cnpj="12345678000199",
            destinatario_cnpj="98765432000121",
            valor_total=1500.00,
            data_emissao=date(2026, 8, 1),
            modelo="55",
            numero="1234",
            serie="1",
        )

    def _buscar(self, chave: str):
        with self.db.db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT xml_path, xml_hash, xml_content FROM fiscal_xml_captures "
                "WHERE company_id=%s AND chave=%s",
                (self.company_id, chave),
            )
            return cur.fetchone()

    def test_ensure_schema_cria_a_coluna_de_conteudo(self):
        with self.db.db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='fiscal_xml_captures' AND column_name='xml_content'"
            )
            self.assertIsNotNone(cur.fetchone(), "coluna xml_content ausente")

    def test_grava_o_conteudo_do_xml_no_banco(self):
        chave = "1" * 44
        registrado = self.db.registrar_captura(
            self.company_id, self._meta(chave), "/tmp/qualquer/caminho.xml",
            _hash_xml(XML_EXEMPLO), XML_EXEMPLO,
        )
        self.assertTrue(registrado)

        linha = self._buscar(chave)
        self.assertIsNotNone(linha)
        _, _, conteudo = linha
        # O documento inteiro, não só o caminho.
        self.assertIsNotNone(conteudo, "xml_content ficou nulo — documento perdido")
        self.assertIn("<nNF>1234</nNF>", conteudo)
        # Acentuação preservada: o XML vem em UTF-8 da SEFAZ.
        self.assertIn("CAFÉ ESPECIAL", conteudo)

    def test_o_documento_sobrevive_ao_arquivo_desaparecer(self):
        chave = "2" * 44
        caminho = "/tmp/diretorio-que-nao-existe-mais/nota.xml"
        self.db.registrar_captura(
            self.company_id, self._meta(chave), caminho,
            _hash_xml(XML_EXEMPLO), XML_EXEMPLO,
        )

        xml_path, _, conteudo = self._buscar(chave)
        # É exatamente o cenário do deploy: o caminho aponta para o nada...
        self.assertFalse(Path(xml_path).exists())
        # ...e o documento continua recuperável.
        self.assertIn("<nNF>1234</nNF>", conteudo)

    def test_hash_gravado_confere_com_o_conteudo(self):
        chave = "3" * 44
        self.db.registrar_captura(
            self.company_id, self._meta(chave), "/tmp/x.xml",
            _hash_xml(XML_EXEMPLO), XML_EXEMPLO,
        )
        _, xml_hash, conteudo = self._buscar(chave)
        # Permite auditar depois se o conteúdo gravado é o que foi capturado.
        self.assertEqual(xml_hash, _hash_xml(conteudo.encode("utf-8")))

    def test_sem_conteudo_informado_grava_nulo_em_vez_de_falhar(self):
        chave = "4" * 44
        registrado = self.db.registrar_captura(
            self.company_id, self._meta(chave), "/tmp/y.xml",
            _hash_xml(XML_EXEMPLO),
        )
        self.assertTrue(registrado)
        _, _, conteudo = self._buscar(chave)
        # NULL distingue "captura antiga sem conteúdo" de "documento vazio".
        self.assertIsNone(conteudo)

    def test_xml_com_byte_invalido_nao_derruba_o_registro(self):
        chave = "5" * 44
        # Perder o documento por causa de um byte inesperado seria pior que
        # gravar com um caractere trocado.
        sujo = b"<nfeProc><x>\xff\xfe invalido</x></nfeProc>"
        registrado = self.db.registrar_captura(
            self.company_id, self._meta(chave), "/tmp/z.xml",
            _hash_xml(sujo), sujo,
        )
        self.assertTrue(registrado)
        _, _, conteudo = self._buscar(chave)
        self.assertIsNotNone(conteudo)
        self.assertIn("nfeProc", conteudo)

    def test_recaptura_da_mesma_chave_nao_duplica(self):
        chave = "6" * 44
        meta = self._meta(chave)
        primeiro = self.db.registrar_captura(
            self.company_id, meta, "/tmp/a.xml", _hash_xml(XML_EXEMPLO), XML_EXEMPLO,
        )
        segundo = self.db.registrar_captura(
            self.company_id, meta, "/tmp/b.xml", _hash_xml(XML_EXEMPLO), XML_EXEMPLO,
        )
        self.assertTrue(primeiro)
        self.assertFalse(segundo, "UNIQUE(company_id, chave) deveria impedir duplicata")


if __name__ == "__main__":
    unittest.main()
