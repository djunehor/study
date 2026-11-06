import json
import time
import os
import sys

# Ensure omkarcloud indeed scraper is in PYTHONPATH
sys.path.insert(0, os.path.abspath("scratch/omkarcloud-indeed-scraper"))

from indeed import jobs

combos = [
    # 1. Göttingen queries
    {"query": "Customer Service", "location": "Göttingen", "country": "DE", "work_setting": None, "max_pages": 3},
    {"query": "Customer Support", "location": "Göttingen", "country": "DE", "work_setting": None, "max_pages": 2},
    {"query": "English", "location": "Göttingen", "country": "DE", "work_setting": None, "max_pages": 4},
    {"query": "Human Resources", "location": "Göttingen", "country": "DE", "work_setting": None, "max_pages": 2},
    {"query": "HR", "location": "Göttingen", "country": "DE", "work_setting": None, "max_pages": 2},
    {"query": "Administration", "location": "Göttingen", "country": "DE", "work_setting": None, "max_pages": 2},
    {"query": "Administrative Assistant", "location": "Göttingen", "country": "DE", "work_setting": None, "max_pages": 2},
    {"query": "Operations", "location": "Göttingen", "country": "DE", "work_setting": None, "max_pages": 2},
    {"query": "Project Assistant", "location": "Göttingen", "country": "DE", "work_setting": None, "max_pages": 2},
    {"query": "Office Management", "location": "Göttingen", "country": "DE", "work_setting": None, "max_pages": 2},
    {"query": "Communications", "location": "Göttingen", "country": "DE", "work_setting": None, "max_pages": 2},
    {"query": "Recruiting", "location": "Göttingen", "country": "DE", "work_setting": None, "max_pages": 2},
    {"query": None, "location": "Göttingen", "country": "DE", "work_setting": None, "max_pages": 2},

    # 2. Remote Germany queries
    {"query": "Customer Service", "location": "Deutschland", "country": "DE", "work_setting": "remote", "max_pages": 3},
    {"query": "Customer Support", "location": "Deutschland", "country": "DE", "work_setting": "remote", "max_pages": 3},
    {"query": "Customer Success", "location": "Deutschland", "country": "DE", "work_setting": "remote", "max_pages": 3},
    {"query": "English Remote", "location": "Deutschland", "country": "DE", "work_setting": "remote", "max_pages": 4},
    {"query": "Client Relations", "location": "Deutschland", "country": "DE", "work_setting": "remote", "max_pages": 2},
    {"query": "Human Resources", "location": "Deutschland", "country": "DE", "work_setting": "remote", "max_pages": 3},
    {"query": "HR Recruiter", "location": "Deutschland", "country": "DE", "work_setting": "remote", "max_pages": 3},
    {"query": "Talent Acquisition", "location": "Deutschland", "country": "DE", "work_setting": "remote", "max_pages": 3},
    {"query": "Administrative Assistant", "location": "Deutschland", "country": "DE", "work_setting": "remote", "max_pages": 3},
    {"query": "Virtual Assistant", "location": "Deutschland", "country": "DE", "work_setting": "remote", "max_pages": 3},
    {"query": "Operations Specialist", "location": "Deutschland", "country": "DE", "work_setting": "remote", "max_pages": 2},
    {"query": "Community Manager", "location": "Deutschland", "country": "DE", "work_setting": "remote", "max_pages": 2},
    {"query": "Account Manager", "location": "Deutschland", "country": "DE", "work_setting": "remote", "max_pages": 3},
]

collected = []
seen_ids = set()

# Pre-load existing indeed collected jobs if any to avoid duplicates
if os.path.exists("scratch/indeed_omkar_jobs.json"):
    try:
        with open("scratch/indeed_omkar_jobs.json", "r", encoding="utf-8") as f:
            existing = json.load(f)
            for j in existing:
                jid = j.get("id") or j.get("jobId")
                if jid:
                    seen_ids.add(jid)
            collected.extend(existing)
            print(f"Loaded {len(collected)} previously scraped Indeed jobs.")
    except Exception as e:
        print(f"Could not load existing jobs: {e}")

print(f"Starting Indeed scrape across {len(combos)} query combinations...")

for idx, combo in enumerate(combos, start=1):
    q = combo["query"]
    loc = combo["location"]
    ws = combo["work_setting"]
    max_pages = combo["max_pages"]

    print(f"\n[{idx}/{len(combos)}] Query='{q}', Location='{loc}', WorkSetting='{ws}' (pages: {max_pages})")

    for page in range(1, max_pages + 1):
        try:
            time.sleep(1.2)  # Polite pacing to avoid any rate limits
            res = jobs.search(
                query=q,
                location=loc,
                country="DE",
                work_setting=ws,
                page=page
            )

            job_list = res.get("jobs", [])
            total_count = res.get("pagination", {}).get("total_count", 0)
            print(f"  Page {page}: returned {len(job_list)} jobs (total available: {total_count})")

            if not job_list:
                break

            new_in_page = 0
            for j in job_list:
                jid = j.get("id")
                if not jid or jid in seen_ids:
                    continue
                seen_ids.add(jid)

                # Format location
                loc_obj = j.get("location") or {}
                loc_str = loc_obj.get("display_name") or loc_obj.get("city") or loc
                if ws == "remote" and "Remote" not in loc_str:
                    loc_str = f"{loc_str} (100% Remote)"

                # Format direct URL
                direct_url = j.get("apply_link") or j.get("link") or f"https://de.indeed.com/viewjob?jk={jid}"

                # Employer name
                employer_name = (j.get("company") or {}).get("name") or j.get("source") or "Company"

                desc = j.get("description") or ""
                skills = j.get("skills") or []
                skills_str = ", ".join(skills[:8]) if skills else ""
                full_desc = f"{desc}\nKey Skills: {skills_str}".strip()

                collected.append({
                    "jobId": f"indeed-{jid}",
                    "id": jid,
                    "jobTitle": j.get("title", ""),
                    "employer": employer_name,
                    "location": loc_str,
                    "directUrl": direct_url,
                    "rawDescription": full_desc[:1500]
                })
                new_in_page += 1

            print(f"    Added {new_in_page} new unique jobs. (Total collected: {len(collected)})")

        except Exception as err:
            print(f"  Error on page {page}: {err}")
            time.sleep(2.0)

print(f"\nScraping complete! Total unique Indeed jobs collected: {len(collected)}")

with open("scratch/indeed_omkar_jobs.json", "w", encoding="utf-8") as f:
    json.dump(collected, f, ensure_ascii=False, indent=2)

print("Saved to scratch/indeed_omkar_jobs.json")

