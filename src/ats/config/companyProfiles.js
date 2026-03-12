/**
 * Company & University Requirement Models
 * Formal structured profiles for deterministic matching
 */

export const DEFAULT_WEIGHTS = {
  mandatory: 0.40,
  preferred: 0.20,
  projects: 0.20,
  education: 0.10,
  formatting: 0.10,
}

// 20 Mass Hiring Companies - Fresher roles
export const MASS_HIRING_PROFILES = [
  { entity: 'TCS', type: 'company', role: 'Fresher Software Engineer', mandatory_skills: ['Data Structures', 'Algorithms', 'Java', 'SQL'], preferred_skills: ['Python', 'JavaScript', 'Agile'], education: ['B.Tech', 'B.E.', 'M.Tech', 'BCA', 'MCA'], weights: { ...DEFAULT_WEIGHTS } },
  { entity: 'Infosys', type: 'company', role: 'Systems Engineer', mandatory_skills: ['Data Structures', 'Algorithms', 'Java', 'SQL'], preferred_skills: ['Python', 'Agile', 'Git'], education: ['B.Tech', 'B.E.', 'BCA', 'MCA'], weights: { ...DEFAULT_WEIGHTS } },
  { entity: 'Wipro', type: 'company', role: 'Project Engineer', mandatory_skills: ['Data Structures', 'Algorithms', 'Java', 'SQL'], preferred_skills: ['Python', 'JavaScript', 'Agile'], education: ['B.Tech', 'B.E.', 'BCA', 'MCA'], weights: { ...DEFAULT_WEIGHTS } },
  { entity: 'Cognizant', type: 'company', role: 'Programmer Analyst', mandatory_skills: ['Data Structures', 'Algorithms', 'Java', 'SQL'], preferred_skills: ['Python', 'JavaScript', 'Agile'], education: ['B.Tech', 'B.E.', 'BCA', 'MCA'], weights: { ...DEFAULT_WEIGHTS } },
  { entity: 'Accenture', type: 'company', role: 'Associate Software Engineer', mandatory_skills: ['Data Structures', 'Algorithms', 'Java', 'SQL'], preferred_skills: ['Python', 'Agile', 'Cloud'], education: ['B.Tech', 'B.E.', 'BCA', 'MCA'], weights: { ...DEFAULT_WEIGHTS } },
  { entity: 'Capgemini', type: 'company', role: 'Consultant', mandatory_skills: ['Data Structures', 'Algorithms', 'Java', 'SQL'], preferred_skills: ['Python', 'Agile'], education: ['B.Tech', 'B.E.', 'BCA', 'MCA'], weights: { ...DEFAULT_WEIGHTS } },
  { entity: 'HCL Tech', type: 'company', role: 'Graduate Engineer', mandatory_skills: ['Data Structures', 'Algorithms', 'Java', 'SQL'], preferred_skills: ['Python', 'JavaScript'], education: ['B.Tech', 'B.E.', 'BCA', 'MCA'], weights: { ...DEFAULT_WEIGHTS } },
  { entity: 'Tech Mahindra', type: 'company', role: 'Software Engineer', mandatory_skills: ['Data Structures', 'Algorithms', 'Java', 'SQL'], preferred_skills: ['Python', 'Agile'], education: ['B.Tech', 'B.E.', 'BCA', 'MCA'], weights: { ...DEFAULT_WEIGHTS } },
  { entity: 'L&T Infotech', type: 'company', role: 'Graduate Engineer Trainee', mandatory_skills: ['Data Structures', 'Algorithms', 'Java', 'SQL'], preferred_skills: ['Python', 'Agile'], education: ['B.Tech', 'B.E.'], weights: { ...DEFAULT_WEIGHTS } },
  { entity: 'Deloitte', type: 'company', role: 'Analyst', mandatory_skills: ['SQL', 'Excel', 'Data Structures'], preferred_skills: ['Python', 'Agile', 'Communication'], education: ['B.Tech', 'B.E.', 'B.Com', 'BCA', 'MCA'], weights: { ...DEFAULT_WEIGHTS } },
  { entity: 'EY', type: 'company', role: 'Staff Consultant', mandatory_skills: ['SQL', 'Data Structures'], preferred_skills: ['Python', 'Agile', 'Excel'], education: ['B.Tech', 'B.E.', 'BCA', 'MCA'], weights: { ...DEFAULT_WEIGHTS } },
  { entity: 'KPMG', type: 'company', role: 'Associate', mandatory_skills: ['SQL', 'Data Structures'], preferred_skills: ['Python', 'Excel', 'Agile'], education: ['B.Tech', 'B.E.', 'BCA', 'MCA'], weights: { ...DEFAULT_WEIGHTS } },
  { entity: 'IBM', type: 'company', role: 'Associate Developer', mandatory_skills: ['Data Structures', 'Algorithms', 'Java', 'SQL'], preferred_skills: ['Python', 'Cloud', 'Agile'], education: ['B.Tech', 'B.E.', 'BCA', 'MCA'], weights: { ...DEFAULT_WEIGHTS } },
  { entity: 'Oracle', type: 'company', role: 'Applications Developer', mandatory_skills: ['Data Structures', 'Algorithms', 'Java', 'SQL'], preferred_skills: ['Python', 'Oracle DB', 'Cloud'], education: ['B.Tech', 'B.E.', 'BCA', 'MCA'], weights: { ...DEFAULT_WEIGHTS } },
  { entity: 'SAP', type: 'company', role: 'Associate Developer', mandatory_skills: ['Data Structures', 'Algorithms', 'Java', 'SQL'], preferred_skills: ['Python', 'SAP', 'Agile'], education: ['B.Tech', 'B.E.', 'BCA', 'MCA'], weights: { ...DEFAULT_WEIGHTS } },
  { entity: 'Cisco', type: 'company', role: 'Software Engineer I', mandatory_skills: ['Data Structures', 'Algorithms', 'C++', 'Python'], preferred_skills: ['Networking', 'Linux', 'Git'], education: ['B.Tech', 'B.E.', 'M.Tech'], weights: { ...DEFAULT_WEIGHTS } },
  { entity: 'Intel', type: 'company', role: 'Graduate Technical Intern', mandatory_skills: ['Data Structures', 'Algorithms', 'C++', 'Python'], preferred_skills: ['Hardware', 'Linux', 'Git'], education: ['B.Tech', 'B.E.', 'M.Tech'], weights: { ...DEFAULT_WEIGHTS } },
  { entity: 'NVIDIA', type: 'company', role: 'Software Intern', mandatory_skills: ['Data Structures', 'Algorithms', 'C++', 'Python'], preferred_skills: ['Machine Learning', 'CUDA', 'Git'], education: ['B.Tech', 'B.E.', 'M.Tech'], weights: { ...DEFAULT_WEIGHTS } },
  { entity: 'Qualcomm', type: 'company', role: 'Engineer', mandatory_skills: ['Data Structures', 'Algorithms', 'C++', 'Python'], preferred_skills: ['Embedded', 'Linux', 'Git'], education: ['B.Tech', 'B.E.', 'M.Tech'], weights: { ...DEFAULT_WEIGHTS } },
  { entity: 'Adobe', type: 'company', role: 'Computer Scientist', mandatory_skills: ['Data Structures', 'Algorithms', 'Java', 'JavaScript'], preferred_skills: ['React', 'Python', 'Git'], education: ['B.Tech', 'B.E.', 'M.Tech'], weights: { ...DEFAULT_WEIGHTS } },
]

// MAANG Companies
export const MAANG_PROFILES = [
  { entity: 'Meta', type: 'company', mandatory_skills: ['Data Structures', 'Algorithms', 'Python', 'SQL'], preferred_skills: ['System Design', 'React', 'Machine Learning'], education: ['B.Tech', 'B.E.', 'M.Tech', 'B.S.', 'M.S.'], weights: { ...DEFAULT_WEIGHTS } },
  { entity: 'Apple', type: 'company', mandatory_skills: ['Data Structures', 'Algorithms', 'C++', 'Python'], preferred_skills: ['Swift', 'iOS', 'System Design'], education: ['B.Tech', 'B.E.', 'M.Tech', 'B.S.', 'M.S.'], weights: { ...DEFAULT_WEIGHTS } },
  { entity: 'Amazon', type: 'company', mandatory_skills: ['Data Structures', 'Algorithms', 'Java', 'Python'], preferred_skills: ['System Design', 'AWS', 'SQL'], education: ['B.Tech', 'B.E.', 'M.Tech', 'B.S.', 'M.S.'], weights: { ...DEFAULT_WEIGHTS } },
  { entity: 'Netflix', type: 'company', mandatory_skills: ['Data Structures', 'Algorithms', 'Java', 'Python'], preferred_skills: ['System Design', 'Distributed Systems', 'Cloud'], education: ['B.Tech', 'B.E.', 'M.Tech', 'B.S.', 'M.S.'], weights: { ...DEFAULT_WEIGHTS } },
  { entity: 'Google', type: 'company', mandatory_skills: ['Data Structures', 'Algorithms', 'Python', 'C++'], preferred_skills: ['System Design', 'Machine Learning', 'Go'], education: ['B.Tech', 'B.E.', 'M.Tech', 'B.S.', 'M.S.'], weights: { ...DEFAULT_WEIGHTS } },
]

// Ivy League Universities (Graduate/Research)
export const IVY_LEAGUE_PROFILES = [
  { entity: 'Harvard University', type: 'university', mandatory_skills: ['Research', 'Data Structures', 'Algorithms'], preferred_skills: ['Machine Learning', 'Python', 'Publication'], education: ['B.Tech', 'B.E.', 'B.S.', 'M.S.'], weights: { mandatory: 0.30, preferred: 0.25, projects: 0.25, education: 0.15, formatting: 0.05 } },
  { entity: 'Yale University', type: 'university', mandatory_skills: ['Research', 'Data Structures'], preferred_skills: ['Python', 'Machine Learning', 'Publication'], education: ['B.Tech', 'B.E.', 'B.S.', 'M.S.'], weights: { mandatory: 0.30, preferred: 0.25, projects: 0.25, education: 0.15, formatting: 0.05 } },
  { entity: 'Princeton University', type: 'university', mandatory_skills: ['Research', 'Algorithms', 'Data Structures'], preferred_skills: ['Machine Learning', 'Python', 'Publication'], education: ['B.Tech', 'B.E.', 'B.S.', 'M.S.'], weights: { mandatory: 0.30, preferred: 0.25, projects: 0.25, education: 0.15, formatting: 0.05 } },
  { entity: 'Columbia University', type: 'university', mandatory_skills: ['Research', 'Data Structures'], preferred_skills: ['Machine Learning', 'Python', 'Publication'], education: ['B.Tech', 'B.E.', 'B.S.', 'M.S.'], weights: { mandatory: 0.30, preferred: 0.25, projects: 0.25, education: 0.15, formatting: 0.05 } },
  { entity: 'University of Pennsylvania', type: 'university', mandatory_skills: ['Research', 'Data Structures'], preferred_skills: ['Machine Learning', 'Python'], education: ['B.Tech', 'B.E.', 'B.S.', 'M.S.'], weights: { mandatory: 0.30, preferred: 0.25, projects: 0.25, education: 0.15, formatting: 0.05 } },
  { entity: 'Brown University', type: 'university', mandatory_skills: ['Research', 'Data Structures'], preferred_skills: ['Python', 'Machine Learning'], education: ['B.Tech', 'B.E.', 'B.S.', 'M.S.'], weights: { mandatory: 0.30, preferred: 0.25, projects: 0.25, education: 0.15, formatting: 0.05 } },
  { entity: 'Dartmouth College', type: 'university', mandatory_skills: ['Research', 'Data Structures'], preferred_skills: ['Python', 'Machine Learning'], education: ['B.Tech', 'B.E.', 'B.S.', 'M.S.'], weights: { mandatory: 0.30, preferred: 0.25, projects: 0.25, education: 0.15, formatting: 0.05 } },
  { entity: 'Cornell University', type: 'university', mandatory_skills: ['Research', 'Data Structures', 'Algorithms'], preferred_skills: ['Machine Learning', 'Python', 'Publication'], education: ['B.Tech', 'B.E.', 'B.S.', 'M.S.'], weights: { mandatory: 0.30, preferred: 0.25, projects: 0.25, education: 0.15, formatting: 0.05 } },
  { entity: 'MIT', type: 'university', mandatory_skills: ['Research', 'Data Structures', 'Algorithms'], preferred_skills: ['Machine Learning', 'Python', 'Publication'], education: ['B.Tech', 'B.E.', 'B.S.', 'M.S.'], weights: { mandatory: 0.30, preferred: 0.25, projects: 0.25, education: 0.15, formatting: 0.05 } },
  { entity: 'Stanford University', type: 'university', mandatory_skills: ['Research', 'Data Structures', 'Algorithms'], preferred_skills: ['Machine Learning', 'Python', 'Publication'], education: ['B.Tech', 'B.E.', 'B.S.', 'M.S.'], weights: { mandatory: 0.30, preferred: 0.25, projects: 0.25, education: 0.15, formatting: 0.05 } },
]
