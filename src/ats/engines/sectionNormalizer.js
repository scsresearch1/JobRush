/**
 * Section Normalization Engine
 * Maps inconsistent resume section titles to standard categories
 */

import { normalizeSectionTitle } from '../config/sectionMappings.js'
import { SECTION_STANDARD } from '../types.js'

/**
 * Normalize a parsed resume structure - ensure all sections use standard keys
 * @param {Object} parsedResume - Raw parsed resume from parser
 * @returns {Object} Normalized resume with standard section keys
 */
export function normalizeResume(parsedResume) {
  if (!parsedResume) return null

  const result = {
    name: parsedResume.name || '',
    email: parsedResume.email || '',
    phone: parsedResume.phone || '',
    skills: [],
    experience: [],
    education: [],
    projects: [],
  }

  // Direct mappings - normalize experience/education shape
  if (Array.isArray(parsedResume.skills)) result.skills = parsedResume.skills
  if (Array.isArray(parsedResume.experience)) {
    result.experience = parsedResume.experience.map(e => ({
      company: e.company || '',
      role: e.role || e.title || '',
      start_date: e.start_date || e.duration?.split('-')[0]?.trim(),
      end_date: e.end_date || e.duration?.split('-')[1]?.trim() || 'Present',
      description: e.description || '',
    }))
  }
  if (Array.isArray(parsedResume.education)) {
    result.education = parsedResume.education.map(e => ({
      degree: e.degree || '',
      institution: e.institution || '',
      year: e.year || '',
    }))
  }
  if (Array.isArray(parsedResume.projects)) {
    result.projects = parsedResume.projects.map(p => ({
      name: p.name || '',
      description: p.description || '',
      technologies: p.technologies || [],
    }))
  }

  // Extract skills from other sections if skills is empty
  if (result.skills.length === 0) {
    const fromExperience = (parsedResume.experience || []).flatMap(e => extractSkillsFromText(e.description || e.role || e.title || ''))
    const fromProjects = (parsedResume.projects || []).flatMap(p => extractSkillsFromText(p.description || (p.technologies || []).join(' ') || ''))
    result.skills = [...new Set([...fromExperience, ...fromProjects])]
  }

  return result
}

function extractSkillsFromText(text) {
  if (!text) return []
  const commonSkills = ['Python', 'Java', 'JavaScript', 'React', 'Node.js', 'SQL', 'Git', 'Agile', 'Machine Learning', 'Data Structures', 'Algorithms']
  const lower = text.toLowerCase()
  return commonSkills.filter(s => lower.includes(s.toLowerCase()))
}
