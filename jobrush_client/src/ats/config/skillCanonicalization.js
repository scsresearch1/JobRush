/**
 * Skill Canonicalization - Normalizes skill names to canonical forms
 * Enables deterministic matching across resume variations
 */

export const SKILL_ALIASES = {
  'ml': 'Machine Learning',
  'ai': 'Artificial Intelligence',
  'js': 'JavaScript',
  'ts': 'TypeScript',
  'node': 'Node.js',
  'nodejs': 'Node.js',
  'reactjs': 'React',
  'vuejs': 'Vue.js',
  'postgres': 'PostgreSQL',
  'postgresql': 'PostgreSQL',
  'mongo': 'MongoDB',
  'aws': 'Amazon Web Services',
  'gcp': 'Google Cloud Platform',
  'azure': 'Microsoft Azure',
  'ds': 'Data Structures',
  'algo': 'Algorithms',
  'algorithms': 'Algorithms',
  'oop': 'Object-Oriented Programming',
  'sql': 'SQL',
  'nosql': 'NoSQL',
  'rest': 'REST API',
  'api': 'REST API',
  'git': 'Git',
  'docker': 'Docker',
  'kubernetes': 'Kubernetes',
  'k8s': 'Kubernetes',
  'ci/cd': 'CI/CD',
  'agile': 'Agile',
  'scrum': 'Scrum',
  'python': 'Python',
  'java': 'Java',
  'c++': 'C++',
  'c#': 'C#',
  'go': 'Go',
  'golang': 'Go',
  'html': 'HTML',
  'css': 'CSS',
  'redux': 'Redux',
  'express': 'Express.js',
  'django': 'Django',
  'flask': 'Flask',
  'tensorflow': 'TensorFlow',
  'pytorch': 'PyTorch',
  'pandas': 'Pandas',
  'numpy': 'NumPy',
}

export const SKILL_CATEGORIES = {
  'Programming Languages': ['Python', 'Java', 'JavaScript', 'TypeScript', 'C++', 'C#', 'Go', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'R', 'SQL'],
  'Frameworks': ['React', 'Vue.js', 'Angular', 'Node.js', 'Django', 'Flask', 'Express.js', 'Spring', 'Spring Boot', '.NET'],
  'Databases': ['PostgreSQL', 'MongoDB', 'MySQL', 'Redis', 'SQLite', 'Oracle'],
  'Cloud': ['Amazon Web Services', 'Google Cloud Platform', 'Microsoft Azure', 'Docker', 'Kubernetes'],
  'Data Science': ['Machine Learning', 'Artificial Intelligence', 'TensorFlow', 'PyTorch', 'Pandas', 'NumPy', 'Data Structures', 'Algorithms'],
  'Soft Skills': ['Agile', 'Scrum', 'Communication', 'Leadership', 'Problem Solving', 'Teamwork'],
}

export function canonicalizeSkill(skill) {
  if (!skill || typeof skill !== 'string') return null
  const trimmed = skill.trim()
  const lower = trimmed.toLowerCase()
  return SKILL_ALIASES[lower] || trimmed
}

export function getSkillCategory(skill) {
  const canonical = canonicalizeSkill(skill)
  for (const [category, skills] of Object.entries(SKILL_CATEGORIES)) {
    if (skills.some(s => s.toLowerCase() === (canonical || '').toLowerCase())) return category
  }
  return 'Other'
}
