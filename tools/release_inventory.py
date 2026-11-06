"""Inventario explicito de distribuicao, sem arquivos extras por extensao."""
import json
from pathlib import PurePosixPath

def release_files(root):
    names = json.loads((root / "release-files.json").read_text(encoding="utf-8"))
    if not isinstance(names, list) or any(not isinstance(n, str) for n in names) or len(names) != len(set(names)):
        raise ValueError("Inventario de distribuicao invalido.")
    files = []
    for name in names:
        p = PurePosixPath(name)
        if not name or "\\" in name or ":" in name or p.is_absolute() or any(x in ("", ".", "..") for x in name.split("/")):
            raise ValueError("Caminho invalido no inventario.")
        current = root
        for part in p.parts:
            current = current / part
            if current.is_symlink() or current.is_junction():
                raise ValueError("Links nao sao permitidos no pacote.")
        if not current.is_file():
            raise ValueError("Arquivo do inventario ausente: " + name)
        files.append(current)
    return sorted(files)
