#!/usr/bin/env python3
"""Lê o extrato PBF do Brasil do OpenStreetMap: nós com amenity=charging_station.
Produz dataset aberto separado (ODbL) com campos de origem e horários não presumidos.
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

try:
    import osmium
except ImportError as exc:
    raise SystemExit("Instale pyosmium: pip install osmium") from exc

SOCKET_NAMES = {
    "type2": "Tipo 2 (AC)", "type2_combo": "CCS2 (DC)", "ccs": "CCS",
    "type1": "Tipo 1 (AC)", "type1_combo": "CCS1 (DC)", "chademo": "CHAdeMO",
    "gb_t": "GB/T", "gb_t_ac": "GB/T AC", "gb_t_dc": "GB/T DC",
    "tesla_supercharger": "Tesla Supercharger", "tesla_destination": "Tesla Destination",
    "schuko": "Schuko", "cee_blue": "CEE azul", "cee_red_16a": "CEE vermelha 16 A",
}
NO_VALUES = {"no", "none", "0", "false", "unknown", "unavailable"}
POWER_PATTERN = re.compile(r"(?<!\d)(\d+(?:[.,]\d+)?)\s*(kw|kilowatts?|w|watts?)\b", re.I)

def clipped(value, max_len):
    return re.sub(r"\s+", " ", str(value or "")).strip()[:max_len]

def output_kw(value):
    matches = []
    for number, unit in POWER_PATTERN.findall(value or ""):
        power = float(number.replace(",", "."))
        if unit.lower().startswith("w"): power /= 1000
        if 0 < power <= 1000: matches.append(round(power, 2))
    return max(matches) if matches else None

class Stations(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.stations = []
        self.counts = Counter()

    def node(self, node):
        tags = node.tags
        if tags.get("amenity") != "charging_station": return
        self.counts["all_charging_nodes"] += 1
        if not node.location.valid():
            self.counts["invalid_coordinates"] += 1
            return
        lat, lon = node.location.lat, node.location.lon
        if not (-34.0 <= lat <= 5.5 and -74.1 <= lon <= -34):
            self.counts["outside_br_bbox"] += 1
            return
        access_tag = (tags.get("access") or tags.get("vehicle") or "").strip().lower()
        if access_tag in {"private", "no", "military"}:
            self.counts["no_public_access"] += 1
            return
        if tags.get("disused") == "yes" or tags.get("abandoned") == "yes" or tags.get("construction") == "yes":
            self.counts["not_operational"] += 1
            return
        street = clipped(tags.get("addr:street"), 160)
        if len(street) < 3:
            self.counts["street_missing"] += 1
            street = "Endereço não informado"
        name = clipped(tags.get("name") or tags.get("operator") or tags.get("brand") or "Ponto de recarga de veículos elétricos", 120)
        number = clipped(tags.get("addr:housenumber") or "S/N", 20)
        if not number: number = "S/N"
        if not re.match(r"^.{1,20}$", number): number = "S/N"
        opening = clipped(tags.get("opening_hours"), 180) or None
        if opening == "24/7": opening = "24 horas (conforme OpenStreetMap)"
        elif opening: opening = opening + " (formato OpenStreetMap)"
        names = []
        powers = []
        supply_types = set()
        for k, v in tags:
            if k.startswith("socket:"):
                suffix = k[7:]
                if ":" not in suffix and suffix in SOCKET_NAMES and v.strip().lower() not in NO_VALUES:
                    names.append(SOCKET_NAMES[suffix])
                if suffix.endswith(":output"):
                    kw = output_kw(v)
                    if kw is not None: powers.append(kw)
            if k in {"charging_station:output", "max_output", "output"}:
                kw = output_kw(v)
                if kw is not None: powers.append(kw)
        for n in names:
            if "(DC)" in n or n in {"CCS", "CHAdeMO", "Tesla Supercharger", "GB/T DC"}: supply_types.add("DC")
            if "(AC)" in n or n in {"Tesla Destination", "Schuko", "CEE azul", "CEE vermelha 16 A"}: supply_types.add("AC")
        kind = "AC/DC" if len(supply_types) == 2 else next(iter(supply_types)) if supply_types else None
        if not names and not powers and street == "Endereço não informado":
            self.counts["insufficient_ev_evidence"] += 1
            return
        postal = re.sub(r"\D", "", tags.get("addr:postcode") or "")
        if len(postal) != 8: postal = None
        access = "customers" if access_tag in {"customers", "destination"} else "restricted" if access_tag in {"permit", "delivery"} else "public" if access_tag in {"yes", "permissive", "public"} else "unknown"
        self.stations.append({
            "external_id": f"osm:node:{node.id}", "name": name,
            "city": clipped(tags.get("addr:city"), 120) or None,
            "street": street, "number": number,
            "neighborhood": clipped(tags.get("addr:suburb") or tags.get("addr:neighbourhood"), 120) or "Não informado",
            "postal_code": postal, "latitude": round(lat,7), "longitude":round(lon,7),
            "power_kw": max(powers) if powers else None, "power_type": kind,
            "connectors": list(dict.fromkeys(names))[:16], "opening_hours_text": opening,
            "access_type": access, "source_url": f"https://www.openstreetmap.org/node/{node.id}",
            "source_checked_at": None, "source_license": "© OpenStreetMap contributors · ODbL 1.0",
        })
        self.counts["eligible"] += 1

def main():
    if len(sys.argv) != 3: raise SystemExit("Uso: prepare-osm-br-charging.py BR.osm.pbf OUTPUT_DIR")
    handler = Stations()
    handler.apply_file(sys.argv[1], locations=False)
    directory = Path(sys.argv[2]); directory.mkdir(parents=True, exist_ok=True)
    if not handler.stations: raise SystemExit("Nenhum eletroposto válido localizado.")
    for file in directory.glob("part-*.json"): file.unlink()
    stations = sorted(handler.stations, key=lambda row: row["external_id"])
    for start in range(0, len(stations), 80):
        (directory / f"part-{start//80+1:04d}.json").write_text(
            json.dumps(stations[start:start+80],ensure_ascii=False,separators=(",",":")) + "\n",encoding="utf-8")
    manifest = {**handler.counts,"parts":(len(stations)+79)//80,
       "source":"OpenStreetMap Brasil PBF extrato Geofabrik",
       "license":"ODbL 1.0","url":"https://download.geofabrik.de/south-america/brazil-latest.osm.pbf"}
    (directory / "manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(manifest,ensure_ascii=False))

if __name__ == "__main__": main()
