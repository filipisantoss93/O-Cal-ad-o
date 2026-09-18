#!/usr/bin/env python3
import argparse
import csv
import json
import os
import sys
import time
import urllib.error
import urllib.request

FIELDS = [
    "CO_ENTIDADE","NO_ENTIDADE","CO_MUNICIPIO","TP_DEPENDENCIA",
    "TP_SITUACAO_FUNCIONAMENTO","TP_LOCALIZACAO","DS_ENDERECO",
    "NU_ENDERECO","DS_COMPLEMENTO","NO_BAIRRO","CO_CEP","LATITUDE","LONGITUDE",
]

def send_batch(endpoint, token, rows, attempts=5):
    payload = json.dumps({"rows": rows}, ensure_ascii=False).encode("utf-8")
    for attempt in range(attempts):
        req = urllib.request.Request(
            endpoint,
            data=payload,
            method="POST",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "User-Agent": "O-Calcadao-INEP-Importer/1.0",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            if exc.code < 500 and exc.code != 429:
                raise RuntimeError(f"HTTP {exc.code}: {body}") from exc
            if attempt == attempts - 1:
                raise RuntimeError(f"HTTP {exc.code}: {body}") from exc
        except Exception:
            if attempt == attempts - 1:
                raise
        time.sleep(min(30, 2 ** attempt))
    raise RuntimeError("Falha ao enviar lote.")

def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("csv_path")
    parser.add_argument("--endpoint", default=os.environ.get("OCALCADAO_IMPORT_URL"))
    parser.add_argument("--token", default=os.environ.get("GITHUB_OIDC_TOKEN"))
    parser.add_argument("--batch-size", type=int, default=300)
    parser.add_argument("--max-rows", type=int, default=int(os.environ.get("INEP_MAX_ROWS", "0") or 0))
    return parser.parse_args()

def main():
    args = parse_args()
    if not args.endpoint or not args.token:
        raise SystemExit("OCALCADAO_IMPORT_URL e GITHUB_OIDC_TOKEN são obrigatórios.")
    if not 1 <= args.batch_size <= 500:
        raise SystemExit("batch-size deve ficar entre 1 e 500.")

    totals = {"read":0,"eligible":0,"sent":0,"created":0,"matched":0,"ignored":0,"errors":0,"geocoded":0}
    batch = []

    with open(args.csv_path, "r", encoding="latin-1", newline="") as handle:
        reader = csv.DictReader(handle, delimiter=";")
        missing = [field for field in FIELDS if field not in (reader.fieldnames or [])]
        if missing:
            raise SystemExit(f"Colunas INEP ausentes: {', '.join(missing)}")

        for row in reader:
            totals["read"] += 1
            if row.get("TP_SITUACAO_FUNCIONAMENTO","").strip() != "1":
                continue
            if row.get("TP_DEPENDENCIA","").strip() not in {"1","2","3"}:
                continue

            school = {field: (row.get(field) or "").strip() for field in FIELDS}
            batch.append(school)
            totals["eligible"] += 1

            if args.max_rows and totals["eligible"] >= args.max_rows:
                pass_limit = True
            else:
                pass_limit = False

            if len(batch) >= args.batch_size or pass_limit:
                result = send_batch(args.endpoint, args.token, batch)
                totals["sent"] += len(batch)
                for key in ("created","matched","ignored","errors","geocoded"):
                    totals[key] += int(result.get(key, 0) or 0)
                print(json.dumps({"batch":len(batch),"totals":totals,"result":result}, ensure_ascii=False), flush=True)
                batch = []

            if pass_limit:
                break

    if batch:
        result = send_batch(args.endpoint, args.token, batch)
        totals["sent"] += len(batch)
        for key in ("created","matched","ignored","errors","geocoded"):
            totals[key] += int(result.get(key, 0) or 0)
        print(json.dumps({"batch":len(batch),"totals":totals,"result":result}, ensure_ascii=False), flush=True)

    print("IMPORT_SUMMARY=" + json.dumps(totals, ensure_ascii=False), flush=True)

    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as summary:
            summary.write("## Importação INEP 2025\n\n")
            summary.write("| Métrica | Total |\n|---|---:|\n")
            for key, label in [
                ("read","Linhas lidas"),("eligible","Escolas públicas ativas"),
                ("created","Criadas"),("matched","Correspondências"),
                ("ignored","Ignoradas"),("errors","Erros"),("geocoded","Com coordenadas validadas")
            ]:
                summary.write(f"| {label} | {totals[key]} |\n")

    if totals["errors"] > max(25, totals["eligible"] // 100):
        raise SystemExit("Taxa de erros acima do limite de segurança.")

if __name__ == "__main__":
    main()
