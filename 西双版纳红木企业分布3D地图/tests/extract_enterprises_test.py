import urllib.parse
import unittest
from pathlib import Path

from scripts.extract_enterprises import (
    build_dataset,
    classify_precision,
    external_search_url,
    infer_region,
    load_docx_table,
    normalize_record,
    type_group,
)

ROOT = Path(__file__).resolve().parents[1]
DOCX = ROOT / "assets/source/西双版纳红木企业不完全整理，部分附带谷歌地图电话号码.docx"


class ExtractEnterprisesTest(unittest.TestCase):
    def test_loads_all_word_rows(self):
        rows = load_docx_table(DOCX)
        self.assertEqual(78, len(rows))
        self.assertEqual("红木坊", rows[0]["name"])
        self.assertEqual("勐腊奇奇旺红木高品家私店", rows[-1]["name"])

    def test_precision_classification(self):
        self.assertEqual("exact", classify_precision("环城南路1-8号"))
        self.assertEqual("exact", classify_precision("曼听公园大门对面红豆楼5号"))
        self.assertEqual("exact", classify_precision("泰国街5栋6102"))
        self.assertEqual("road", classify_precision("二一四国道国际机场附近"))
        self.assertEqual("road", classify_precision("勐泐大道"))
        self.assertEqual("area", classify_precision("景洪市"))
        self.assertEqual("unknown", classify_precision(""))

    def test_region_inference(self):
        self.assertEqual("jinghong", infer_region("景洪市"))
        self.assertEqual("mengla", infer_region("勐腊县中心路"))
        self.assertEqual("menghai", infer_region("勐海县"))
        self.assertEqual("jinghong", infer_region("民航路"))
        self.assertEqual("jinghong", infer_region("机场至第一个红绿灯旁"))
        self.assertEqual("jinghong", infer_region("二一四国道国际机场附近"))
        self.assertEqual("jinghong", infer_region("机场老路红木一条街"))
        self.assertEqual("jinghong", infer_region("泰国街5栋6102"))
        self.assertEqual("jinghong", infer_region("勐棒路"))
        self.assertEqual("mengla", infer_region("北路209号"))
        self.assertEqual("mengla", infer_region("北路旁"))

    def test_landmark_records_are_classified_to_jinghong(self):
        records = {record["id"]: record for record in build_dataset(DOCX)}

        self.assertEqual("jinghong", records[22]["region"])
        self.assertEqual("road", records[22]["locationPrecision"])
        self.assertEqual("jinghong", records[66]["region"])
        self.assertEqual("exact", records[66]["locationPrecision"])
        self.assertEqual("jinghong", records[67]["region"])
        self.assertEqual("road", records[67]["locationPrecision"])

    def test_store_type_group_handles_retail_labels(self):
        for type_text in ("门窗店", "综合市场", "家俬城", "家居装潢器材店"):
            with self.subTest(type_text=type_text):
                self.assertEqual("store", type_group(type_text))

    def test_factory_type_group_handles_furniture_factory(self):
        self.assertEqual("factory", type_group("家具厂"))

    def test_external_search_url_is_encoded_and_decodable(self):
        url = external_search_url("红木家具批发部", "泰国街5栋6102#A/B")
        parsed = urllib.parse.urlparse(url)
        decoded_path = urllib.parse.unquote(parsed.path)

        self.assertEqual("", parsed.fragment)
        self.assertIn("红木家具批发部", decoded_path)
        self.assertIn("西双版纳", decoded_path)
        self.assertIn("泰国街5栋6102#A/B", decoded_path)
        self.assertNotIn(" ", url)

    def test_normalized_record_has_required_fields(self):
        row = {
            "id": "13",
            "name": "红木家具批发部",
            "pinyin": "Hongmu Furniture Wholesale Dept.",
            "type": "批发部",
            "address": "环城南路1-8号",
            "phone": "+86 691 221 7198",
        }
        record = normalize_record(row)
        self.assertEqual(13, record["id"])
        self.assertEqual("exact", record["locationPrecision"])
        self.assertEqual("jinghong", record["region"])
        decoded_path = urllib.parse.unquote(urllib.parse.urlparse(record["externalSearchUrl"]).path)
        self.assertIn("红木家具批发部", decoded_path)
        self.assertIn("西双版纳", decoded_path)
        self.assertIn("环城南路1-8号", decoded_path)
        self.assertNotIn(" ", record["externalSearchUrl"])
        self.assertEqual("Word", record["source"])

    def test_dataset_invariants(self):
        records = build_dataset(DOCX)
        ids = [record["id"] for record in records]
        self.assertEqual(78, len(records))
        self.assertEqual(len(ids), len(set(ids)))
        self.assertTrue(all(record["coordinates"] is None for record in records))
        self.assertTrue(all(" " not in record["externalSearchUrl"] for record in records))


if __name__ == "__main__":
    unittest.main()
