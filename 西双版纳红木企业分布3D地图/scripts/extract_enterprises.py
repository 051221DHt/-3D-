import argparse
import json
import math
import re
import urllib.parse
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DOCX = ROOT / "assets/source/西双版纳红木企业不完全整理，部分附带谷歌地图电话号码.docx"
DEFAULT_OUTPUT = ROOT / "data/enterprises.json"

REGION_ANCHORS = {
    "jinghong": {"label": "景洪市", "x": 0.08, "z": -0.08},
    "mengla": {"label": "勐腊县", "x": 0.58, "z": 0.12},
    "menghai": {"label": "勐海县", "x": -0.52, "z": -0.22},
    "other": {"label": "其他", "x": -0.18, "z": 0.42},
}

ADDRESS_ANCHORS = {
    "民航路": {"x": -0.04, "z": -0.13},
    "机场老路": {"x": -0.16, "z": 0.02},
    "机场": {"x": -0.18, "z": 0.0},
    "二一四国道": {"x": -0.12, "z": -0.04},
    "勐泐大道": {"x": 0.11, "z": -0.02},
    "景德路": {"x": 0.02, "z": -0.2},
    "环城南路": {"x": 0.09, "z": 0.02},
    "曼弄枫": {"x": 0.17, "z": 0.09},
    "会展": {"x": 0.15, "z": 0.03},
    "曼听": {"x": -0.02, "z": 0.04},
    "泰国街": {"x": 0.03, "z": -0.11},
    "勐棒路": {"x": -0.08, "z": -0.18},
    "中心路": {"x": 0.57, "z": 0.1},
    "勐腊南路": {"x": 0.61, "z": 0.16},
    "勐腊路": {"x": 0.56, "z": 0.14},
    "曼它拉路": {"x": 0.53, "z": 0.18},
    "北路": {"x": 0.62, "z": 0.09},
}

TYPE_GROUPS = [
    ("factory", ("工厂", "加工", "木业", "制造", "家具厂")),
    ("institution", ("协会", "公司", "企业办公", "机构")),
    ("craft", ("根雕", "工艺", "礼品", "沉香", "木雕")),
    ("store", ("家具", "家俬", "家居", "卖场", "商城", "市场", "商店", "门窗", "批发", "展厅", "馆", "店", "城")),
]


def cell_text(cell):
    return "".join((node.text or "") for node in cell.findall(".//w:t", NS)).strip()


def load_docx_table(path):
    with zipfile.ZipFile(path) as docx:
        xml = docx.read("word/document.xml")
    root = ET.fromstring(xml)
    rows = []
    for table_row in root.findall(".//w:tr", NS):
        cells = [cell_text(cell) for cell in table_row.findall("w:tc", NS)]
        if not cells or cells[0] == "序号":
            continue
        if len(cells) < 6:
            cells += [""] * (6 - len(cells))
        rows.append(
            {
                "id": cells[0],
                "name": cells[1],
                "pinyin": cells[2],
                "type": cells[3],
                "address": cells[4],
                "phone": cells[5],
            }
        )
    return rows


def classify_precision(address):
    address = (address or "").strip()
    if not address:
        return "unknown"
    if re.search(r"[0-9０-９]+号|[0-9０-９]+(?:栋|幢)(?:[0-9０-９]+)?|[0-9０-９]+(?:室|房|单元)|[A-Z0-9]{4}\+[A-Z0-9]{3}|楼|大门|对面|红绿灯|旁", address):
        return "exact"
    if any(token in address for token in ("路", "大道", "街", "一条街", "中心路", "国道")):
        return "road"
    if any(token in address for token in ("景洪市", "勐腊县", "勐海县")):
        return "area"
    return "unknown"


def infer_region(address):
    address = address or ""
    if "勐腊" in address or "曼它拉" in address or "中心路" in address or "北路" in address:
        return "mengla"
    if "勐海" in address:
        return "menghai"
    if "景洪" in address or any(
        token in address
        for token in (
            "民航路",
            "勐泐大道",
            "景德路",
            "环城南路",
            "曼听",
            "曼弄枫",
            "会展",
            "机场",
            "国道",
            "泰国街",
            "勐棒路",
        )
    ):
        return "jinghong"
    return "other"


def type_group(type_text):
    type_text = type_text or ""
    for group, tokens in TYPE_GROUPS:
        if any(token in type_text for token in tokens):
            return group
    return "other"


def anchor_for_address(address, region):
    address = address or ""
    for token, anchor in ADDRESS_ANCHORS.items():
        if token in address:
            return dict(anchor)
    region_anchor = REGION_ANCHORS.get(region, REGION_ANCHORS["other"])
    return {"x": region_anchor["x"], "z": region_anchor["z"]}


def spread_anchor(anchor, record_id, precision):
    radius = {"exact": 0.018, "road": 0.035, "area": 0.06, "unknown": 0.075}[precision]
    angle = math.radians((record_id * 137.508) % 360)
    return {
        "x": round(anchor["x"] + radius * math.cos(angle), 4),
        "z": round(anchor["z"] + radius * math.sin(angle), 4),
    }


def external_search_url(name, address):
    query = f"{name} 西双版纳 {address}".strip()
    return "https://www.google.com/maps/search/" + urllib.parse.quote(query, safe="")


def normalize_record(row):
    record_id = int(row["id"])
    name = row["name"].strip()
    address = row["address"].strip()
    precision = classify_precision(address)
    region = infer_region(address)
    anchor = anchor_for_address(address, region)
    schematic = spread_anchor(anchor, record_id, precision)
    return {
        "id": record_id,
        "name": name,
        "pinyin": row["pinyin"].strip(),
        "type": row["type"].strip(),
        "typeGroup": type_group(row["type"]),
        "address": address,
        "phone": row["phone"].strip(),
        "region": region,
        "regionLabel": REGION_ANCHORS.get(region, REGION_ANCHORS["other"])["label"],
        "locationPrecision": precision,
        "source": "Word",
        "sourceFile": DEFAULT_DOCX.name,
        "coordinates": None,
        "schematic": schematic,
        "externalSearchUrl": external_search_url(name, address),
        "notes": "" if precision != "unknown" else "地址信息不足，需人工核查",
    }


def build_dataset(docx_path):
    return [normalize_record(row) for row in load_docx_table(docx_path)]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=str(DEFAULT_DOCX))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()

    records = build_dataset(Path(args.input))
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(records)} records to {output}")


if __name__ == "__main__":
    main()
