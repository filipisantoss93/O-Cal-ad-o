#!/usr/bin/env python3
import argparse
import csv
import os
import shutil
import sys
import zipfile
from pathlib import PurePosixPath

REQUIRED_COLUMNS = {
    "CO_ENTIDADE",
    "NO_ENTIDADE",
    "CO_MUNICIPIO",
    "TP_DEPENDENCIA",
    "TP_SITUACAO_FUNCIONAMENTO",
    "DS_ENDERECO",
    "NU_ENDERECO",
    "NO_BAIRRO",
    "CO_CEP",
    "LATITUDE",
    "LONGITUDE",
}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("zip_path")
    parser.add_argument("csv_path")
    args = parser.parse_args()

    if not os.path.isfile(args.zip_path):
        raise SystemExit("ZIP do INEP não encontrado.")
    if os.path.getsize(args.zip_path) < 10_000_000:
        raise SystemExit("ZIP do INEP é menor que o mínimo esperado.")

    try:
        with zipfile.ZipFile(args.zip_path) as archive:
            candidates = [
                name for name in archive.namelist()
                if PurePosixPath(name).name.casefold() == "tabela_escola_2025.csv"
            ]
            if not candidates:
                names = [PurePosixPath(n).name for n in archive.namelist()]
                nearby = [n for n in names if "escola" in n.casefold()][:30]
                raise SystemExit(
                    "Tabela_Escola_2025.csv não encontrada no ZIP. "
                    f"Arquivos relacionados: {nearby}"
                )

            entry = sorted(candidates, key=len)[0]
            info = archive.getinfo(entry)
            if info.file_size < 1_000_000:
                raise SystemExit("CSV de escolas é menor que o mínimo esperado.")

            os.makedirs(os.path.dirname(args.csv_path) or ".", exist_ok=True)
            with archive.open(entry) as src, open(args.csv_path, "wb") as dst:
                shutil.copyfileobj(src, dst, length=1024 * 1024)

    except zipfile.BadZipFile as exc:
        raise SystemExit(f"ZIP oficial inválido: {exc}") from exc

    with open(args.csv_path, "r", encoding="latin-1", newline="") as handle:
        reader = csv.reader(handle, delimiter=";")
        try:
            header = set(next(reader))
        except StopIteration as exc:
            raise SystemExit("CSV do INEP está vazio.") from exc

    missing = sorted(REQUIRED_COLUMNS - header)
    if missing:
        raise SystemExit(f"CSV INEP inválido; colunas ausentes: {missing}")

    print(f"INEP_ENTRY={entry}")
    print(f"INEP_CSV_BYTES={os.path.getsize(args.csv_path)}")

if __name__ == "__main__":
    main()
