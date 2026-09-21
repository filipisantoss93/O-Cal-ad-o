#!/usr/bin/env python3
"""Extrai apenas POIs colaborativos (CC BY 4.0) do export público OCM.
Saída em partes menores para revisão e importação idempotente no Supabase.
"""
import datetime as dt
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

def plain(value):
    return unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode().strip().lower()

def validated(value, limit):
    return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]

def power(value):
    try:
        number = float(value)
        return round(number, 2) if 0 < number <= 1000 else None
    except (TypeError, ValueError, OverflowError):
        return None

def main():
    if len(sys.argv) != 4:
        raise SystemExit("Uso: prepare-ocm-sp.py DIRETORIO_BR REFERENCE_JSON OUTPUT_DIR")
    root, reference_path, output_dir = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    reference = json.loads(reference_path.read_text(encoding="utf-8"))
    connectors = {str(x["ID"]): validated(x.get("Title"), 80) for x in reference["ConnectionTypes"]}
    current = {str(x["ID"]): plain(x.get("Title")) for x in reference["CurrentTypes"]}
    counts = Counter()
    stations = []
    seen = set()
    for path in sorted(root.glob("OCM-*.json")):
        counts["files"] += 1
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            counts["invalid_json"] += 1
            continue
        if record.get("DataProviderID") != 1:
            counts["non_open_provider"] += 1
            continue
        if record.get("SubmissionStatusTypeID") != 200 or record.get("StatusTypeID") not in {50, 75}:
            counts["not_approved_or_operational"] += 1
            continue
        address = record.get("AddressInfo") or {}
        if plain(address.get("StateOrProvince")) not in {"sao paulo", "sp"}:
            counts["other_state"] += 1
            continue
        try:
            lat, lon = float(address["Latitude"]), float(address["Longitude"])
            if not (-25.55 <= lat <= -19.60 and -53.35 <= lon <= -44.00):
                raise ValueError("outside SP")
        except (TypeError, ValueError, KeyError):
            counts["invalid_coords"] += 1
            continue
        town = validated(address.get("Town"), 120)
        title = validated(address.get("Title"), 120)
        raw_street = validated(address.get("AddressLine1"), 170)
        if not town or not title or len(raw_street) < 5:
            counts["no_valid_address"] += 1
            continue
        # Sem número explícito, manter S/N; nunca inferir ou geocodificar pela cidade.
        parts = re.match(r"^(.+?),?\s*,\s*(\d{1,6}[A-Za-z]?|s/?n)\s*$", raw_street, flags=re.I)
        if parts:
            street, number = validated(parts.group(1), 160), validated(parts.group(2), 20)
        else:
            street, number = validated(raw_street, 160), "S/N"
        if len(street) < 2:
            counts["invalid_street"] += 1
            continue
        ident = record.get("ID")
        if not isinstance(ident, int) or ident in seen:
            counts["duplicate_or_missing_id"] += 1
            continue
        seen.add(ident)
        cons = record.get("Connections") or []
        kw = [power(x.get("PowerKW")) for x in cons]
        kw = [x for x in kw if x is not None]
        names = [connectors.get(str(x.get("ConnectionTypeID")), "") for x in cons]
        names = [x for x in names if x]
        # CurrentTypeID: CC/DC > DC, AC/DC mixtures are represented explicitly.
        kinds = set()
        for x in cons:
            label = current.get(str(x.get("CurrentTypeID")), "")
            if "dc" in label or "direct" in label: kinds.add("DC")
            if "ac" in label or "alternating" in label: kinds.add("AC")
        power_type = "AC/DC" if len(kinds) == 2 else next(iter(kinds)) if kinds else None
        usage = record.get("UsageTypeID")
        access = "public" if usage in {1,4,5,7} else "customers" if usage == 6 else "restricted" if usage in {2,3} else "unknown"
        verified = str(record.get("DateLastVerified") or record.get("DateLastStatusUpdate") or "").strip()
        try:
            if verified:
                dt.datetime.fromisoformat(verified.replace("Z", "+00:00"))
        except ValueError:
            verified = ""
        station = {
            "external_id": "ocm:" + str(ident),
            "name": title, "city": town, "street": street, "number": number,
            "neighborhood": validated(address.get("AddressLine2"), 120) or "Não informado",
            "postal_code": re.sub(r"\D", "", str(address.get("Postcode") or "")),
            "latitude": round(lat, 7), "longitude": round(lon, 7),
            "power_kw": max(kw) if kw else None, "power_type": power_type,
            "connectors": names[:16], "opening_hours_text": None,
            "access_type": access,
            "source_url": f"https://openchargemap.org/site/poi/details/{ident}",
            "source_checked_at": verified or None,
            "source_license": "Open Charge Map contributors · CC BY 4.0",
        }
        if len(station["postal_code"]) != 8: station["postal_code"] = None
        stations.append(station)
        counts["eligible"] += 1
    if not stations:
        raise SystemExit("Nenhum eletroposto elegível: não publicar lote vazio.")
    output_dir.mkdir(parents=True, exist_ok=True)
    for old in output_dir.glob("part-*.json"):
        old.unlink()
    for idx in range(0, len(stations), 80):
        path = output_dir / f"part-{idx // 80 + 1:04d}.json"
        path.write_text(json.dumps(stations[idx:idx+80], ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    manifest = {**counts, "parts": (len(stations) + 79) // 80, "source": "Open Charge Map ocm-export data/BR", "provider_id": 1, "license": "CC BY 4.0", "snapshot_date": "2026-04-23", "states": ["SP"]}
    (output_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False))

if __name__ == "__main__":
    main()
