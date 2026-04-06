import { jsPDF } from 'jspdf'

// Get template layout and colors based on template ID
const getTemplateConfig = (templateId) => {
  // Extract layout from template ID patterns
  const layoutMap = {
    'modern-minimal': 'modern-minimal',
    'executive': 'executive',
    'creative': 'creative',
    'academic': 'academic',
    'chronological': 'chronological',
    'skills-focused': 'skills-focused',
    'two-column': 'two-column',
    'achievement-focused': 'achievement-focused',
    'project-focused': 'project-focused'
  }

  // Determine layout from template ID
  let layout = 'modern-minimal'
  for (const [key, value] of Object.entries(layoutMap)) {
    if (templateId.includes(key)) {
      layout = value
      break
    }
  }

  // Template-specific colors
  const colorMap = {
    'tech-modern-minimal': { primary: '#0ea5e9', secondary: '#38bdf8' },
    'tech-chronological': { primary: '#f97316', secondary: '#ef4444' },
    'tech-skills-focused': { primary: '#6366f1', secondary: '#3b82f6' },
    'tech-two-column': { primary: '#a855f7', secondary: '#ec4899' },
    'data-academic-professional': { primary: '#10b981', secondary: '#34d399' },
    'data-modern-analytics': { primary: '#0ea5e9', secondary: '#38bdf8' },
    'data-skills-dense': { primary: '#6366f1', secondary: '#3b82f6' },
    'data-project-focused': { primary: '#14b8a6', secondary: '#10b981' },
    'pm-executive-classic': { primary: '#374151', secondary: '#6b7280' },
    'pm-strategic-leader': { primary: '#3b82f6', secondary: '#6366f1' },
    'pm-achievement-focused': { primary: '#a855f7', secondary: '#ec4899' },
    'pm-two-column': { primary: '#475569', secondary: '#64748b' },
    'ba-professional-classic': { primary: '#374151', secondary: '#6b7280' },
    'ba-modern-analyst': { primary: '#0ea5e9', secondary: '#38bdf8' },
    'ba-data-focused': { primary: '#6366f1', secondary: '#3b82f6' },
    'ba-consultant-style': { primary: '#475569', secondary: '#64748b' },
    'marketing-creative-bold': { primary: '#a855f7', secondary: '#ec4899' },
    'marketing-modern-vibrant': { primary: '#ec4899', secondary: '#f43f5e' },
    'marketing-results-driven': { primary: '#f97316', secondary: '#ef4444' },
    'marketing-portfolio-style': { primary: '#a855f7', secondary: '#6366f1' },
    'design-creative-bold': { primary: '#a855f7', secondary: '#ec4899' },
    'design-minimal-elegant': { primary: '#374151', secondary: '#6b7280' },
    'design-portfolio-showcase': { primary: '#ec4899', secondary: '#f43f5e' },
    'design-two-column': { primary: '#6366f1', secondary: '#a855f7' },
    'consultant-executive': { primary: '#374151', secondary: '#6b7280' },
    'consultant-strategic': { primary: '#3b82f6', secondary: '#6366f1' },
    'consultant-project-focused': { primary: '#475569', secondary: '#64748b' },
    'consultant-two-column': { primary: '#475569', secondary: '#64748b' },
    'general-modern-minimal': { primary: '#0ea5e9', secondary: '#38bdf8' },
    'general-professional-classic': { primary: '#374151', secondary: '#6b7280' },
    'general-chronological': { primary: '#f97316', secondary: '#ef4444' },
    'general-two-column': { primary: '#6366f1', secondary: '#3b82f6' }
  }

  const colors = colorMap[templateId] || { primary: '#0ea5e9', secondary: '#38bdf8' }

  return { layout, colors }
}

const getJobRoleName = (jobRoleId) => {
  const roleMap = {
    'software-engineer': 'Software Engineer',
    'data-scientist': 'Data Scientist',
    'product-manager': 'Product Manager',
    'business-analyst': 'Business Analyst',
    'marketing': 'Marketing Specialist',
    'designer': 'UI/UX Designer',
    'consultant': 'Consultant',
    'general': 'Professional'
  }
  return roleMap[jobRoleId] || 'Professional'
}

const getSkillsForJobRole = (jobRoleId) => {
  const skillsMap = {
    'software-engineer': ['Java', 'Python', 'JavaScript', 'React', 'Node.js', 'SQL', 'Git', 'Docker', 'AWS', 'TypeScript', 'REST APIs'],
    'data-scientist': ['Python', 'R', 'SQL', 'Machine Learning', 'Data Analysis', 'Pandas', 'TensorFlow', 'Tableau', 'Deep Learning', 'Statistics'],
    'product-manager': ['Product Strategy', 'Agile', 'JIRA', 'Analytics', 'User Research', 'Roadmapping', 'Stakeholder Management', 'A/B Testing'],
    'business-analyst': ['SQL', 'Excel', 'Tableau', 'Requirements Analysis', 'Process Improvement', 'Data Modeling', 'Business Intelligence'],
    'marketing': ['Digital Marketing', 'SEO', 'Google Analytics', 'Content Strategy', 'Social Media', 'Email Marketing', 'Campaign Management'],
    'designer': ['Figma', 'Adobe XD', 'Sketch', 'User Research', 'Prototyping', 'UI/UX Design', 'Design Systems', 'Wireframing'],
    'consultant': ['Strategy', 'Problem Solving', 'Analytics', 'Client Management', 'Presentation', 'Business Analysis', 'Project Management'],
    'general': ['Communication', 'Leadership', 'Problem Solving', 'Project Management', 'Team Collaboration', 'Analytical Thinking']
  }
  return skillsMap[jobRoleId] || skillsMap['general']
}

// Generate modern minimal layout
const generateModernMinimal = (doc, colors, jobRole, jobRoleId) => {
  // Header
  doc.setFillColor(colors.primary)
  doc.rect(0, 0, 210, 40, 'F')
  
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text('YOUR NAME', 105, 20, { align: 'center' })
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(jobRole || 'Professional', 105, 28, { align: 'center' })
  
  doc.setFontSize(9)
  doc.text('your.email@example.com | +1 (555) 123-4567 | linkedin.com/in/yourprofile', 105, 35, { align: 'center' })

  doc.setTextColor(0, 0, 0)
  let y = 50

  // Summary
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setDrawColor(colors.primary)
  doc.setLineWidth(0.5)
  doc.line(10, y, 200, y)
  y += 5
  doc.text('PROFESSIONAL SUMMARY', 10, y)
  y += 8
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const summary = `Experienced ${jobRole || 'professional'} with a proven track record of delivering results. Skilled in problem-solving, team collaboration, and continuous learning. Committed to excellence and driving innovation.`
  const summaryLines = doc.splitTextToSize(summary, 190)
  doc.text(summaryLines, 10, y)
  y += summaryLines.length * 6 + 5

  // Experience
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.line(10, y, 200, y)
  y += 5
  doc.text('PROFESSIONAL EXPERIENCE', 10, y)
  y += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(`Senior ${jobRole || 'Professional'}`, 10, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Company Name | City, State | Jan 2020 - Present', 10, y + 5)
  y += 12

  const exp1 = [
    'Led cross-functional teams to deliver projects 30% ahead of schedule',
    'Implemented process improvements resulting in 25% efficiency increase',
    'Collaborated with stakeholders to define requirements and deliverables',
    'Mentored junior team members and conducted knowledge sharing sessions'
  ]
  exp1.forEach(bullet => {
    doc.setFontSize(9)
    doc.text('• ' + bullet, 15, y)
    y += 6
  })
  y += 3

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(jobRole || 'Professional', 10, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Previous Company | City, State | Jun 2018 - Dec 2019', 10, y + 5)
  y += 12

  const exp2 = [
    'Developed and executed strategic initiatives aligned with business goals',
    'Analyzed data to identify trends and provide actionable insights',
    'Maintained strong relationships with clients and partners'
  ]
  exp2.forEach(bullet => {
    doc.setFontSize(9)
    doc.text('• ' + bullet, 15, y)
    y += 6
  })
  y += 5

  // Education
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.line(10, y, 200, y)
  y += 5
  doc.text('EDUCATION', 10, y)
  y += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Bachelor of Science in Computer Science', 10, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('University Name | City, State | Graduated: May 2018', 10, y + 5)
  doc.text('GPA: 3.8/4.0', 10, y + 10)
  y += 18

  // Skills
  if (y < 250) {
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.line(10, y, 200, y)
    y += 5
    doc.text('TECHNICAL SKILLS', 10, y)
    y += 8

    const skills = getSkillsForJobRole(jobRoleId)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    skills.slice(0, 9).forEach((skill, index) => {
      const xPos = 10 + (index % 3) * 65
      const yPos = y + Math.floor(index / 3) * 6
      doc.text('• ' + skill, xPos, yPos)
    })
  }

  // Footer
  doc.setFontSize(8)
  doc.setTextColor(128, 128, 128)
  doc.text('Generated by JobRush.ai - Your Career Acceleration Platform', 105, 290, { align: 'center' })
}

// Generate two-column layout
const generateTwoColumn = (doc, colors, jobRole, jobRoleId) => {
  // Left sidebar
  doc.setFillColor(colors.primary)
  doc.rect(0, 0, 70, 297, 'F')
  
  // Name in sidebar
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  const nameLines = doc.splitTextToSize('YOUR NAME', 60)
  doc.text(nameLines, 35, 20, { align: 'center' })
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(jobRole || 'Professional', 35, 30, { align: 'center' })
  
  doc.setFontSize(8)
  doc.text('your.email@example.com', 35, 40, { align: 'center' })
  doc.text('+1 (555) 123-4567', 35, 45, { align: 'center' })
  doc.text('linkedin.com/in/profile', 35, 50, { align: 'center' })

  let sidebarY = 65

  // Skills in sidebar
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('SKILLS', 35, sidebarY, { align: 'center' })
  sidebarY += 10

  const skills = getSkillsForJobRole(jobRoleId)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  skills.slice(0, 12).forEach(skill => {
    doc.text('• ' + skill, 10, sidebarY)
    sidebarY += 5
  })

  // Right column content
  doc.setTextColor(0, 0, 0)
  let y = 20

  // Summary
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setDrawColor(colors.primary)
  doc.setLineWidth(0.5)
  doc.line(75, y, 200, y)
  y += 5
  doc.text('PROFESSIONAL SUMMARY', 75, y)
  y += 8
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const summary = `Experienced ${jobRole || 'professional'} with a proven track record of delivering results.`
  const summaryLines = doc.splitTextToSize(summary, 125)
  doc.text(summaryLines, 75, y)
  y += summaryLines.length * 6 + 5

  // Experience
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.line(75, y, 200, y)
  y += 5
  doc.text('EXPERIENCE', 75, y)
  y += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(`Senior ${jobRole || 'Professional'}`, 75, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Company Name | Jan 2020 - Present', 75, y + 5)
  y += 12

  const exp = [
    'Led teams to deliver projects 30% ahead of schedule',
    'Implemented improvements resulting in 25% efficiency increase'
  ]
  exp.forEach(bullet => {
    doc.setFontSize(9)
    doc.text('• ' + bullet, 80, y)
    y += 6
  })
  y += 5

  // Education
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.line(75, y, 200, y)
  y += 5
  doc.text('EDUCATION', 75, y)
  y += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Bachelor of Science', 75, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('University Name | May 2018', 75, y + 5)

  // Footer
  doc.setFontSize(7)
  doc.setTextColor(128, 128, 128)
  doc.text('Generated by JobRush.ai', 105, 290, { align: 'center' })
}

// Generate skills-focused layout
const generateSkillsFocused = (doc, colors, jobRole, jobRoleId) => {
  // Header
  doc.setFillColor(colors.primary)
  doc.rect(0, 0, 210, 35, 'F')
  
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('YOUR NAME', 105, 18, { align: 'center' })
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('your.email@example.com | +1 (555) 123-4567 | linkedin.com/in/yourprofile', 105, 28, { align: 'center' })

  doc.setTextColor(0, 0, 0)
  let y = 45

  // Skills Section (prominent)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setDrawColor(colors.primary)
  doc.setLineWidth(0.8)
  doc.line(10, y, 200, y)
  y += 5
  doc.text('TECHNICAL SKILLS & EXPERTISE', 10, y)
  y += 10

  const skills = getSkillsForJobRole(jobRoleId)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  skills.forEach((skill, index) => {
    const xPos = 10 + (index % 4) * 50
    const yPos = y + Math.floor(index / 4) * 7
    if (yPos < 280) {
      doc.text('• ' + skill, xPos, yPos)
    }
  })
  y = 80

  // Experience
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.line(10, y, 200, y)
  y += 5
  doc.text('PROFESSIONAL EXPERIENCE', 10, y)
  y += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(`Senior ${jobRole || 'Professional'}`, 10, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Company Name | Jan 2020 - Present', 10, y + 5)
  y += 12

  const exp = [
    'Led technical teams to deliver projects 30% ahead of schedule',
    'Implemented solutions using modern technologies and best practices',
    'Mentored junior developers and conducted code reviews'
  ]
  exp.forEach(bullet => {
    doc.setFontSize(9)
    doc.text('• ' + bullet, 15, y)
    y += 6
  })
  y += 5

  // Education
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.line(10, y, 200, y)
  y += 5
  doc.text('EDUCATION', 10, y)
  y += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Bachelor of Science in Computer Science', 10, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('University Name | May 2018 | GPA: 3.8/4.0', 10, y + 5)

  // Footer
  doc.setFontSize(8)
  doc.setTextColor(128, 128, 128)
  doc.text('Generated by JobRush.ai', 105, 290, { align: 'center' })
}

// Main PDF generation function
export const generateResumePDF = (templateId, jobRoleId) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const { layout, colors } = getTemplateConfig(templateId)
  const jobRole = getJobRoleName(jobRoleId)

  doc.setFont('helvetica')

  // Generate based on layout
  switch (layout) {
    case 'two-column':
      generateTwoColumn(doc, colors, jobRole, jobRoleId)
      break
    case 'skills-focused':
      generateSkillsFocused(doc, colors, jobRole, jobRoleId)
      break
    case 'modern-minimal':
    default:
      generateModernMinimal(doc, colors, jobRole, jobRoleId)
      break
  }

  // Generate filename
  const filename = `Resume_${templateId}_${jobRoleId || 'general'}_${new Date().getTime()}.pdf`
  
  // Save the PDF
  doc.save(filename)
  
  return filename
}

// Junk patterns to filter from skills (metadata, form options, personal notes)
const SKILL_JUNK_PATTERNS = [
  /^publications\s*:\s*\d+/i,
  /^patents\s*:\s*\d+/i,
  /^certifications\s*:?\s*$/i,
  /^funding proposal$/i,
  /^consultancy$/i,
  /^any other supports\s*\/?\s*guidance$/i,
  /^i work on\s+/i,
  /^i want to learn\s+/i,
  /^no code platform/i,
  /^skill upgradation$/i,
  /^teaching$/i,
  /^research$/i,
  /^healthcare$/i,
  /^agriculture$/i,
  /^energy$/i,
  /^banking and fin$/i,
  /^retail$/i,
]

const isJunkSkill = (s) => {
  const t = (s || '').trim()
  if (!t || t.length < 2) return true
  if (t.length > 80) return true // likely form text or concatenated junk
  if (/^\d+$/.test(t)) return true
  return SKILL_JUNK_PATTERNS.some((p) => p.test(t))
}

/**
 * Sanitize resume data for PDF export - remove junk, filter empty entries
 */
function sanitizeResumeForPDF(parsed) {
  if (!parsed) return null
  const out = { ...parsed }

  // Skills: split comma-separated, filter junk, dedupe, limit length
  const rawSkills = (parsed.skills || []).flatMap((s) =>
    String(s)
      .split(/[,;]/)
      .map((x) => x.trim())
      .filter(Boolean)
  )
  out.skills = [...new Set(rawSkills)]
    .filter((s) => !isJunkSkill(s))
    .slice(0, 40) // cap to avoid overflow

  // Experience: filter placeholder entries (no company AND generic role)
  out.experience = (parsed.experience || []).filter((exp) => {
    const role = (exp.role || exp.title || '').trim()
    const company = (exp.company || '').trim()
    const hasDesc = (exp.description || '').trim().length > 10
    if (!company && !hasDesc && (!role || /^role$/i.test(role))) return false
    return true
  })

  // Education vs Certifications: degrees go to education, courses/certs to certifications
  const certProviders = /coursera|ibm|aws|harvardx|edx|udemy|linkedin learning|google|python institute|oracle/i
  const education = []
  const certifications = []
  for (const edu of parsed.education || []) {
    const deg = (edu.degree || '').trim()
    const inst = (edu.institution || '').trim()
    const isCert = certProviders.test(deg + ' ' + inst) || /certification|certificate|course/i.test(deg)
    if (isCert && (deg || inst)) {
      const parenMatch = (deg || inst).match(/\(([^)]+)\)$/)
      const provider = inst || (parenMatch ? parenMatch[1] : '')
      const name = provider ? (deg || inst).replace(/\s*\([^)]+\)\s*$/, '').trim() || inst : deg || inst
      certifications.push({ name: name || inst, provider })
    } else if (deg || inst) {
      education.push(edu)
    }
  }
  out.education = education
  out.certifications = certifications

  return out
}

const PARSED_RESUME_DESIGNS = {
  classic: { primary: '#0ea5e9', name: 'Classic Blue', desc: 'Clean, ATS-friendly with sky blue accent' },
  modern: { primary: '#6366f1', name: 'Modern Indigo', desc: 'Contemporary look with indigo header' },
  professional: { primary: '#374151', name: 'Professional Slate', desc: 'Formal gray for corporate roles' },
}

/**
 * Generate PDF from parsed resume data (for Resume Upload / ATS improvements)
 * @param {Object} parsed - Parsed resume { name, email, phone, skills, experience, education, projects }
 * @param {string} design - 'classic' | 'modern' | 'professional' (default: classic)
 */
export const generateParsedResumePDF = (parsed, design = 'classic') => {
  if (!parsed) return null

  const designConfig = PARSED_RESUME_DESIGNS[design] || PARSED_RESUME_DESIGNS.classic
  const primary = designConfig.primary

  const data = sanitizeResumeForPDF(parsed)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 15
  const pageWidth = 210 - 2 * margin
  let y = 15

  doc.setFont('helvetica')

  // Header
  doc.setFillColor(primary)
  doc.rect(0, 0, 210, 35, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text(data.name || 'Resume', 105, 15, { align: 'center' })
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const contact = [data.email, data.phone].filter(Boolean).join(' | ')
  if (contact) doc.text(contact, 105, 25, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  y = 45

  const section = (title) => {
    if (y > 265) return
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setDrawColor(primary)
    doc.setLineWidth(0.3)
    doc.line(margin, y, 210 - margin, y)
    y += 6
    doc.text(title.toUpperCase(), margin, y)
    y += 8
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
  }

  const checkPageBreak = (needed) => {
    if (y + needed > 275) {
      doc.addPage()
      y = 20
    }
  }

  // Skills: grid of bullets (3 per row)
  if (data.skills.length > 0) {
    section('Skills')
    const skillsPerRow = 3
    const colWidth = pageWidth / skillsPerRow
    const totalRows = Math.ceil(data.skills.length / skillsPerRow)
    let skillsY = y
    for (let row = 0; row < totalRows; row++) {
      if (skillsY + 6 > 275) {
        doc.addPage()
        skillsY = 20
      }
      for (let col = 0; col < skillsPerRow; col++) {
        const i = row * skillsPerRow + col
        if (i >= data.skills.length) break
        const skill = data.skills[i]
        const x = margin + col * colWidth + 2
        doc.setFontSize(9)
        doc.text('• ' + (skill.length > 35 ? skill.slice(0, 34) + '…' : skill), x, skillsY)
      }
      skillsY += 6
    }
    y = skillsY + 5
  }

  // Experience
  if (data.experience.length > 0) {
    section('Experience')
    for (const exp of data.experience) {
      checkPageBreak(25)
      const rawRole = (exp.role || exp.title || '').trim()
      const role = (!rawRole || /^role$/i.test(rawRole)) ? 'Professional Experience' : rawRole
      const company = (exp.company || '').trim()
      const duration = (exp.duration || '').trim()
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      const titleLine = company ? `${role} at ${company}` : role
      doc.text(titleLine, margin, y)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      if (duration) doc.text(duration, margin, y + 5)
      y += 10
      if (exp.description) {
        const descLines = doc.splitTextToSize(exp.description, pageWidth - 5)
        descLines.forEach((line) => {
          checkPageBreak(6)
          doc.text(line, margin + 3, y)
          y += 5
        })
        y += 3
      }
      y += 5
    }
    y += 3
  }

  // Education (degrees only)
  if (data.education.length > 0) {
    section('Education')
    for (const edu of data.education) {
      checkPageBreak(15)
      doc.setFont('helvetica', 'bold')
      doc.text(edu.degree || 'Degree', margin, y)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      const meta = [edu.institution, edu.year].filter(Boolean).join(' • ')
      if (meta) doc.text(meta, margin, y + 5)
      y += 14
    }
    y += 3
  }

  // Certifications (courses, certs)
  if (data.certifications?.length > 0) {
    section('Certifications')
    for (const cert of data.certifications) {
      checkPageBreak(10)
      const name = cert.name || cert.provider || ''
      const provider = cert.provider && cert.provider !== name ? cert.provider : ''
      doc.setFontSize(9)
      doc.text(name + (provider ? ` — ${provider}` : ''), margin, y)
      y += 7
    }
    y += 3
  }

  // Projects
  if ((data.projects || []).length > 0) {
    section('Projects')
    for (const proj of data.projects) {
      checkPageBreak(20)
      doc.setFont('helvetica', 'bold')
      doc.text(proj.name || 'Project', margin, y)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      y += 6
      if (proj.description) {
        const descLines = doc.splitTextToSize(proj.description, pageWidth - 5)
        descLines.forEach((line) => {
          checkPageBreak(6)
          doc.text(line, margin + 3, y)
          y += 5
        })
        y += 3
      }
      y += 5
    }
  }

  doc.setFontSize(8)
  doc.setTextColor(128, 128, 128)
  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.text('Generated by JobRush.ai - Your Career Acceleration Platform', 105, doc.internal.pageSize.height - 10, { align: 'center' })
  }

  const filename = `Resume_${(data.name || 'Resume').replace(/\s+/g, '_').replace(/[^\w.-]/g, '')}_${Date.now()}.pdf`
  doc.save(filename)
  return filename
}

export { PARSED_RESUME_DESIGNS }
