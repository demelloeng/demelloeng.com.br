"""Contratos da governança de capacidades no site (roda no pr-gate sem o canônico).

Executor: scripts/capacidades.py (gerado pelo canônico). Manifesto: capacidades.site.json.
Os cenários com git rodam num repositório temporário que recebe uma cópia do manifesto e do executor.
`python -B -m unittest discover -s scripts -p test_capacidades.py`
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ / "scripts"))
import capacidades as rt  # noqa: E402

MANIFESTO = json.loads((RAIZ / rt.MANIFESTO).read_text(encoding="utf-8"))
ENV = {**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t", "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@t"}
FAKE_MWG = "import sys\na=sys.argv[1:]\nprint('# guia ' + a[1]) if a and a[0] == 'retrieve' else None\n"


def git(raiz, *a):
    return subprocess.run(["git", "-C", str(raiz), "-c", "core.hooksPath=", *a], capture_output=True, text=True, check=True, env=ENV).stdout.strip()


class Manifesto(unittest.TestCase):
    def test_duas_skills_obrigatorias_no_frontend(self):
        b = {c["id"] for c in MANIFESTO["capacidades"] if c["classe"] == "B"}
        self.assertEqual(b, {"modern-web-guidance", "frontend-design"})

    def test_sem_dado_privado(self):
        texto = (RAIZ / rt.MANIFESTO).read_text(encoding="utf-8") + (RAIZ / "scripts" / "capacidades.py").read_text(encoding="utf-8")
        for proibido in ("C:/Users", "C:\\Users", "mms_e", "07_R5"):
            self.assertNotIn(proibido, texto)

    def test_copia_do_frontend_design_rastreavel(self):
        fd = next(c for c in MANIFESTO["capacidades"] if c["id"] == "frontend-design")
        skill = RAIZ / fd["codex"]["skill_repo"]
        self.assertEqual(rt.sha256(skill), fd["origem_oficial"]["skill_sha256"])
        origem = json.loads((skill.parent / "ORIGEM.json").read_text(encoding="utf-8"))
        self.assertEqual(origem["commit"], fd["origem_oficial"]["commit_aprovado"])
        self.assertTrue((skill.parent / "LICENSE.txt").exists())

    def test_perfil_tem_os_tres_niveis(self):
        perfil = (RAIZ / MANIFESTO["site"]["perfil_frontend_design"]).read_text(encoding="utf-8")
        for n in ("## N1", "## N2", "## N3", "## O que nenhum nível autoriza"):
            self.assertIn(n, perfil)

    def test_classificacao_de_arquivos_reais(self):
        casos = {"servicos/projeto-estrutural/index.html": "frontend", "assets/js/maquetes/motor.mjs": "frontend",
                 "assets/css/maquete-v03.css": "frontend", "scripts/gerar-paginas-servico-v02.py": "frontend",
                 "scripts/layout_rico.py": "frontend", "orcamento-src/src/App.jsx": "frontend",
                 "docs/CODEBASE_MAP.md": "isento", "scripts/test_empresa.py": "isento", ".github/workflows/pages.yml": "isento",
                 "orcamento-src/tests/flow.test.mjs": "isento", "tests/visual/a11y.spec.mjs": "isento",
                 "orcamento/index.html": "bloqueado", "orcamento-src/pnpm-lock.yaml": "bloqueado",
                 "scripts/ifc_para_glb_hidro.py": "outro", "assets/models/estrutura-aco.glb": "outro"}
        for arq, esperado in casos.items():
            self.assertEqual(rt.classificar(arq, MANIFESTO), esperado, arq)

    def test_lista_de_testes_sem_deriva(self):
        lista, faltando = rt.testes_do_pages(RAIZ)
        self.assertGreaterEqual(len(lista), 45)
        self.assertEqual(faltando, [], "teste .test.mjs que o pages.yml não roda")


class Fluxo(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="capsite_"))
        self.env_antes = dict(os.environ)
        fake = self.tmp / "mwg.py"; fake.write_text(FAKE_MWG, encoding="utf-8")
        os.environ["CAPACIDADES_MWG_CMD"] = json.dumps([sys.executable, str(fake)])
        os.environ["CAPACIDADES_FD_SKILL"] = str(RAIZ / ".agents/skills/frontend-design/SKILL.md")
        self.r = self.tmp / "repo"; self.r.mkdir()
        git(self.r, "init", "-q", "-b", "main")
        shutil.copy2(RAIZ / rt.MANIFESTO, self.r / rt.MANIFESTO)
        (self.r / "docs").mkdir(); (self.r / "docs/CODEBASE_MAP.md").write_text("---\ncommit: 0\n---\n", encoding="utf-8")
        (self.r / "servicos").mkdir(); (self.r / "servicos/a.html").write_text("<h1>a</h1>\n", encoding="utf-8")
        (self.r / "scripts").mkdir(); (self.r / "scripts/util.py").write_text("x = 1\n", encoding="utf-8")
        git(self.r, "add", "-A"); git(self.r, "commit", "-qm", "base")
        self.base = git(self.r, "rev-parse", "HEAD")

    def tearDown(self):
        os.environ.clear(); os.environ.update(self.env_antes)
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_commit_frontend_sem_evidencia_recusado_e_com_evidencia_aceito_com_trailer(self):
        (self.r / "servicos/a.html").write_text("<h1>b</h1>\n", encoding="utf-8"); git(self.r, "add", "-A")
        self.assertEqual(rt.pre_commit(self.r, MANIFESTO), 1)
        self.assertEqual(rt.usar_mwg(self.r, MANIFESTO, retrieve="dialog"), 0)
        self.assertEqual(rt.pre_commit(self.r, MANIFESTO), 1, "só o MWG não basta")
        self.assertEqual(rt.usar_frontend_design(self.r, MANIFESTO, "N1"), 0)
        self.assertEqual(rt.pre_commit(self.r, MANIFESTO), 0)
        msg = self.tmp / "MSG"; msg.write_text("ajuste\n", encoding="utf-8")
        rt.commit_msg(self.r, MANIFESTO, msg)
        git(self.r, "commit", "-q", "-F", str(msg))
        self.assertEqual(rt.ci(self.r, MANIFESTO, self.base, "HEAD"), 0)

    def test_backend_passa_sem_skill(self):
        (self.r / "scripts/util.py").write_text("x = 2\n", encoding="utf-8"); git(self.r, "add", "-A")
        self.assertEqual(rt.pre_commit(self.r, MANIFESTO), 0)

    def test_pr_sem_trailer_reprova(self):
        (self.r / "servicos/a.html").write_text("<h1>c</h1>\n", encoding="utf-8")
        git(self.r, "commit", "-qam", "sem trailer")
        self.assertEqual(rt.ci(self.r, MANIFESTO, self.base, "HEAD"), 1)

    def test_mudanca_estrutural_exige_mapa(self):
        (self.r / "scripts/util.py").write_text("import json\nx = 1\n", encoding="utf-8")
        git(self.r, "commit", "-qam", "import novo")
        self.assertEqual(rt.ci(self.r, MANIFESTO, self.base, "HEAD"), 1)
        (self.r / "docs/CODEBASE_MAP.md").write_text("---\ncommit: 1\n---\natualizado\n", encoding="utf-8")
        git(self.r, "commit", "-qam", "mapa")
        self.assertEqual(rt.ci(self.r, MANIFESTO, self.base, "HEAD"), 0)


if __name__ == "__main__":
    unittest.main()
