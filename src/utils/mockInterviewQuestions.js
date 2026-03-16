/**
 * Generate 5 HR-style interview questions from resume JSON
 * Fully local - no API calls. Used for Mock Interview Stage 1.
 * Questions vary each time using random selection.
 *
 * Question types:
 * 1. self-introduction
 * 2. resume-specific project question
 * 3. skill depth question
 * 4. situational question
 * 5. role motivation question
 */

const SELF_INTRO_PROMPTS = [
  'Tell me about yourself. Walk me through your background, key experiences, and what brings you here today.',
  'Give me a brief overview of yourself—your background, what drives you, and why you\'re here.',
  'Walk me through your resume. Highlight the key experiences that have shaped your career so far.',
]

const SITUATIONAL_PROMPTS = [
  'Describe a situation where you had to meet a tight deadline. How did you prioritize and deliver?',
  'Tell me about a time when you had to work with a difficult team member. How did you handle it?',
  'Describe a situation where you had to learn something new quickly. What was your approach?',
  'Tell me about a time when a project didn\'t go as planned. What did you learn?',
  'Describe a situation where you had to take initiative without clear direction. What did you do?',
  'Tell me about a time when you had to persuade others to adopt your idea. How did you approach it?',
  'Describe a situation where you had to juggle multiple priorities. How did you manage your time?',
]

const PROJECT_QUESTION_TEMPLATES = [
  (name) => `I see you worked on ${name}. Can you tell me more about your role, the challenges you faced, and the outcomes you achieved?`,
  (name) => `Tell me about ${name}. What was your contribution, and what would you do differently if you could?`,
  (name) => `Walk me through ${name}. What problem were you solving, and how did you measure success?`,
]

const SKILL_QUESTION_TEMPLATES = [
  (skill) => `How would you describe your proficiency in ${skill}? Can you give me a concrete example of how you've applied it?`,
  (skill) => `Tell me about a time when ${skill} was critical to a project. How did you leverage it?`,
  (skill) => `What's your approach to staying current with ${skill}? Can you share a recent learning?`,
]

const ROLE_MOTIVATION_TEMPLATES = [
  (role) => `What motivates you to pursue roles in ${role}? Where do you see yourself in the next few years?`,
  (role) => `Why are you interested in ${role} positions? What excites you about this career path?`,
  (role) => `What drew you to ${role}? How do you see your career evolving in this space?`,
]

function pickRandom(arr, rng = Math.random) {
  return arr[Math.floor(rng() * arr.length)]
}

/** Seeded random for reproducible but different questions on retry */
function seededRandom(seed) {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
}

/**
 * @param {Object} resume - Parsed resume { name, skills, experience, education, projects }
 * @param {number} [seed] - Optional seed (e.g. Date.now()) to force different questions on retry
 * @returns {Array<{ type: string, question: string }>} 5 interview questions (varies each call)
 */
export function generateInterviewQuestions(resume, seed) {
  const rng = seed != null ? seededRandom(seed) : Math.random
  if (!resume) return []

  const questions = []
  const skills = resume.skills || []
  const experience = resume.experience || []
  const projects = resume.projects || []
  const education = resume.education || []

  // 1. Self-introduction (random prompt)
  questions.push({
    type: 'self-introduction',
    question: pickRandom(SELF_INTRO_PROMPTS, rng),
  })

  // 2. Resume-specific project question (random project + template)
  const projectPool = [...projects, ...experience].filter(Boolean)
  const project = projectPool.length ? pickRandom(projectPool, rng) : null
  const projectName = project?.name || project?.role || project?.title || 'a recent project'
  const projectTemplate = pickRandom(PROJECT_QUESTION_TEMPLATES, rng)
  questions.push({
    type: 'resume-specific-project',
    question: project ? projectTemplate(projectName) : 'Tell me about a project or initiative you\'re proud of. What was your contribution and what impact did it have?',
  })

  // 3. Skill depth question (random skill + template)
  const skill = skills.length ? pickRandom(skills, rng) : (experience[0] ? 'your core technical skills' : 'your key skills')
  const skillTemplate = pickRandom(SKILL_QUESTION_TEMPLATES, rng)
  questions.push({
    type: 'skill-depth',
    question: skillTemplate(typeof skill === 'string' ? skill : skill?.name || 'your key skills'),
  })

  // 4. Situational question (random)
  questions.push({
    type: 'situational',
    question: pickRandom(SITUATIONAL_PROMPTS, rng),
  })

  // 5. Role motivation question (random template)
  const recentRole = experience[0]?.role || experience[0]?.title || 'your field'
  const roleTemplate = pickRandom(ROLE_MOTIVATION_TEMPLATES, rng)
  questions.push({
    type: 'role-motivation',
    question: roleTemplate(recentRole),
  })

  return questions
}
