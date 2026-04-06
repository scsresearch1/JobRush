/**
 * Transform OpenResume parser output to JobRush.ai ATS format
 * Maps profile, workExperiences, educations, projects, skills to our schema
 */

/**
 * @param {Object} raw - Raw output from @prolaxu/open-resume-pdf-parser
 * @returns {Object} Normalized resume for ATS engine
 */
export function transformParsedResume(raw) {
  if (!raw) return null

  const profile = raw.profile || {}
  const workExperiences = raw.workExperiences || []
  const educations = raw.educations || []
  const projects = raw.projects || []
  const skills = raw.skills || {}
  const certifications = raw.certifications || []
  const languages = raw.languages || []

  const experience = workExperiences.map((exp) => ({
    company: exp.company || '',
    role: exp.jobTitle || '',
    title: exp.jobTitle || '',
    duration: exp.date || '',
    description: Array.isArray(exp.descriptions) ? exp.descriptions.join('\n') : '',
  }))

  const education = educations.map((edu) => ({
    degree: edu.degree || '',
    institution: edu.school || '',
    year: edu.date || '',
  }))

  const projectsList = projects.map((proj) => ({
    name: proj.project || '',
    description: Array.isArray(proj.descriptions) ? proj.descriptions.join('\n') : '',
    technologies: [],
  }))

  const skillsList = [
    ...(skills.featuredSkills || []).map((s) => (typeof s === 'string' ? s : s.skill)).filter(Boolean),
    ...certifications,
    ...languages,
  ]
  const skillsUnique = [...new Set(skillsList)]

  return {
    name: profile.name || '',
    email: profile.email || '',
    phone: profile.phone || '',
    skills: skillsUnique,
    experience,
    education,
    projects: projectsList,
  }
}
