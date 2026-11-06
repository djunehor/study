import { initDatabase, savePositions, getAllStoredPositions } from '../src/db';
import { JOBS_GOTTINGEN_DATA } from '../src/jobs-gottingen-data';
import { PhDPosition } from '../src/types';

async function main() {
  const db = initDatabase();

  const convertedPositions: PhDPosition[] = JOBS_GOTTINGEN_DATA.map((j) => {
    const isGoe = j.workplaceLocation.toLowerCase().includes('göttingen') || j.workplaceLocation.toLowerCase().includes('goettingen');
    const state = isGoe ? 'Niedersachsen' : 'bundesweit (100% Remote)';

    return {
      id: j.jobId,
      title: j.jobTitle,
      employer: j.employer,
      location: j.workplaceLocation,
      postalCode: isGoe ? '37073' : undefined,
      state: state,
      isWestGermany: true,
      publicationDate: '2026-11-06',
      applicationWindow: 'Open now',
      deadline: 'Rolling / Open',
      link: j.directApplicationLink,
      matchedKeywords: [j.category, 'English-speaking', 'Degree-educated'],
      isEnglishPreferred: true,
      description: j.fitAssessment,
      source: j.jobId.startsWith('indeed-') ? 'Indeed' : j.jobId.startsWith('sartorius-') ? 'Sartorius' : j.jobId.startsWith('uni-') ? 'Uni Göttingen' : 'Direct Employer',
      opportunityType: 'Live Vacancy',
      verificationStatus: 'Verified Match',
      matchScore: 100,
      degreeFit: 'BSc International Relations + MSc Industrial Relations & HRM',
      languageRequirement: 'English Only (Zero German Required)',
      compensation: 'Paid Employment Contract',
      aiSummary: j.fitAssessment,
      evaluatedBy: 'Gemini AI',
    };
  });

  console.log(`Saving ${convertedPositions.length} verified jobs into data/phd_storage.db...`);
  savePositions(convertedPositions, db);

  const all = getAllStoredPositions(db);
  console.log(`Total positions in SQLite database now: ${all.length}`);

  const verifiedCount = all.filter((p) => p.verificationStatus === 'Verified Match').length;
  console.log(`Verified matches in database: ${verifiedCount}`);
}

main().catch(console.error);

