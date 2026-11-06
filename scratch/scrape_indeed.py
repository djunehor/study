import json
import re
import time
from urllib.parse import quote_plus
from curl_cffi import requests

headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
}

queries = [
    {"q": "Customer Service", "l": "Göttingen, Niedersachsen", "max_pages": 4},
    {"q": "English", "l": "Göttingen, Niedersachsen", "max_pages": 3},
    {"q": "Customer Service", "l": "Deutschland", "remote": True, "max_pages": 4},
    {"q": "English Remote", "l": "Deutschland", "remote": True, "max_pages": 4},
]

collected = []
seen_jobkeys = set()

for item in queries:
    q = item["q"]
    l = item["l"]
    max_pages = item.get("max_pages", 3)
    is_remote = item.get("remote", False)

    print(f"Scraping Indeed: query='{q}', location='{l}', remote={is_remote}...")

    for page_idx in range(max_pages):
        start = page_idx * 10
        if is_remote:
            url = f"https://de.indeed.com/jobs?q={quote_plus(q)}&l={quote_plus(l)}&sc=0kf%3Aattr%28DSQF7%29%3B&start={start}"
        else:
            url = f"https://de.indeed.com/jobs?q={quote_plus(q)}&l={quote_plus(l)}&start={start}"

        try:
            time.sleep(1.0)
            res = requests.get(url, impersonate="chrome", headers=headers, timeout=15)
            if res.status_code != 200:
                print(f"  Page {page_idx + 1} status {res.status_code}, skipping.")
                continue

            matches = re.findall(r'window\.mosaic\.providerData\[\"mosaic-provider-jobcards\"\]\s*=\s*({.*?});', res.text, re.DOTALL)
            if not matches:
                print(f"  No mosaic data found on page {page_idx + 1}")
                continue

            data = json.loads(matches[0])
            results = data.get("metaData", {}).get("mosaicProviderJobCardsModel", {}).get("results", [])
            print(f"  Page {page_idx + 1} (start={start}) returned {len(results)} jobs.")

            for r in results:
                jk = r.get("jobkey")
                if not jk or jk in seen_jobkeys:
                    continue
                seen_jobkeys.add(jk)

                title = r.get("title") or r.get("displayTitle") or ""
                company = r.get("company") or "Company"
                loc = r.get("formattedLocation") or "Germany"
                if is_remote:
                    loc = f"{loc} (100% Remote)"

                snippet_raw = r.get("snippet") or ""
                snippet_clean = re.sub(r'<[^>]+>', ' ', snippet_raw).strip()

                benefits_list = r.get("rankedBenefits") or []
                benefits_str = " | ".join([b.get("label", "") for b in benefits_list if isinstance(b, dict)])

                raw_desc = f"{snippet_clean}\nBenefits: {benefits_str}".strip()

                collected.append({
                    "jobId": f"indeed-{jk}",
                    "jobTitle": title,
                    "employer": company,
                    "location": loc,
                    "directUrl": f"https://de.indeed.com/viewjob?jk={jk}",
                    "rawDescription": raw_desc[:1200]
                })

        except Exception as e:
            print(f"  Error on page {page_idx + 1}: {e}")

print(f"\nTotal Indeed jobs collected: {len(collected)}")
with open("scratch/indeed_raw_jobs.json", "w", encoding="utf-8") as f:
    json.dump(collected, f, ensure_ascii=False, indent=2)
print("Saved to scratch/indeed_raw_jobs.json")

