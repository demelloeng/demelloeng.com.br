"""Hook PostToolUse (Bash): depois de gerar uma página de serviço, roda a conferência de perda de texto.

Lê o JSON do evento em stdin. Só age quando o comando contém 'gerar-paginas-servico-v02.py' e 'gerar'.
Devolve a linha de cada página à conversa; não altera arquivo.
"""
import json
import subprocess
import sys
from pathlib import Path

try:
    evento = json.load(sys.stdin)
except Exception:
    sys.exit(0)

comando = (evento.get("tool_input") or {}).get("command", "")
if "gerar-paginas-servico-v02.py" not in comando or " gerar" not in comando:
    sys.exit(0)

raiz = Path(__file__).resolve().parent.parent.parent
try:
    saida = subprocess.run([sys.executable, str(raiz / "scripts" / "conferir-paginas-servico-v02.py")],
                           cwd=raiz, capture_output=True, text=True, timeout=120, encoding="utf-8", errors="replace")
except Exception as erro:
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PostToolUse",
          "additionalContext": f"Conferência de texto não rodou: {erro}"}}))
    sys.exit(0)

linhas = [l for l in saida.stdout.splitlines() if "COPY NOVA" in l or "PERDA" in l]
resumo = "\n".join(linhas) or "Conferência de texto sem linhas de páginas com copy nova."
print(json.dumps({"hookSpecificOutput": {"hookEventName": "PostToolUse",
      "additionalContext": "Conferência automática depois de gerar:\n" + resumo
      + "\nO esperado em cada página com copy nova é 'trechos ausentes 0'."}}))
