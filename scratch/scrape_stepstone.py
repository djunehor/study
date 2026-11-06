import json
import os
import sys

# Add omkarcloud scraper to path
sys.path.insert(0, os.path.abspath('scratch/omkarcloud-stepstone-scraper'))

from stepstone import jobs

def collect_stepstone_jobs():
    collected = []
    seen_ids = set()

    print("1. Fetching Stepstone 100% Remote Germany listings...")
    # Fetch 4 pages of 100% remote jobs in Germany
    for page in range(1, 5):
        try:
            print(f"Fetching Remote page {page}...")
            res = jobs.search(keyword='', location='Deutschland', remote='full', page=page)
            job_list = res.get('jobs', [])
            print(f"Page {page} returned {len(job_list)} remote jobs.")
            for item in job_list:
                jid = f"stepstone-{item.get('id')}"
                if jid in seen_ids:
                    continue
                seen_ids.add(jid)

                company_info = item.get('company') or {}
                company_name = company_info.get('name') if isinstance(company_info, dict) else 'Company'
                loc_info = item.get('location') or {}
                loc_text = loc_info.get('text') if isinstance(loc_info, dict) else 'Deutschland'

                snippet = item.get('snippet') or ''
                benefits = " | ".join(item.get('benefits') or [])
                raw_desc = f"{snippet}\nBenefits: {benefits}"

                collected.append({
                    "jobId": jid,
                    "jobTitle": item.get('title') or '',
                    "employer": company_name or 'Company',
                    "location": f"{loc_text} (100% Remote)",
                    "directUrl": item.get('link') or '',
                    "rawDescription": raw_desc[:1200]
                })
        except Exception as e:
            print(f"Error on remote page {page}: {e}")

    print("2. Fetching Stepstone Göttingen local listings...")
    # Fetch 4 pages of Göttingen local jobs
    for page in range(1, 5):
        try:
            print(f"Fetching Göttingen page {page}...")
            res = jobs.search(keyword='', location='Göttingen', page=page)
            job_list = res.get('jobs', [])
            print(f"Page {page} returned {len(job_list)} Göttingen jobs.")
            for item in job_list:
                jid = f"stepstone-{item.get('id')}"
                if jid in seen_ids:
                    continue
                seen_ids.add(jid)

                company_info = item.get('company') or {}
                company_name = company_info.get('name') if isinstance(company_info, dict) else 'Company'
                loc_info = item.get('location') or {}
                loc_text = loc_info.get('text') if isinstance(loc_info, dict) else 'Göttingen'

                snippet = item.get('snippet') or ''
                benefits = " | ".join(item.get('benefits') or [])
                raw_desc = f"{snippet}\nBenefits: {benefits}"

                collected.append({
                    "jobId": jid,
                    "jobTitle": item.get('title') or '',
                    "employer": company_name or 'Company',
                    "location": loc_text,
                    "directUrl": item.get('link') or '',
                    "rawDescription": raw_desc[:1200]
                })
        except Exception as e:
            print(f"Error on Göttingen page {page}: {e}")

    print(f"Total Stepstone jobs collected: {len(collected)}")
    with open('scratch/stepstone_raw_jobs.json', 'w', encoding='utf-8') as f:
        json.dump(collected, f, ensure_ascii=False, indent=2)
    print("Saved to scratch/stepstone_raw_jobs.json")

if __name__ == '__main__':
    collect_stepstone_jobs()

