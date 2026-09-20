#!/usr/bin/env python3
"""Importação piloto dos arquivos públicos oficiais CNPJ da RFB.

Lê apenas Estabelecimentos, Empresas e Municípios. Não processa Sócios, Simples,
telefones, emails, CPF, dados de responsáveis ou endereços de pessoa física.
Modo restrito a município, setor e volume por execução; não publica vitrines.
"""
import argparse
import csv
import json
import os
import re
import sys
import tempfile
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

BASE = "https://arquivos.receitafederal.gov.br/dados/cnpj/dados_abertos_cnpj"
CATEGORY_PREFIXES = (
    "4711", "4712", "4721", "4722", "4723", "4724", "4729",
    "4520", "4530", "4541", "4771", "4772", "4781", "4782", "4783",
    "4751", "4752", "4741", "4742", "4743", "4754", "4755", "4759", "9602",
)
CATEGORY_TWO_DIGITS = {"56", "86", "85", "55", "49"}

def norm(text):
    ascii_text = unicodedata.normalize("NFD", text)
    return re.sub(r"[^A-Z0-9 ]", " ", "".join(
        c for c in ascii_text if unicodedata.category(c) != "Mn"
    ).upper()).strip()

def eligible_cnae(code):
    value = re.sub(r"\D", "", code)
    return len(value) == 7 and (value[:4] in CATEGORY_PREFIXES or value[:2] in CATEGORY_TWO_DIGITS)

def private_nature(code):
    value = re.sub(r"\D", "", code)
    return len(value) == 4 and value.startswith("2") and value != "2135"

def read_member(archive):
    members = [i for i in archive.infolist() if not i.is_dir()]
    if len(members) != 1:
        raise ValueError("O ZIP oficial deve conter exatamente um arquivo de dados.")
    member = members[0]
    if member.file_size < 8:
        raise ValueError("CSV da RFB está vazio.")
    return member

def csv_rows(zipped_path, min_columns):
    with zipfile.ZipFile(zipped_path) as archive:
        member = read_member(archive)
        import io
        with archive.open(member) as raw:
            reader = csv.reader(io.TextIOWrapper(raw, encoding="latin-1", newline=""), delimiter=";")
            for row in reader:
                if len(row) < min_columns:
                    raise ValueError(f"Layout RFB inesperado: {len(row)} colunas, esperadas {min_columns}.")
                yield row

def download(base, name, directory):
    parsed = urllib.parse.urlparse(base)
    if parsed.scheme != "https" or parsed.hostname not in {
        "arquivos.receitafederal.gov.br", "dadosabertos.rfb.gov.br"
    } or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("Fonte não é um dos servidores oficiais HTTPS da RFB.")
    if not re.fullmatch(r"(Empresas[0-9]|Estabelecimentos[0-9]|Municipios)\.zip", name):
        raise ValueError("Nome de arquivo RFB inválido.")
    output = Path(directory) / name
    url = base.rstrip("/") + "/" + name
    if output.is_file():
        return output
    request = urllib.request.Request(url, headers={
        "User-Agent": "O-Calcadao-CNPJ-Importer/1.0 (+https://ocalcadao.com.br/contato)"
    })
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=150) as response, output.open("wb") as target:
                if urllib.parse.urlparse(response.url).hostname not in {
                    "arquivos.receitafederal.gov.br", "dadosabertos.rfb.gov.br"
                }:
                    raise ValueError("Redirecionamento para host não oficial.")
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    target.write(chunk)
            with zipfile.ZipFile(output) as archive:
                archive.getinfo(read_member(archive).filename)
            return output
        except (OSError, ValueError, zipfile.BadZipFile, urllib.error.URLError):
            output.unlink(missing_ok=True)
            if attempt == 3:
                raise
            time.sleep(min(25, 2 ** attempt))
    raise RuntimeError("Download oficial indisponível.")

def municipalities(zip_path):
    mapped = {}
    for row in csv_rows(zip_path, 2):
        code, name = row[0].strip(), row[1].strip()
        if re.fullmatch(r"\d{4}", code) and name:
            mapped[code] = name
    if len(mapped) < 100:
        raise ValueError("Tabela de municípios RFB incompleta.")
    return mapped

def selected_establishments(zip_path, cities, uf, city, limit):
    selected = []
    stats = {"read": 0, "eligible_before_nature": 0, "unmatched_city": 0}
    city_norm = norm(city)
    for row in csv_rows(zip_path, 30):
        stats["read"] += 1
        root, order, dv = (row[i].strip() for i in (0, 1, 2))
        if (row[5].strip() != "02" or row[19].strip().upper() != uf
                or not eligible_cnae(row[11])):
            continue
        city_name = cities.get(row[20].strip())
        if city_name is None:
            stats["unmatched_city"] += 1
            continue
        if norm(city_name) != city_norm:
            continue
        if not (re.fullmatch(r"\d{8}", root) and re.fullmatch(r"\d{4}", order)
                and re.fullmatch(r"\d{2}", dv)):
            continue
        fantasia, street, number, neighborhood = (
            row[4].strip(), " ".join(row[13:15]).strip(), row[15].strip(), row[17].strip()
        )
        if not all((fantasia, street, number, neighborhood)):
            continue
        record = {
            "cnpj": root + order + dv,
            "fantasia": fantasia[:120],
            "situacao": "02",
            "cnae": re.sub(r"\D", "", row[11]),
            "logradouro": street[:160],
            "numero": number[:20],
            "complemento": row[16].strip()[:120],
            "bairro": neighborhood[:120],
            "cep": re.sub(r"\D", "", row[18]),
            "uf": uf,
            "municipio": city_name,
        }
        selected.append(record)
        stats["eligible_before_nature"] += 1
        if len(selected) >= limit:
            break
    return selected, stats

def get_company_natures(roots, download_base, tmp_dir, explicit_directory=None):
    remaining = set(roots)
    found = {}
    for index in range(10):
        if not remaining:
            break
        if explicit_directory:
            path = Path(explicit_directory) / f"Empresas{index}.zip"
            if not path.is_file():
                raise FileNotFoundError(f"Falta {path}; a natureza jurídica requer todos os arquivos Empresas.")
        else:
            path = download(download_base, f"Empresas{index}.zip", tmp_dir)
        for row in csv_rows(path, 7):
            root = row[0].strip()
            if root in remaining:
                found[root] = row[2].strip()
                remaining.remove(root)
                if not remaining:
                    break
        if not explicit_directory:
            path.unlink(missing_ok=True)
    return found, len(remaining)

def send_batch(endpoint, oidc_token, snapshot, rows):
    body = json.dumps({"snapshot": snapshot, "rows": rows}, ensure_ascii=False).encode("utf-8")
    for attempt in range(4):
        request = urllib.request.Request(endpoint, method="POST", data=body, headers={
            "Authorization": "Bearer " + oidc_token,
            "Content-Type": "application/json",
        })
        try:
            with urllib.request.urlopen(request, timeout=110) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            payload = exc.read(1200).decode("utf-8", "replace")
            if 400 <= exc.code < 500 and exc.code != 429:
                raise RuntimeError(f"Falha HTTP {exc.code}: {payload}") from exc
            if attempt == 3:
                raise RuntimeError(f"Falha HTTP {exc.code}: {payload}") from exc
        time.sleep(2 ** attempt)
    raise RuntimeError("Falha no envio de lote.")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", required=True)
    parser.add_argument("--uf", default="SP")
    parser.add_argument("--city", default="Assis")
    parser.add_argument("--index", type=int, default=0)
    parser.add_argument("--max-candidates", type=int, default=60)
    parser.add_argument("--base-url")
    parser.add_argument("--estabelecimentos-zip")
    parser.add_argument("--municipios-zip")
    parser.add_argument("--empresas-dir")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not re.fullmatch(r"20\d{2}-(0[1-9]|1[0-2])", args.snapshot):
        parser.error("--snapshot deve usar AAAA-MM")
    if not re.fullmatch(r"[A-Z]{2}", args.uf) or not args.city.strip():
        parser.error("UF e município obrigatórios")
    if not 0 <= args.index <= 9 or not 1 <= args.max_candidates <= 200:
        parser.error("Índice deve ser 0..9 e max-candidates 1..200")
    base = args.base_url or f"{BASE}/{args.snapshot}"
    endpoint = os.environ.get("OCALCADAO_IMPORT_URL")
    token = os.environ.get("GITHUB_OIDC_TOKEN")
    if not args.dry_run and (not endpoint or not token):
        parser.error("Importação requer endpoint e token OIDC da Action autorizada.")
    with tempfile.TemporaryDirectory(prefix="rfb-cnpj-") as temp:
        cities_zip = Path(args.municipios_zip) if args.municipios_zip else download(base, "Municipios.zip", temp)
        estabs_zip = Path(args.estabelecimentos_zip) if args.estabelecimentos_zip else download(
            base, f"Estabelecimentos{args.index}.zip", temp
        )
        cities = municipalities(cities_zip)
        selected, stats = selected_establishments(
            estabs_zip, cities, args.uf, args.city, args.max_candidates
        )
        natures, missing = get_company_natures(
            (row["cnpj"][:8] for row in selected), base, temp, args.empresas_dir
        )
        rows = []
        for row in selected:
            nature = natures.get(row["cnpj"][:8])
            if not nature or not private_nature(nature):
                continue
            row["natureza_juridica"] = nature
            rows.append(row)
        if missing:
            raise RuntimeError(f"Sem natureza jurídica para {missing} CNPJ(s); não importar incompletos.")
        stats["private_candidates"] = len(rows)
        if args.dry_run:
            print(json.dumps({"mode": "dry-run", "stats": stats}, ensure_ascii=False))
            return
        totals = {"created": 0, "matched": 0, "duplicate_candidates": 0, "ignored": 0, "errors": 0}
        for start in range(0, len(rows), 60):
            outcome = send_batch(endpoint, token, args.snapshot, rows[start:start+60])
            for key in totals:
                totals[key] += int(outcome.get(key, 0))
            print(json.dumps({"batch": start // 60 + 1, "result": outcome}, ensure_ascii=False), flush=True)
        print("RFB_IMPORT_SUMMARY=" + json.dumps({"scan":stats,"result":totals},ensure_ascii=False))
        if totals["errors"]:
            raise RuntimeError("Importação teve erros; revisão obrigatória.")

if __name__ == "__main__":
    main()
