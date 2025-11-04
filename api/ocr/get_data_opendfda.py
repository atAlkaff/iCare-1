import requests

FIELDS = {
    "Active ingredients":          "active_ingredient",
    "Purposes":                   "purpose",
    "Uses":                       "indications_and_usage",
    "Warnings":                   "warnings",
    "Dosage and administration":  "dosage_and_administration",
    "Other information":          "inactive_ingredient",  
}

def _join(val):
    if not val:
        return ""
    if isinstance(val, list):
        return "\n".join(v for v in val if v and str(v).strip())
    return str(val).strip()


def _strip_leading(title: str, text: str) -> str:
    if not text:
        return text
    t = text.lstrip()
    low = t.lower()
    tlow = title.lower()
    if low.startswith(tlow):
        t = t[len(title):].lstrip(" :.-").lstrip()
    return t


def get_data_from_openfda(drug_name: str) -> dict:
    if not drug_name:
        return {}
    q = requests.utils.quote(drug_name)
    url = f'https://api.fda.gov/drug/label.json?search=openfda.brand_name:"{q}"&limit=1'
    r = requests.get(url, timeout=15)
    if not r.ok:
        return {}
    data = r.json()
    res = (data.get("results") or [])
    if not res:
        return {}
    item = res[0]

    out = {}
    for title, key in FIELDS.items():
        text = _join(item.get(key))
        if text:
            out[title] = _strip_leading(title, text)
    return out
